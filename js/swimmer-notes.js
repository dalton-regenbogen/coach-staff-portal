// js/swimmer-notes.js
import { savePref, loadPref } from './utils.js';  // if you use prefs
let rosterCache = [];

const ageFilter  = document.getElementById('ageFilter');
const csvInput   = document.getElementById('csvInput');
const notesBody  = document.querySelector('#notesTable tbody');

// restore filter
ageFilter.value = loadPref('notes_age','all');
ageFilter.addEventListener('change', e => {
  savePref('notes_age', e.target.value);
  filterRows();
});

csvInput.addEventListener('change', handleCSV);

function handleCSV(evt){
  const file = evt.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const [headerLine, ...lines] = e.target.result.trim().split('\n');
    const headers = headerLine.split(',').map(h=>h.trim().toLowerCase());
    rosterCache = lines.map(l => {
      const cells = l.split(',').map(c=>c.trim());
      const obj = Object.fromEntries(headers.map((h,i)=>[h,cells[i]]));
      return {
        name: obj.name || obj.swimmer || 'UNKNOWN',
        age:  obj.age  || obj['age group'] || ''
      };
    });
    buildNotesFromArray(rosterCache);
    filterRows();
  };
  reader.readAsText(file);
}

function buildNotesFromArray(swimmers) {
  swimmers.sort((a,b)=>
    a.age===b.age
      ? a.name.localeCompare(b.name)
      : (a.age||'').localeCompare(b.age||'')
  );

  notesBody.innerHTML = '';
  swimmers.forEach(sw => {
    const tr = document.createElement('tr');
    tr.dataset.age = sw.age;

    // Name cell
    const nameTd = document.createElement('td');
    nameTd.className = 'thOne';
    nameTd.textContent = sw.name;

    // Age cell
    const ageTd = document.createElement('td');
    ageTd.className = 'thThree';
    ageTd.textContent = sw.age;

    tr.appendChild(nameTd);
    tr.appendChild(ageTd);

    // six note columns
    ['Water Safety','FR','IM','BK','BR','FLY'].forEach(label=>{
      const td = document.createElement('td');
      td.className = 'col-status thTwo';

      const chip = document.createElement('span');
      chip.className = 'chip toggle absent';  // start as 'no'
      chip.setAttribute('role','button');
      chip.setAttribute('tabindex','0');

      const lbl = document.createElement('span');
      lbl.className = 'knob-label';
      lbl.textContent = label;
      chip.appendChild(lbl);

      td.appendChild(chip);
      tr.appendChild(td);
    });

    notesBody.appendChild(tr);
  });

  attachChipListeners();
}

function attachChipListeners(){
  notesBody.querySelectorAll('.chip').forEach(chip=>{
    chip.onclick   = () => cycleNote(chip);
    chip.onkeydown = e => {
      if (e.key==='Enter' || e.key===' ') {
        e.preventDefault();
        cycleNote(chip);
      }
    };
  });
}

function cycleNote(chip){
  const states = ['absent','present'];
  const cur    = states.findIndex(s=>chip.classList.contains(s));
  const next   = states[(cur+1)%states.length];
  updateChip(chip, next);
}

function updateChip(chip, state){
  chip.classList.remove('absent','present');
  chip.classList.add(state);
}

function filterRows(){
  const sel = ageFilter.value;
  notesBody.querySelectorAll('tr').forEach(tr=>{
    if (sel!=='all' && tr.dataset.age!==sel) {
      tr.classList.add('hidden');
    } else {
      tr.classList.remove('hidden');
    }
  });
}
