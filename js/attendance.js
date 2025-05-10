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

/* ------------------------------------------------------------------ */
/* 3. One-time page setup                                             */
/* ------------------------------------------------------------------ */

function initialiseAttendanceApp() {
  // A. default the date picker to today
  if (datePicker) {
    datePicker.value = new Date().toISOString().split('T')[0];
  }

  // B. listen for roster changes in Firestore (real-time)
  watchRoster();

  // C. start listening to attendance for *today*
  let unsubscribeAttendance = listenToAttendance(datePicker.value);

  // D. change listener → switch attendance query
  datePicker.addEventListener('change', () => {
    // stop previous snapshot listener
    if (typeof unsubscribeAttendance === 'function') unsubscribeAttendance();
    // start new
    unsubscribeAttendance = listenToAttendance(datePicker.value);
  });

  // E. age-filter dropdown
  ageFilter.addEventListener('change', applyAgeFilter);

  // F. CSV file picker
  if (csvInput) csvInput.addEventListener('change', handleCSV, false);
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

  swimmers.forEach(({ name, age }) => {
    const tr = document.createElement('tr');
    tr.dataset.age = age;

    const nameTd = document.createElement('td');
    nameTd.textContent = name;

    const statusTd = document.createElement('td');
    statusTd.className = 'col-status';
    const chip = document.createElement('span');
    chip.className = 'chip toggle unsure';
    chip.setAttribute('role', 'button');

    const lbl = document.createElement('span');
    lbl.className = 'knob-label';
    lbl.textContent = '?';          // initial (unsure)
    chip.appendChild(lbl);

    statusTd.appendChild(chip);

    tr.appendChild(nameTd);
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

function buildRosterFromCSV(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  if (/^name\s*,/i.test(lines[0])) lines.shift();        // drop header

  const swimmers = lines.map(l => {
    const [rawName, rawAge] = l.split(',').map(s => s.trim());
    return { name: rawName, age: rawAge };
  });

  // overwrite collection (admin only: see Firestore rules)
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
function listenToAttendance(dateStr) {
  const q = query(collection(db, 'attendance'), where('date', '==', dateStr));

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


function cycleStatus(chip) {
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
  const docId = `${date}_${name}`;

  setDoc(doc(db, 'attendance', docId),
         { date, name, status: next })
    .catch(err => console.error('Attendance write:', err));
}

/* ------------------------------------------------------------------ */
/* 9.  (Optional) localStorage backup – remove if you dislike it       */
/* ------------------------------------------------------------------ */
/* Converts current table to {name: status} map  */
function tableToObject() {
  const obj = {};
  document.querySelectorAll('#rosterTable tbody tr').forEach(row => {
    const name = row.cells[0].textContent.trim();
    const chip = row.querySelector('.chip');
    if (name && chip) {
      if (chip.classList.contains('present')) obj[name] = 'present';
      else if (chip.classList.contains('absent')) obj[name] = 'absent';
      else obj[name] = 'unsure';
    }
  });
  return obj;
}
