/* attendance.js  – ES Module */

import { db, auth } from '/js/firebase-config.js';
import {
  collection, doc, setDoc, onSnapshot,
  query, where, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { savePref, loadPref } from '/js/utils.js';

onAuthStateChanged(auth, user => {
  if (!user) { window.location.href = '/'; return; }
  initAttendance();               // start the page logic
});

/* ────────────────────────────────────────────────────────────
   3. Main page logic  (everything lives in here)
───────────────────────────────────────────────────────────── */
function initAttendance() {

  /* ---------- DOM handles ---------- */
  const datePicker   = document.getElementById('datePicker');
  const sessionPick  = document.getElementById('sessionPick');
  const ageFilter    = document.getElementById('ageFilter');
  const csvInput     = document.getElementById('csvInput');
  const rosterBody   = document.querySelector('#rosterTable tbody');
  const bulkBar      = document.getElementById('bulkActions');

  /* ---------- restore saved filter state ---------- */
  datePicker.value  = loadPref('att_date',
  new Date().toISOString().split('T')[0]);

  /* sessionPick already has AM/PM default from HTML; restore if saved */
  sessionPick.value = loadPref('att_sess', sessionPick.value);

  /* ageFilter default = 'all' */
  ageFilter.value   = loadPref('att_age', 'all');

  datePicker .addEventListener('change', e => savePref('att_date',  e.target.value));
  sessionPick.addEventListener('change', e => savePref('att_sess',  e.target.value));
  ageFilter  .addEventListener('change', e => savePref('att_age',   e.target.value));



  watchRoster();                               // live roster listener
  let stopAtt = startAttendanceListener();     // live attendance listener

  datePicker .addEventListener('change', () => { stopAtt = restartAtt(stopAtt); });
  sessionPick.addEventListener('change', () => { stopAtt = restartAtt(stopAtt); });
  ageFilter  .addEventListener('change', applyAgeFilter);
  if (csvInput) csvInput.addEventListener('change', handleCSV, false);

  toggleSessionVisibility();                   // Tue/Wed only
  datePicker.addEventListener('change', toggleSessionVisibility);

  /* ---------- Bulk-bar buttons ---------- */
  bulkBar.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const st = btn.dataset.action;                        // present|unsure|absent
      const lbl = st==='present'?'Present':st==='absent'?'Absent':'Unsure';
      if (confirm(`Mark ALL visible swimmers ${lbl}?`)) applyBulk(st);
    });
  });

  /* ───── helper to restart att listener ─── */
  function restartAtt(prevStop){
    if (typeof prevStop==='function') prevStop();
    return startAttendanceListener();
  }

  /* ─────────────────────────────────────────────────────────
     ROSTER
  ───────────────────────────────────────────────────────── */
  function watchRoster() {
    const rosterRef = collection(db, 'roster');
    onSnapshot(rosterRef, snap => {
      const swimmers = [];
      snap.forEach(d => swimmers.push(d.data()));
      buildRosterFromArray(swimmers);
      applyAgeFilter();             // respect current age filter
    });
  }

  function buildRosterFromArray(swimmers) {
    swimmers.sort((a,b)=> a.age===b.age
        ? a.name.localeCompare(b.name)
        : (a.age||'').localeCompare(b.age||''));

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
      ageTd.textContent = swimmer.age || ageGroup;     // numeric age first

      /* status cell */
      const statusTd = document.createElement('td');
      statusTd.className = 'col-status';

      const chip = document.createElement('span');
      chip.className = 'chip toggle unsure';
      chip.role      = 'button';

      const lbl  = document.createElement('span');
      lbl.className = 'knob-label';
      lbl.textContent = '';
      chip.appendChild(lbl);
      statusTd.appendChild(chip);

      tr.appendChild(nameTd);
      tr.appendChild(ageTd);
      tr.appendChild(statusTd);
      rosterBody.appendChild(tr);
    });

    attachChipListeners();   // new chips become interactive
  }

  /* upload CSV */
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
     ATTENDANCE
  ───────────────────────────────────────────────────────── */
  function startAttendanceListener(){
    return listenToAttendance(datePicker.value, sessionPick.value);
  }

  function listenToAttendance(dateStr, sessStr){
    const q = query(collection(db,'attendance'),
      where('date','==',dateStr), where('session','==',sessStr));
    return onSnapshot(q, snap => {
      const obj={}; snap.forEach(d=>{ obj[d.data().name]=d.data().status; });
      applyAttendanceObject(obj);
    });
  }

  function applyAttendanceObject(map){
    rosterBody.querySelectorAll('tr').forEach(row=>{
      const name = row.cells[0].textContent.trim();
      const chip = row.querySelector('.chip');
      const lbl  = chip.querySelector('.knob-label');
      const st   = map[name]||'unsure';

      chip.classList.remove('present','unsure','absent');
      chip.classList.add(st);
      lbl.textContent = st==='present'?'':st==='absent'?'':'';
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
    chip.querySelector('.knob-label').textContent =
        state==='present'?'':state==='absent'?'':'';
  }

  function writeStatus(chip,state){
    const name = chip.closest('tr').cells[0].textContent.trim();
    const date = datePicker.value, session=sessionPick.value;
    setDoc(doc(db,'attendance',`${date}_${session}_${name}`),
      { date, session, name, status:state })
      .catch(err=>console.error('Attendance write',err));
  }

  /* ───────────────── bulk mark ─────────────── */
  function applyBulk(state){
    const rows = rosterBody.querySelectorAll('tr:not(.hidden)');
    const batch = writeBatch(db);

    rows.forEach(row=>{
      const chip=row.querySelector('.chip');
      updateChipVisual(chip,state);

      const name=row.cells[0].textContent.trim();
      batch.set(doc(db,'attendance',`${datePicker.value}_${sessionPick.value}_${name}`),
        { date:datePicker.value, session:sessionPick.value, name, status:state });
    });
    batch.commit().catch(err=>console.error('Bulk write',err));
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
    const show=(wd===1||wd===2);                    // Tue Wed
    sessionPick.style.display = show? 'inline-block':'none';
  }
}
