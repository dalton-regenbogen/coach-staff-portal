/* attendance.js  – lean Firestore version (single-doc attendance)  */

import { db, auth } from '/js/firebase-config.js';
import {
  collection, doc, setDoc, getDoc, getDocs,
  updateDoc, onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { savePref, loadPref } from '/js/utils.js';

/* ───────── global cache ───────── */
let rosterCache = [];                   // used to seed a new attendance doc

/* ───────── auth guard ───────── */
onAuthStateChanged(auth, user => {
  if (!user) { window.location.href = '/'; return; }
  initAttendance();                     // start page logic
});

/* ────────────────────────────────────────────────────────────
   Main page logic
───────────────────────────────────────────────────────────── */
async function initAttendance() {

  /* ---------- DOM handles ---------- */
  const datePicker   = document.getElementById('datePicker');
  const sessionPick  = document.getElementById('sessionPick');
  const ageFilter    = document.getElementById('ageFilter');
  const csvInput     = document.getElementById('csvInput');
  const rosterBody   = document.querySelector('#rosterTable tbody');
  const bulkBar      = document.getElementById('bulkActions');


 const now = new Date();
  const y   = now.getFullYear();
  const m   = String(now.getMonth() + 1).padStart(2, "0");
  const d   = String(now.getDate()).padStart(2, "0");
  datePicker.value = `${y}-${m}-${d}`;

  /* ---------- one-time roster fetch ---------- */
  await loadRosterOnce();
  applyAgeFilter();                      // respect current age filter

  /* ---------- attendance listener ---------- */
  let stopAtt = startAttendanceListener();

  /* restart listener when date / session changes */
  datePicker .addEventListener('change', () => { stopAtt = restartAtt(stopAtt); });
  sessionPick.addEventListener('change', () => { stopAtt = restartAtt(stopAtt); });

  /* ---------- other UI handlers ---------- */
  ageFilter.addEventListener('change', applyAgeFilter);
  if (csvInput) csvInput.addEventListener('change', handleCSV, false);

  toggleSessionVisibility();             // Tue/Wed only
  datePicker.addEventListener('change', toggleSessionVisibility);

  /* bulk-bar buttons */
  bulkBar.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const st  = btn.dataset.action;                 // present|unsure|absent
      const lbl = st==='present' ? 'Present'
               : st==='absent'  ? 'Absent'  : 'Unsure';
      if (confirm(`Mark ALL visible swimmers ${lbl}?`)) applyBulk(st);
    });
  });

  /* ─── helper to restart att listener ─ */
  function restartAtt(prevStop){
    if (typeof prevStop==='function') prevStop();
    return startAttendanceListener();
  }

  /* ─────────────────────────────────────────────────────────
     ROSTER  (read once)
  ───────────────────────────────────────────────────────── */
  async function loadRosterOnce() {
    const snap = await getDocs(collection(db, 'roster'));        // 1 read
    rosterCache = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    buildRosterFromArray(rosterCache);
  }

  function buildRosterFromArray(swimmers) {
    swimmers.sort((a, b) => {
      // parse ages as integers (fallback to 0 if missing)
      const ageA = parseInt(a.age, 10) || 0;
      const ageB = parseInt(b.age, 10) || 0;

      // if ages differ, sort by age ascending (youngest first)
      if (ageA !== ageB) {
        return ageA - ageB;
      }
      // else same age—sort by name
      return a.name.localeCompare(b.name);
    });


    rosterBody.innerHTML = '';

    swimmers.forEach(swimmer=>{
      const tr = document.createElement('tr');
      tr.dataset.age = swimmer['age group'] || swimmer.age || '';

      /* name cell */
      const nameTd = document.createElement('td');
      nameTd.textContent = swimmer.name;

      /* age cell */
      const ageTd = document.createElement('td');
      ageTd.className = 'col-age';
      ageTd.textContent = swimmer.age || '';

      /* status cell */
      const statusTd = document.createElement('td');
      statusTd.className = 'col-status';

      const chip = document.createElement('span');
      chip.className = 'chip toggle unsure';
      chip.role      = 'button';

      const lbl  = document.createElement('span');
      lbl.className = 'knob-label';
      chip.appendChild(lbl);
      statusTd.appendChild(chip);

      tr.appendChild(nameTd);
      tr.appendChild(ageTd);
      tr.appendChild(statusTd);
      rosterBody.appendChild(tr);
    });

    attachChipListeners();   // new chips become interactive
  }

  /* ───────────────── CSV upload (unchanged) ─────────────── */
  function handleCSV(evt){
    const file = evt.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = e => { buildRosterFromCSV(e.target.result); csvInput.value=''; };
    reader.readAsText(file);
  }

  function buildRosterFromCSV(csvText){
    const [headerLine, ...lines] = csvText.trim().split(/\r?\n/);
    const headers = headerLine.split(',').map(h=>h.trim().toLowerCase());
    const swimmers = lines.map(l=>{
      const cells = l.split(',').map(c=>c.trim());
      const obj = Object.fromEntries(headers.map((h,i)=>[h,cells[i]]));
      obj.name = obj.name || obj.swimmer || 'UNKNOWN';
      obj.age  = obj.age  || obj['age group'] || '';
      return obj;
    });
    /* local render */
    buildRosterFromArray(swimmers);
    /* Firestore write (admin only) */
    swimmers.forEach(sw => setDoc(doc(collection(db,'roster'),sw.name), sw)
      .catch(err=>console.error('Roster write',err)));
  }

  /* ─────────────────────────────────────────────────────────
     ATTENDANCE  (single-doc model)
  ───────────────────────────────────────────────────────── */
  function startAttendanceListener() {
    return listenToAttendance(datePicker.value, sessionPick.value);
  }

  function listenToAttendance(dateStr, sessStr){
    const docRef = doc(db,'attendance', `${dateStr}_${sessStr}`);

    /* create blank doc if it doesn’t exist */
    getDoc(docRef).then(snap => {
      if (!snap.exists()) {
        const blank = rosterCache.reduce((acc,s)=>{ acc[s.name]='unsure'; return acc; },{});
        setDoc(docRef, blank);                               // 1 write
      }
    });

    /* live listener (1 read on attach, then incremental) */
    return onSnapshot(docRef, snap => {
      if (snap.exists()) applyAttendanceObject(snap.data());
    });
  }

  function applyAttendanceObject(map){
    rosterBody.querySelectorAll('tr').forEach(row=>{
      const name = row.cells[0].textContent.trim();
      const chip = row.querySelector('.chip');
      const st   = map[name] || 'unsure';
      updateChipVisual(chip, st);
    });
  }

  /* ───────────────── chip click/swipe ─────────────── */
  function attachChipListeners(){
    rosterBody.querySelectorAll('.chip').forEach(chip=>{
      chip.onclick = () => cycleStatus(chip);
      chip.onkeydown = e=>{
        if(e.key==='Enter'||e.key===' ') { e.preventDefault(); cycleStatus(chip); }
      };
    });
  }

  function cycleStatus(chip){
    const states=['present','unsure','absent'];
    const cur = states.findIndex(s=>chip.classList.contains(s));
    const next= states[(cur+1)%states.length];

    updateChipVisual(chip,next);
    writeStatus(chip,next);
  }

  function updateChipVisual(chip,state){
    chip.classList.remove('present','unsure','absent');
    chip.classList.add(state);
    chip.querySelector('.knob-label').textContent = '';
  }

  function writeStatus(chip,state){
    const name = chip.closest('tr').cells[0].textContent.trim();
    const date = datePicker.value, session=sessionPick.value;
    const docRef = doc(db,'attendance', `${date}_${session}`);
    /* merge:true creates doc if somehow missing */
    setDoc(docRef, { [name]: state }, { merge:true })
      .catch(err=>console.error('Attendance write',err));
  }

  /* ───────────────── bulk mark (single write) ─────────────── */
  function applyBulk(state){
    const rows = rosterBody.querySelectorAll('tr:not(.hidden)');
    const updateObj={};

    rows.forEach(row=>{
      const chip=row.querySelector('.chip');
      updateChipVisual(chip,state);
      const name=row.cells[0].textContent.trim();
      updateObj[name]=state;
    });

    const docRef = doc(db,'attendance',
                      `${datePicker.value}_${sessionPick.value}`);
    setDoc(docRef, updateObj, { merge:true })
      .catch(err=>console.error('Bulk write',err));
  }

  /* ───────────────── helpers ─────────────── */
  function applyAgeFilter(){
    const chosen=ageFilter.value;
    rosterBody.querySelectorAll('tr').forEach(r=>{
      const show=chosen==='all'||r.dataset.age===chosen;
      r.classList.toggle('hidden',!show);
    });
  }

  function toggleSessionVisibility(){
    const wd=new Date(datePicker.value).getDay();   // 0 Sun .. 6 Sat
    const show=(wd===1||wd===2);                    // Tue(2) Wed(3)
    sessionPick.style.display = show? 'inline-block':'none';
  }
}