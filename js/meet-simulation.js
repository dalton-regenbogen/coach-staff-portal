// meet-simulation.js

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection,
  doc,
  writeBatch,
  onSnapshot,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// === Enable IndexedDB persistence ===
enableIndexedDbPersistence(db).catch(err => {
  console.warn("IndexedDB persistence failed:", err);
});

// === State ===
let fullData = [];
let filteredData = [];
let sortConfig = { key: "Time", direction: "asc" };

// Team colors mapping
const teamColors = {
  // "BRH": "#ef4444",
  // "WEL": "#3b82f6",
};

// === DOM refs ===
const fileInput        = document.getElementById("fileInput");
const uploadButton     = document.getElementById("uploadButton");
const resetButton      = document.getElementById("resetButton");
const uploadStatus     = document.getElementById("uploadStatus");
const uploadBar        = document.getElementById("uploadBar");
const uploadText       = document.getElementById("uploadText");
const teamCheckboxes   = document.getElementById("teamCheckboxes");
const genderFilter     = document.getElementById("genderFilter");
const ageGroupFilter   = document.getElementById("ageGroupFilter");
const eventFilter      = document.getElementById("eventFilter");
const swimmerListDiv   = document.getElementById("swimmerList");
const resultsTableBody = document.getElementById("resultsTableBody");
const summaryListDiv   = document.getElementById("summaryList");

// === Utility ===
function parseTime(str) {
  const parts = str.split(":").map(p => p.trim());
  return parts.length === 2
    ? parseInt(parts[0], 10) * 60 + parseFloat(parts[1])
    : parseFloat(str);
}

function cleanRow(raw) {
  const event    = raw.Event.trim();
  const place    = parseInt(raw.Place, 10) || 0;
  const time     = raw.Time.trim();
  const time_raw = parseTime(time);
  const name     = raw.Name.trim();
  const [ first_name, ...rest ] = name.split(/\s+/);
  const last_name = rest.join(" ");
  const team_abbr = raw.Team_ABBR.trim();
  const age       = raw.Age.trim();
  const meet      = raw.Meet.trim();
  const rd        = new Date(raw.Date);
  const date      = isNaN(rd.getTime())
                    ? raw.Date.trim()
                    : rd.toISOString().split("T")[0];
  const tokens    = event.split(" ");
  const gender    = tokens[0];
  const distance  = parseInt(tokens[tokens.length - 2], 10) || 0;
  const stroke    = tokens[tokens.length - 1];
  const age_group = tokens.slice(1, tokens.length - 2).join(" ");
  return { event, place, time, time_raw, name,
           first_name, last_name, team_abbr,
           age, meet, date, gender, age_group,
           distance, stroke };
}

// === Firestore realtime subscription ===
function subscribeData() {
  onSnapshot(collection(db, "midseason_best_times"), snap => {
    fullData = snap.docs.map(d => d.data());
    populateFilters();
    restoreFilters();
    applyFilters();
    updatePanels();
  });
}

// === Filters UI ===
function populateFilters() {
  const savedTeams = JSON.parse(localStorage.getItem("teamFilter") || "[]");
  teamCheckboxes.innerHTML = "";
  [...new Set(fullData.map(i => i.team_abbr))].sort().forEach(team => {
    const wrapper = document.createElement("div");
    wrapper.className = "flex items-center";
    const cb = document.createElement("input");
    cb.type = "checkbox"; cb.value = team; cb.id = `team_cb_${team}`;
    cb.checked = savedTeams.includes(team);
    cb.addEventListener("change", handleFilterChange);
    const lbl = document.createElement("label");
    lbl.htmlFor = cb.id; lbl.textContent = team; lbl.className = "ml-1";
    wrapper.append(cb, lbl);
    teamCheckboxes.append(wrapper);
  });

  ageGroupFilter.innerHTML = `<option value="All">All</option>`;
  [...new Set(fullData.map(i => i.age_group))].sort().forEach(ag => {
    const opt = document.createElement("option");
    opt.value = ag; opt.textContent = ag;
    ageGroupFilter.append(opt);
  });

  eventFilter.innerHTML = `<option value="All">All</option>`;
  [...new Set(fullData.map(i => `${i.distance} ${i.stroke}`))].sort().forEach(ev => {
    const opt = document.createElement("option");
    opt.value = ev; opt.textContent = ev;
    eventFilter.append(opt);
  });
}

function saveFilters() {
  const teams = Array.from(
    teamCheckboxes.querySelectorAll("input:checked")
  ).map(cb => cb.value);
  localStorage.setItem("teamFilter", JSON.stringify(teams));
  localStorage.setItem("genderFilter",   genderFilter.value);
  localStorage.setItem("ageGroupFilter", ageGroupFilter.value);
  localStorage.setItem("eventFilter",    eventFilter.value);
}

function restoreFilters() {
  const saved = JSON.parse(localStorage.getItem("teamFilter") || "[]");
  teamCheckboxes.querySelectorAll("input[type=checkbox]").forEach(cb => {
    cb.checked = saved.includes(cb.value);
  });
  if (localStorage.getItem("genderFilter"))
    genderFilter.value = localStorage.getItem("genderFilter");
  if (localStorage.getItem("ageGroupFilter"))
    ageGroupFilter.value = localStorage.getItem("ageGroupFilter");
  if (localStorage.getItem("eventFilter"))
    eventFilter.value = localStorage.getItem("eventFilter");
}

// === Apply Filters ===
function applyFilters() {
  const teams  = Array.from(
    teamCheckboxes.querySelectorAll("input:checked")
  ).map(cb => cb.value);
  const gender = genderFilter.value;
  const ageG   = ageGroupFilter.value;
  const ev     = eventFilter.value;
  filteredData = fullData.filter(i => {
    if (teams.length && !teams.includes(i.team_abbr)) return false;
    if (gender !== "Both" && i.gender !== gender)      return false;
    if (ageG   !== "All"  && i.age_group !== ageG)     return false;
    if (ev     !== "All"  && `${i.distance} ${i.stroke}` !== ev) return false;
    return true;
  });
}

// === Render Panels ===
function updatePanels() {
  // Swimmer selector
  const swimmers = [...new Set(filteredData.map(i => `${i.first_name} ${i.last_name}`))].sort();
  const selState = JSON.parse(localStorage.getItem("swimmerSelections") || "{}");
  swimmerListDiv.innerHTML = "";
  const ctrl = document.createElement("div");
  ctrl.className = "flex space-x-2 mb-2";
  ctrl.innerHTML = `
    <button id="selectAllBtn" class="px-2 py-1 bg-blue-500 text-white rounded">Select All</button>
    <button id="clearAllBtn" class="px-2 py-1 bg-gray-500 text-white rounded">Clear All</button>`;
  swimmerListDiv.append(ctrl);
  document.getElementById("selectAllBtn").onclick = () => {
    swimmers.forEach(n => selState[n] = true);
    localStorage.setItem("swimmerSelections", JSON.stringify(selState));
    updatePanels();
  };
  document.getElementById("clearAllBtn").onclick = () => {
    swimmers.forEach(n => selState[n] = false);
    localStorage.setItem("swimmerSelections", JSON.stringify(selState));
    updatePanels();
  };
  swimmers.forEach(name => {
    const checked = selState[name] ?? true;
    const cb = document.createElement("input");
    cb.type = "checkbox"; cb.checked = checked;
    cb.id = `swimmer_${name.replace(/\s+/g, "_")}`;
    cb.onchange = () => {
      selState[name] = cb.checked;
      localStorage.setItem("swimmerSelections", JSON.stringify(selState));
      updatePanels();
    };
    const lbl = document.createElement("label");
    lbl.htmlFor = cb.id; lbl.textContent = name;
    const row = document.createElement("div");
    row.className = "flex items-center mb-1 space-x-2";
    row.append(cb, lbl);
    swimmerListDiv.append(row);
  });

  // Main results per-event ranking
  const key    = sortConfig.key === "Place" ? "place" : "time_raw";
  const sorted = [...filteredData].sort((a,b) =>
    sortConfig.direction==="asc" ? a[key]-b[key] : b[key]-a[key]
  );
  resultsTableBody.innerHTML = "";
  const active = JSON.parse(localStorage.getItem("swimmerSelections") || "{}");
  const events = [...new Set(sorted.map(i=>i.event))];

  // Build event->name->rank
  const eventRanks = {};
  events.forEach(evName => {
    eventRanks[evName] = {};
    let r = 1;
    sorted.filter(i=>i.event===evName).forEach(item => {
      const nm = `${item.first_name} ${item.last_name}`;
      if (!active[nm]) return;
      eventRanks[evName][nm] = r++;
    });
  });

  events.forEach(evName => {
    const hdr = document.createElement("tr");
    hdr.className = "bg-gray-200 font-semibold";
    const th = document.createElement("th");
    th.colSpan = 5; th.textContent = evName;
    hdr.append(th);
    resultsTableBody.append(hdr);

    let rank = 1;
    sorted.filter(i=>i.event===evName).forEach(item => {
      const nm = `${item.first_name} ${item.last_name}`;
      if (!active[nm]) return;
      const tr = document.createElement("tr");
      tr.className = "border-b";
      tr.style.backgroundColor = teamColors[item.team_abbr]||"transparent";
      [["rank",rank],["time",item.time],["name",nm],["team",item.team_abbr],["age",item.age]]
        .forEach(([,v])=>{
          const td = document.createElement("td");
          td.className = "px-2 py-1"; td.textContent = v;
          tr.append(td);
        });
      resultsTableBody.append(tr);
      rank++;
    });
  });

  // Summary only for BHST, top 3 events by main-table rank
  summaryListDiv.innerHTML = "";
  const summarySwimmers = [...new Set(
    filteredData
      .filter(i => i.team_abbr === "BHST")
      .map(i => `${i.first_name} ${i.last_name}`)
  )].filter(nm => active[nm]);

  summarySwimmers.forEach(fullName => {
    // Gather event+rank, sort, take top 3
    const top3 = events
      .map(evName => ({ evName, rank: eventRanks[evName][fullName] }))
      .filter(x => x.rank !== undefined)
      .sort((a,b) => a.rank - b.rank)
      .slice(0, 3);  // <-- now top 3

    const ctr = document.createElement("div");
    ctr.className = "mb-4";
    const h3 = document.createElement("h3");
    h3.className = "font-semibold mb-1";
    h3.textContent = fullName;
    ctr.append(h3);

    const ul = document.createElement("ul");
    top3.forEach(({evName, rank}) => {
      const li = document.createElement("li");
      li.textContent = `${evName} (Rank: ${rank})`;
      ul.append(li);
    });
    ctr.append(ul);
    summaryListDiv.append(ctr);
  });
}

// === File upload + progress ===
async function handleFileUpload() {
  const file = fileInput.files[0];
  if (!file) return alert("Select a file first.");
  const reader = new FileReader();
  reader.onload = async e => {
    let rows = [];
    if (file.name.endsWith(".csv")) {
      const lines = e.target.result.split(/\r?\n/).filter(l=>l.trim());
      const hdrs = lines[0].split(",").map(h=>h.trim());
      rows = lines.slice(1).map(l=>{
        const vals = l.split(",").map(v=>v.trim());
        return hdrs.reduce((o,h,i)=>(o[h]=vals[i]||"",o),{});
      });
    } else {
      const wb = XLSX.read(e.target.result,{type:"binary"});
      rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    }
    const cleaned = rows.map(cleanRow);
    uploadStatus.classList.remove("hidden");
    uploadButton.disabled = true;
    const total = cleaned.length;
    uploadBar.value = 0; uploadBar.max = 100;
    uploadText.textContent = `0/${total}`;
    const BATCH_SIZE = 400;
    for (let i=0; i<total; i+=BATCH_SIZE) {
      const batch = writeBatch(db);
      cleaned.slice(i,i+BATCH_SIZE).forEach(item=>{
        const id = `${item.first_name}_${item.last_name}_${item.event.replace(/\s+/g,"_")}_${item.team_abbr}`;
        batch.set(doc(db,"midseason_best_times",id),item);
      });
      await batch.commit();
      const done = Math.min(i+BATCH_SIZE,total);
      uploadBar.value = Math.round(done/total*100);
      uploadText.textContent = `${done}/${total}`;
    }
    uploadButton.disabled = false;
  };
  file.name.endsWith(".csv")
    ? reader.readAsText(file)
    : reader.readAsBinaryString(file);
}

// === Handlers & init ===
function handleFilterChange() {
  const cbs = Array.from(teamCheckboxes.querySelectorAll("input:checked"));
  if (cbs.length > 3) {
    cbs[cbs.length-1].checked = false;
    alert("Select up to 3 teams only.");
    return;
  }
  saveFilters(); applyFilters(); updatePanels();
}

function handleReset() {
  if (confirm("Reset all?")) {
    localStorage.clear();
    location.reload();
  }
}

function attachSorting() {
  document.querySelectorAll("th[data-sort]").forEach(th=>{
    th.onclick = () => {
      const k = th.getAttribute("data-sort");
      if (sortConfig.key===k) sortConfig.direction = sortConfig.direction==="asc"?"desc":"asc";
      else { sortConfig.key=k; sortConfig.direction="asc"; }
      updatePanels();
    };
  });
}

function initPage() {
  subscribeData();
  attachSorting();
  uploadButton.onclick   = handleFileUpload;
  resetButton.onclick    = handleReset;
  genderFilter.onchange  = handleFilterChange;
  ageGroupFilter.onchange= handleFilterChange;
  eventFilter.onchange   = handleFilterChange;
}

onAuthStateChanged(auth, user => {
  if (user) initPage();
  else      window.location.href = "/login.html";
});
