// best-times.js

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection,
  doc,
  setDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// In-memory store
let bestTimes = [];

// Sorting state
let currentSortField = 'rank';
const sortAsc = { rank: true, best_time_raw: true };

// Require login
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  await loadExistingData();
  initBestTimesPage();
});

/**
 * Load existing best times from Firestore
 */
async function loadExistingData() {
  try {
    const snap = await getDocs(collection(db, "best_times"));
    bestTimes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    populateAgeOptions();
    populateEventOptions();
    filterAndRender();
  } catch (err) {
    console.error("Error loading best times:", err);
  }
}

/**
 * Handle CSV upload
 */
async function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  parseAndUploadCSV(text);
}

/**
 * Parse CSV, normalize age_group, compute fields, and write to Firestore
 */
function parseAndUploadCSV(text) {
  const lines = text.trim().split("\n");
  const headers = lines.shift().split(",").map(h => h.trim());

  bestTimes = lines.map(line => {
    const cols = line.split(',').map(c => c.trim());
    const row = {};
    headers.forEach((h, i) => row[h] = cols[i]);

    // Normalize age_group and derive gender
    let rawAge = row["Age Group"];
    const age_group = rawAge
      .replace(/womens?/gi, "Girls")
      .replace(/men/gi, "Boys");
    const gender = age_group.toLowerCase().includes("girls") ? "F" : "M";

    const [first_name, ...rest] = row["Name"].split(' ');
    const last_name = rest.join(' ');

    const [distanceStr, ...strokeParts] = row["Event"].split(' ');
    const distance = Number(distanceStr);
    const stroke = strokeParts.join(' ');

    const rawStr = row["Best Time"].replace(/S$/i, '');
    const best_time_raw = rawStr.includes(':')
      ? parseFloat(rawStr.split(':')[0]) * 60 + parseFloat(rawStr.split(':')[1])
      : parseFloat(rawStr);

    const meet_date = new Date(row["Date"]).toISOString().slice(0, 10);

    const cleaned = {
      age_group,
      event:       row["Event"],
      rank:        Number(row["Rank"]),
      best_time:   rawStr,
      first_name,
      last_name,
      gender,
      distance,
      stroke,
      best_time_raw,
      meet_date,
      swim_meet:   row["Swim Meet"]
    };

    const docId = `${first_name}_${last_name}_${row["Event"].replace(/\s+/g,'_')}`;
    setDoc(doc(db, "best_times", docId), cleaned)
      .catch(err => console.error("Error writing doc:", err));

    return cleaned;
  });

  populateAgeOptions();
  populateEventOptions();
  filterAndRender();
}

/**
 * Helper to extract starting number for sorting age groups
 */
function extractStartNum(group) {
  const m = group.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

/**
 * Populate Age Group dropdown: Boys (young→old) then Girls (young→old)
 */
function populateAgeOptions() {
  const sel = document.getElementById('filter-age-group');
  const unique = [...new Set(bestTimes.map(bt => bt.age_group))];
  const boys = unique
    .filter(g => g.startsWith('Boys'))
    .sort((a, b) => extractStartNum(a) - extractStartNum(b));
  const girls = unique
    .filter(g => g.startsWith('Girls'))
    .sort((a, b) => extractStartNum(a) - extractStartNum(b));

  sel.innerHTML = '<option value="">All</option>';
  [...boys, ...girls].forEach(g => sel.append(Object.assign(new Option(g, g))));
}

/**
 * Populate Event dropdown based on selected age group
 */
function populateEventOptions() {
  const age = document.getElementById('filter-age-group').value;
  let evs = [...new Set(bestTimes.map(bt => bt.event))];
  if (age) {
    evs = [...new Set(
      bestTimes.filter(bt => bt.age_group === age).map(bt => bt.event)
    )];
  }
  const sel = document.getElementById('filter-event');
  sel.innerHTML = '<option value="">All</option>';
  evs.forEach(e => sel.append(Object.assign(new Option(e, e))));
}

/**
 * Filter by name, age_group, event; then group or sort and render
 */
function filterAndRender() {
  const nameQ = document.getElementById('search-name').value.toLowerCase();
  const ageVal = document.getElementById('filter-age-group').value;
  const evt    = document.getElementById('filter-event').value;

  let data = bestTimes.filter(bt =>
    (!nameQ || `${bt.first_name} ${bt.last_name}`.toLowerCase().includes(nameQ)) &&
    (!ageVal || bt.age_group === ageVal) &&
    (!evt    || bt.event === evt)
  );

  // Initial/all view: group by Boys→Girls, then age, then event
  if (!nameQ && !ageVal && !evt) {
    const grouped = [];
    ['Boys', 'Girls'].forEach(prefix => {
      const ages = [...new Set(
        data.filter(d => d.age_group.startsWith(prefix)).map(d => d.age_group)
      )].sort((a, b) => extractStartNum(a) - extractStartNum(b));

      ages.forEach(ageGroup => {
        const events = [...new Set(
          data.filter(d => d.age_group === ageGroup).map(d => d.event)
        )].sort();

        events.forEach(ev => {
          grouped.push(
            ...data.filter(d => d.age_group === ageGroup && d.event === ev)
                   .sort((a, b) => a.best_time_raw - b.best_time_raw)
          );
        });
      });
    });
    data = grouped;
  }
  // If only age selected: group by event within that age
  else if (ageVal && !evt) {
    const grouped = [];
    [...new Set(data.map(d => d.event))].sort().forEach(ev => {
      grouped.push(
        ...data.filter(d => d.event === ev)
              .sort((a, b) => a.best_time_raw - b.best_time_raw)
      );
    });
    data = grouped;
  }
  // Otherwise standard sort
  else {
    data.sort((a, b) =>
      sortAsc[currentSortField]
        ? a[currentSortField] - b[currentSortField]
        : b[currentSortField] - a[currentSortField]
    );
  }

  renderTable(data);
}

/**
 * Toggle sort field/direction
 */
function sortBy(field) {
  if (currentSortField === field) {
    sortAsc[field] = !sortAsc[field];
  } else {
    currentSortField = field;
  }
  filterAndRender();
}

/**
 * Render table with split and bottom-border between events
 */
function renderTable(data) {
  const splitVal = parseInt(document.getElementById('global-split').value) || 1;
  const tbody = document.getElementById('times-body');
  tbody.innerHTML = '';

  data.forEach((bt, i) => {
    const sec = bt.best_time_raw / splitVal;
    const display = sec >= 60
      ? `${Math.floor(sec / 60)}:${(sec % 60).toFixed(2).padStart(5, '0')}`
      : sec.toFixed(2);

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50';

    // Add a bottom border if next row is a new event or we're at end
    const next = data[i + 1];
    if (!next || next.event !== bt.event) {
      tr.classList.add('event-separator');
    }

    tr.innerHTML = `
      <td class="px-4 py-2">${bt.rank}</td>
      <td class="px-4 py-2 text-blue-600 cursor-pointer name-cell">
        ${bt.first_name} ${bt.last_name}
      </td>
      <td class="px-4 py-2">${bt.age_group}</td>
      <td class="px-4 py-2">${bt.event}</td>
      <td class="px-4 py-2">${display}</td>
    `;
    tr.querySelector('.name-cell').addEventListener('click', () => showModal(bt));
    tbody.append(tr);
  });
}

/**
 * Show swimmer details in modal
 */
function showModal(bt) {
  const modal = document.getElementById('modal');
  const body  = document.getElementById('modal-body');
  body.innerHTML = '';

  bestTimes
    .filter(x => x.first_name === bt.first_name && x.last_name === bt.last_name)
    .forEach(x => {
      const t = x.best_time.includes(':') ? x.best_time : x.best_time_raw.toFixed(2);
      const div = document.createElement('div');
      div.textContent = `${x.event} — ${t} on ${x.meet_date} @ ${x.swim_meet}`;
      body.append(div);
    });

  modal.classList.remove('hidden');
}

/**
 * Close the modal
 */
function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}
window.closeModal = closeModal;

/**
 * Wire up UI event listeners
 */
function initBestTimesPage() {
  document.getElementById('csv-file').addEventListener('change', handleFileUpload);
  document.getElementById('search-name').addEventListener('input', filterAndRender);
  document.getElementById('filter-age-group').addEventListener('change', () => {
    populateEventOptions();
    filterAndRender();
  });
  document.getElementById('filter-event').addEventListener('change', filterAndRender);
  document.getElementById('global-split').addEventListener('change', filterAndRender);
  document.getElementById('th-rank').addEventListener('click', () => sortBy('rank'));
  document.getElementById('th-time').addEventListener('click', () => sortBy('best_time_raw'));
}
