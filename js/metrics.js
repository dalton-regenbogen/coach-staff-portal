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
const csvBtn     = $('#csvBtn');

const teamPct       = $('#teamPct');
const sessTotal     = $('#sessTotal');
const swimmersTotal = $('#swimmersTotal');

const detailBody = $('#detailTable tbody');
const modal       = $('#modal');
const modalTitle  = $('#modalTitle');
const modalBody   = $('#modalTable tbody');

/* ---------- Default date range (last 30 days) ---------- */
const today = new Date().toISOString().split('T')[0];
const thirtyAgo = new Date(Date.now() - 29*864e5).toISOString().split('T')[0];
fromDate.value = thirtyAgo;
toDate.value   = today;

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

/* ---------- Event hooks ---------- */
refreshBtn.onclick = refresh;
csvBtn    .onclick = exportCSV;

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

/* ---------- CSV export ---------- */
function exportCSV(){
  let csv = 'Name,Age Group,Present,Absent,Unsure\n';
  detailBody.querySelectorAll('tr').forEach(tr=>{
    const c = tr.children;
    csv += `${c[0].textContent},${c[1].textContent},${c[3].textContent},${c[4].textContent},${c[5].textContent}\n`;
  });
  const blob = new Blob([csv],{ type:'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href=url; a.download='attendance_stats.csv'; a.click();
  URL.revokeObjectURL(url);
}
}