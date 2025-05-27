/* metrics.js  – ES Module (lives in /js folder) */

/* ───────────────── Firebase imports ───────────────── */
import { db, auth }      from './firebase-config.js';
import {
  collection, query, where, onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

/* ───────────────── Auth guard ─────────────────────── */
onAuthStateChanged(auth, user => {
  if (!user) { window.location.href = '/'; return; }
  initMetrics();                         // start dashboard
});

/* ───────────────── Dashboard logic ───────────────── */
function initMetrics() {

/* ---------- DOM handles ---------- */
const $ = s => document.querySelector(s);
const fromDate   = $('#fromDate');
const toDate     = $('#toDate');
const ageSelect  = $('#ageSelect');
const refreshBtn = $('#refreshBtn');
const weekSel   = $('#weekSelect');  
const teamPct       = $('#teamPct');
const sessTotal     = $('#sessTotal');
const swimmersTotal = $('#swimmersTotal');

const detailBody = $('#detailTable tbody');
const modal       = $('#modal');
const modalTitle  = $('#modalTitle');
const modalBody   = $('#modalTable tbody');

const SEASON_START = new Date('2025-05-26');   /* Monday of Week 1 – EDIT if needed */

const WEEK_GOAL = 5;

/* ---------- Trend chart (Chart.js already loaded) ---------- */
const trendChart = new Chart($('#trendChart'), {
  type : 'line',
  data : { labels: [], datasets:[{ label:'% Present', data:[] }] },
  options:{ scales:{ y:{ beginAtZero:true, max:100 } } }
});

/* ---------- Roster map (name ➜ ageGroup) ---------- */
const ageMap   = {};
let rosterReady = false;

onSnapshot(collection(db,'roster'), snap => {
  snap.forEach(doc => {
    const d = doc.data();
    ageMap[d.name] = d['age group'] || d.age || '';
  });
  rosterReady = true;
  refresh();                // refresh metrics whenever roster updates
});

/* ---------- Default date range = current week ---------- */
setCurrentWeek();                     /* NEW */

/* ---------- Event hooks ---------- */
refreshBtn.onclick = refresh;
weekSel.addEventListener('change',e=>{            /* NEW */
  if(e.target.value==='current') setCurrentWeek();
  else{
    const [s,eD]=weekToRange(+e.target.value);
    fromDate.value=s; toDate.value=eD;
  }
  refresh();
});

function weekToRange(n){                              /* NEW */
  const s=new Date(SEASON_START); s.setDate(s.getDate()+7*(n-1));
  const e=new Date(s); e.setDate(e.getDate()+6);
  return [ s.toISOString().split('T')[0], e.toISOString().split('T')[0] ];
}
function setCurrentWeek(){                            /* NEW */
  const diff=Math.floor((Date.now()-SEASON_START)/864e5);
  const wk=Math.floor(diff/7)+1;
  weekSel.value='current';
  const [s,eD]=weekToRange(wk);
  fromDate.value=s; toDate.value=eD;
}


/* ---------- Main refresh ---------- */
function refresh(){
  if (!rosterReady) return;                     // wait for roster

  const start = fromDate.value;
  const end   = toDate.value;
  const ageFilter = ageSelect.value;            // "all" or e.g. "9-10"

  const q = query(collection(db,'attendance'),
    where('date','>=',start), where('date','<=',end));

  onSnapshot(q, snap => {
    const swimmers = {};
    const dayMap   = {};

    snap.forEach(doc => {
      const { name, status, date } = doc.data();
      const ageGrp = ageMap[name] || '';

      /* apply age-group filter */
      if (ageFilter !== 'all' && ageGrp !== ageFilter) return;

      /* per-swimmer aggregate */
      swimmers[name] ??= { present:0, absent:0, unsure:0, ageGrp, dates:{} };
      swimmers[name][status] += 1;
      swimmers[name].dates[date] = status;

      /* per-day aggregate */
      dayMap[date] ??= { present:0, total:0 };
      if (status === 'present') dayMap[date].present += 1;
      dayMap[date].total += 1;
    });

    /* ---------- pad missing swimmers as 'unsure' ---------- */
    Object.entries(ageMap).forEach(([swimmer, ageGrp]) => {
      if (ageFilter !== 'all' && ageGrp !== ageFilter) return;

      /* if the swimmer has no doc for that date range, fill gaps day-by-day */
      const datesInRange = Object.keys(dayMap);
      datesInRange.forEach(d => {
        if (!swimmers[swimmer]?.dates?.[d]) {
          /* add unsure doc to swimmer aggregate */
          swimmers[swimmer] ??= { present:0, absent:0, unsure:0, ageGrp, dates:{} };
          swimmers[swimmer].unsure += 1;
          swimmers[swimmer].dates[d] = 'unsure';

          /* add to per-day totals */
          dayMap[d].total += 1;
          // present unchanged
        }
      });
    });


    // ---------- NEW: count goal hitters ----------
    const hitters = Object.values(swimmers)
    .filter(s => s.present >= WEEK_GOAL).length;
    goalHit.textContent = hitters;

    /* ---- KPI cards ---- */
    const sess = Object.values(dayMap).reduce((s,d)=>s+d.total ,0);
    const pres = Object.values(dayMap).reduce((s,d)=>s+d.present,0);
    const pct  = sess ? Math.round(pres*100/sess) : 0;

    teamPct.textContent   = pct + ' %';
    sessTotal.textContent = sess;
    swimmersTotal.textContent = Object.keys(swimmers).length;

    /* ---- Trend chart ---- */
    const labels = Object.keys(dayMap).sort();
    const data   = labels.map(d=> Math.round(dayMap[d].present*100/dayMap[d].total));
    trendChart.data.labels = labels;
    trendChart.data.datasets[0].data = data;
    trendChart.update();

    /* ---- Detail table ---- */
    detailBody.innerHTML = '';
    Object.entries(swimmers)
      .sort((a,b)=> b[1].present - a[1].present)     // rank by presents
      .forEach(([name,s])=>{
        const total = s.present + s.absent + s.unsure;
        const pPct  = total ? Math.round(s.present*100/total) : 0;

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${name}</td>
          <td>${s.ageGrp}</td>
          <td>${pPct}%</td>
          <td>${s.present}</td><td>${s.absent}</td><td>${s.unsure}</td>`;

          if (s.present >= WEEK_GOAL) tr.classList.add('goal');     // NEW

        tr.onclick = () => openModal(name,s);
        detailBody.appendChild(tr);
      });
  });
}

/* ---------- Drill-down modal ---------- */
function openModal(name,s){
  modalTitle.textContent = name;
  modalBody.innerHTML = '';
  Object.entries(s.dates)
    .sort()
    .forEach(([d,st])=>{
      const row = document.createElement('tr');
      row.innerHTML = `<td>${d}</td><td>${st}</td>`;
      modalBody.appendChild(row);
    });
  modal.classList.add('show');
}
}