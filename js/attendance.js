/* attendance.js  – ES Module (index.html must load it with type="module") */

/* ------------------------------------------------------------------ */
/* 1. Firebase imports & init objects                                 */
/* ------------------------------------------------------------------ */
import { db, auth } from '/js/firebase-config.js';   // your existing init file
import {
  collection, doc, setDoc, onSnapshot,
  query, where
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

/* -----------------------------------------------------------
   Wait until we know whether the user is logged in or not
----------------------------------------------------------- */
onAuthStateChanged(auth, user => {
  if (!user) {
    console.warn('Not signed in – Firestore listeners paused.');
    return;               // signed-out users will not start listeners
  }

  console.log('Signed in as', user.email || user.uid);

  initialiseAttendanceApp();   // 🔸 All previous setup lives in here
});


/* ------------------------------------------------------------------ */
/* 2. DOM handles                                                     */
/* ------------------------------------------------------------------ */
const datePicker = document.getElementById('datePicker');
const ageFilter  = document.getElementById('ageFilter');
const csvInput   = document.getElementById('csvInput');
const rosterBody = document.querySelector('#rosterTable tbody');
const sessionPick = document.getElementById('sessionPick');

/* ------------------------------------------------------------------ */
/* 3. One-time page setup – REPLACE the whole function with this      */
/* ------------------------------------------------------------------ */
function initialiseAttendanceApp() {

  /* A. default date picker to today */
  datePicker.value = new Date().toISOString().split('T')[0];

  /* B. real-time roster listener */
  watchRoster();

  /* C. helper to (re)subscribe to attendance */
  let unsubscribeAttendance = null;

  function startAttendanceListener() {
    /* stop the previous snapshot listener, if any  */
    if (typeof unsubscribeAttendance === 'function') unsubscribeAttendance();

    /* start a new one using BOTH date + session */
    unsubscribeAttendance = listenToAttendance(
      datePicker.value,
      sessionPick.value
    );
  }

  /* D. kick it off for the very first time */
  startAttendanceListener();

  /* E. re-run whenever date OR session changes */
  datePicker .addEventListener('change', startAttendanceListener);
  sessionPick.addEventListener('change', startAttendanceListener);

  /* F. age-group dropdown & CSV picker remain the same */
  ageFilter.addEventListener('change', applyAgeFilter);
  if (csvInput) csvInput.addEventListener('change', handleCSV, false);

  /* G. (optional) hide session picker on non-Tue/Wed days */
  toggleSessionVisibility();
  datePicker.addEventListener('change', toggleSessionVisibility);
}

/* ------------------------------------------------------------------ */
/* 4.  Firestore – Roster (collection: 'roster')                      */
/* ------------------------------------------------------------------ */
function watchRoster() {
  const rosterRef = collection(db, 'roster');
  onSnapshot(rosterRef, snap => {
    const swimmers = [];
    snap.forEach(d => swimmers.push(d.data()));
    buildRosterFromArray(swimmers);
    applyAgeFilter();
    // attendance snapshot will recolor chips in real time
  });
}

/* Build table rows from an array of {name, age} objects */
function buildRosterFromArray(swimmers) {
  // sort consistently
  swimmers.sort((a, b) =>
    a.age === b.age ? a.name.localeCompare(b.name)
                    : a.age.localeCompare(b.age)
  );

  rosterBody.innerHTML = '';

  swimmers.forEach(swimmer => {            // keep full object
    const name      = swimmer.name;
    const ageGroup  = swimmer['age group'] || swimmer.age || '';
  
    const tr = document.createElement('tr');
    tr.dataset.age = ageGroup;             // if you still group by age
  
    /* --- name cell --- */
    const nameTd = document.createElement('td');
    nameTd.textContent = name;
  
    /* --- age-group cell (new column) --- */
    const ageTd = document.createElement('td');
    ageTd.className = 'col-age';
    ageTd.textContent = swimmer.age;
  
    /* --- status cell (unchanged) --- */
    const statusTd = document.createElement('td');
    statusTd.className = 'col-status';
  
    const chip   = document.createElement('span');
    chip.className = 'chip toggle unsure';
    chip.setAttribute('role', 'button');
  
    const lbl = document.createElement('span');
    lbl.className = 'knob-label';
    lbl.textContent = '?';
    chip.appendChild(lbl);
  
    statusTd.appendChild(chip);
  
    /* append in order: name → age-group → status */
    tr.appendChild(nameTd);
    tr.appendChild(ageTd);
    tr.appendChild(statusTd);
    rosterBody.appendChild(tr);
  });
  

  attachChipListeners();  // wire up click handlers
}

/* ------------------------------------------------------------------ */
/* 5.  CSV upload → parse → save roster to Firestore                  */
/* ------------------------------------------------------------------ */
function handleCSV(evt) {
  const file = evt.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    buildRosterFromCSV(e.target.result);
    csvInput.value = '';    // reset picker
  };
  reader.readAsText(file);
}

/* ---------- HEADER-AWARE ROSTER PARSE ---------- */
function buildRosterFromCSV(csvText) {
  const [headerLine, ...lines] = csvText.trim().split(/\r?\n/);
  const headers = headerLine.split(',').map(h => h.trim().toLowerCase());
  // Example headers → ["name","age group","age"]

  const swimmers = lines.map(line => {
    const cells = line.split(',').map(c => c.trim());
    const obj = Object.fromEntries(headers.map((h,i) => [h, cells[i]]));
    // Ensure legacy names exist for older code ↓
    obj.name = obj.name || obj['swimmer'] || 'UNKNOWN';
    obj.age  = obj.age  || obj['age group'] || '';
    return obj;           // may include extra fields automatically
  });

  // Push to Firestore (admin only)
  swimmers.forEach(sw => {
    setDoc(doc(collection(db, 'roster'), sw.name), sw)
      .catch(err => console.error('Roster write:', err));
  });
}


/* ------------------------------------------------------------------ */
/* 6.  Age-group filtering                                            */
/* ------------------------------------------------------------------ */
function applyAgeFilter() {
  const chosen = ageFilter.value;                        // "all", "9-10", …
  document.querySelectorAll('#rosterTable tbody tr')
          .forEach(row => {
            const show = chosen === 'all' || row.dataset.age === chosen;
            row.classList.toggle('hidden', !show);
          });
}

/* ------------------------------------------------------------------ */
/* 7.  Attendance – Firestore                                         */
/* ------------------------------------------------------------------ */
function listenToAttendance(dateStr, sessStr) {
  const q = query(collection(db, 'attendance'), where('date', '==', dateStr), where('session', '==', sessStr));

  return onSnapshot(q, snap => {
    const obj = {};
    snap.forEach(d => { obj[d.data().name] = d.data().status; });
    applyAttendanceObject(obj);
  });
}

/* repaint chips from {name: status, …} */
function applyAttendanceObject(map) {
  document.querySelectorAll('#rosterTable tbody tr').forEach(row => {
    const name   = row.cells[0].textContent.trim();
    const chip   = row.querySelector('.chip');
    const label  = chip.querySelector('.knob-label');
    const status = map[name] || 'unsure';

    /* swap classes to move knob & recolor */
    chip.classList.remove('present', 'unsure', 'absent');
    chip.classList.add(status);

    /* update label char without wiping the knob element */
    if (status === 'present')      label.textContent = '';
    else if (status === 'absent')  label.textContent = '';
    else                           label.textContent = '';
  });
}

/* ------------------------------------------------------------------ */
/* 8.  Chip interactions                                              */
/* ------------------------------------------------------------------ */
function attachChipListeners() {
  document.querySelectorAll('.chip').forEach(chip => {
    chip.onclick = () => cycleStatus(chip);
    chip.onkeydown = e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        cycleStatus(chip);
      }
    };
  });
}

/* ---------- permanent bulk-action bar ---------- */
import { writeBatch } from
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const bulkBar = document.getElementById('bulkActions');

bulkBar.querySelectorAll('[data-action]').forEach(btn => {
  btn.addEventListener('click', () => {
    const state = btn.dataset.action;                   // present | unsure | absent
    const label = state === 'present' ? 'Present' :
                  state === 'absent'  ? 'Absent'  : 'Unsure';

    if (confirm(`Mark ALL visible swimmers ${label}?`)) {
      applyBulk(state);                                // existing function
    }
  });
});

function applyBulk(state) {
  const rows = document.querySelectorAll('#rosterTable tbody tr:not(.hidden)');
  const batch = writeBatch(db);

  rows.forEach(row => {
    const chip  = row.querySelector('.chip');
    const label = chip.querySelector('.knob-label');

    chip.classList.remove('present','unsure','absent');
    chip.classList.add(state);

    label.textContent = state === 'present' ? '✔'
                    :  state === 'absent'  ? '✖'
                    :  '?';

    const name    = row.cells[0].textContent.trim();
    const date    = datePicker.value;
    const session = sessionPick.value;
    const docId   = `${date}_${session}_${name}`;

    batch.set(doc(db,'attendance',docId),
              { date, session, name, status: state });
  });

  batch.commit().catch(err => console.error('Bulk write:', err));
}

function cycleStatus(chip) {
  const session = sessionPick.value;
  const states = ['present', 'unsure', 'absent'];
  const current = states.findIndex(s => chip.classList.contains(s));
  const next    = states[(current + 1) % states.length];
  
  const label = chip.querySelector('.knob-label');
  if (next === 'present') label.textContent = '✔';
  else if (next === 'absent') label.textContent = '✖';
  else label.textContent = '?';

  chip.classList.remove(...states);
  chip.classList.add(next);


  // Firestore write
  const date  = datePicker.value;
  const name  = chip.closest('tr').cells[0].textContent.trim();
  const docId = `${date}_${session}_${name}`;

  setDoc(doc(db, 'attendance', docId),
         { date, session, name, status: next })
    .catch(err => console.error('Attendance write:', err));
}

function toggleSessionVisibility() {
  const wd = new Date(datePicker.value).getDay();          // 0=Sun … 6=Sat
  const show = (wd === 1 || wd === 2);                     // Tue=2, Wed=3
  sessionPick.style.display = show ? 'inline-block' : 'none';
}

datePicker.addEventListener('change', toggleSessionVisibility);
toggleSessionVisibility();    // run once on load
