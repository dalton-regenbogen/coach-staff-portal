/* metrics.js  – single-doc attendance model, with week presets */

/* ─ Firebase imports ─ */
import { db, auth } from './firebase-config.js';
import { collection, getDocs, onSnapshot }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

/* ─ Auth guard ─ */
onAuthStateChanged(auth, user => {
  if (!user) { window.location.href = '/'; return; }
  initMetrics();
});

/* ─ Dashboard ─ */
function initMetrics() {

/* ---------- DOM ---------- */
const $ = s => document.querySelector(s);
const fromDate   = $('#fromDate');
const toDate     = $('#toDate');
const ageSel     = $('#ageSelect');
const weekSel    = $('#weekSelect');
const refreshBtn = $('#refreshBtn');

const teamPct = $('#teamPct');
const sessTot = $('#sessTotal');
const swimTot = $('#swimmersTotal');
const goalHit = $('#goalHit');

const tbody   = $('#detailTable tbody');
const modal   = $('#modal');
const modalTit= $('#modalTitle');
const modalBody=$('#modalTable tbody');

/* ---------- Constants ---------- */
const SEASON_START = new Date('2025-05-26');   // Monday week-1
const WEEK_GOAL    = 5;

/* ---------- Chart ---------- */
const trendChart = new Chart($('#trendChart'),{
  type:'line',
  data:{ labels:[], datasets:[{ label:'% Present', data:[] }] },
  options:{ scales:{ y:{ beginAtZero:true,max:100 } } }
});

/* ---------- Roster map ---------- */
const ageMap = {};
let rosterReady = false;

onSnapshot(collection(db,'roster'), snap=>{
  Object.keys(ageMap).forEach(k=>delete ageMap[k]);    // clear
  snap.forEach(d=>{
    const r=d.data();
    ageMap[r.name] = r['age group'] || r.age || '';
  });
  rosterReady = true;
  refresh();
});

/* ---------- Week helpers ---------- */
function iso(d){ return d.toISOString().split('T')[0]; }
function weekToRange(n){
  const s=new Date(SEASON_START); s.setDate(s.getDate()+7*(n-1));
  const e=new Date(s); e.setDate(e.getDate()+6);
  return [ iso(s), iso(e) ];
}
function setCurrentWeek(){
  const diff=Math.floor((Date.now()-SEASON_START)/864e5);
  const wk=Math.floor(diff/7)+1;
  weekSel.value='current';
  const [s,e]=weekToRange(wk);
  fromDate.value=s; toDate.value=e;
}

/* ---------- Default to current week ---------- */
setCurrentWeek();

/* ────────── main refresh (single read) ────────── */
async function refresh(){
  if(!rosterReady) return;

  const start = fromDate.value, end = toDate.value;
  const ageFilter = ageSel.value;             // "all" or "9-10"

  const attSnap = await getDocs(collection(db,'attendance'));

  const swimmers={}, dayMap={}, practiceSet=new Set(), extras=new Set();

  attSnap.forEach(doc=>{
    const [dStr, sess] = doc.id.split('_');           // 2025-06-10_AM
    if(dStr < start || dStr > end) return;

    const key=`${dStr}_${sess}`;
    practiceSet.add(key);
    dayMap[key] ??= {present:0,total:0};

    Object.entries(doc.data()).forEach(([name,status])=>{
      const ageGrp = ageMap[name] || '';
      if(ageFilter!=='all' && ageGrp!==ageFilter) return;

      swimmers[name] ??= {present:0,absent:0,unsure:0,ageGrp,dates:{}};
      swimmers[name][status]+=1;
      swimmers[name].dates[key]=status;

      if(status==='present') dayMap[key].present += 1;
      dayMap[key].total += 1;

      if(!(name in ageMap)) extras.add(name);
    });
  });

  /* KPI: practices, team %, swimmer count */
  const practices = practiceSet.size;
  const present   = Object.values(dayMap).reduce((s,d)=>s+d.present,0);
  const pctTeam   = practices
        ? Math.round(present*100/Object.values(dayMap)
                .reduce((s,d)=>s+d.total,0))
        : 0;

  teamPct.textContent = pctTeam+' %';
  sessTot.textContent = practices;

  const rosterNames = Object.entries(ageMap)
        .filter(([,g])=>ageFilter==='all'||g===ageFilter)
        .map(([n])=>n);
  swimTot.textContent = rosterNames.length;

  const hitters = Object.values(swimmers).filter(s=>s.present>=WEEK_GOAL).length;
  goalHit.textContent = hitters;

  if(extras.size) console.warn('Names not in roster:', [...extras]);

  /* Trend */
  const labels=[...practiceSet].sort();
  trendChart.data.labels = labels;
  trendChart.data.datasets[0].data =
      labels.map(k=>Math.round(dayMap[k].present*100/dayMap[k].total));
  trendChart.update();

     /* Table */
    tbody.innerHTML = '';

    Object.entries(swimmers)
      .sort((aEntry, bEntry) => {
        const [nameA, sA] = aEntry;
        const [nameB, sB] = bEntry;

        // 1) Compare Percentage present (descending)
        const totalA = sA.present + sA.absent + sA.unsure;
        const totalB = sB.present + sB.absent + sB.unsure;
        const percA = totalA ? sA.present / totalA : 0;
        const percB = totalB ? sB.present / totalB : 0;
        if (percB !== percA) {
          return percB - percA;
        }

        // 2) Percentages tie → compare age groups (youngest → oldest).
        //    We assume age groups are strings like "9-10", "11-12", etc.
        //    Extract the lower number before the dash:
        function parseAgeGroup(str) {
          // If empty or non-parsable, put at the end
          const parts = String(str).split('-');
          const n = parseInt(parts[0], 10);
          return isNaN(n) ? Infinity : n;
        }
        const ageA = parseAgeGroup(sA.ageGrp);
        const ageB = parseAgeGroup(sB.ageGrp);
        if (ageA !== ageB) {
          return ageA - ageB;  // younger (smaller number) comes first
        }

        // 3) Age groups tie → alphabetical by swimmer name (A→Z)
        return nameA.localeCompare(nameB);
      })
      .forEach(([name, s]) => {
        const total = s.present + s.absent + s.unsure;
        const percent = total ? Math.round(s.present * 100 / total) : 0;
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${name}</td>
          <td>${s.ageGrp}</td>
          <td>${percent}%</td>
          <td>${s.present}</td>
          <td>${s.absent}</td>
          <td>${s.unsure}</td>`;
        if (s.present >= WEEK_GOAL) tr.classList.add('goal');
        tr.onclick = () => openModal(name, s);
        tbody.appendChild(tr);
      });
}

/* Modal */
function openModal(name,s){
  modalTit.textContent=name;
  modalBody.innerHTML='';
  Object.entries(s.dates).sort().forEach(([k,st])=>{
    const r=document.createElement('tr');
    r.innerHTML=`<td>${k}</td><td>${st}</td>`;
    modalBody.appendChild(r);
  });
  modal.classList.add('show');
}

/* ---------- attach events AFTER refresh exists ---------- */
refreshBtn.onclick = refresh;
weekSel.onchange   = e=>{
  if(e.target.value==='current') setCurrentWeek();
  else{
    const [s,eD]=weekToRange(+e.target.value);
    fromDate.value=s; toDate.value=eD;
  }
  refresh();
};
ageSel.onchange = refresh;   // optional live update
}
