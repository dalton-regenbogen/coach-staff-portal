import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection,
  doc,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Age groups to display
const AGE_GROUPS = ["8U", "9-10", "11-12", "13-14", "15-18"];
let currentMeetId = null;
let unsubscribeNotes = null;

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  initMeetsNotesPage();
});

function initMeetsNotesPage() {
  const meetSelect = document.getElementById("meetSelect");
  if (!meetSelect) return;

  // Populate meets dropdown
  (async () => {
    const eventsCol = collection(db, "events");
    const q = query(eventsCol, orderBy("date", "asc"));
    const snap = await getDocs(q);
    snap.forEach(docSnap => {
      const ev = docSnap.data();
      const opt = document.createElement("option");
      opt.value = docSnap.id;
      const dateStr = ev.date.toDate().toLocaleDateString(undefined, {
        month: "short", day: "numeric", year: "numeric"
      });
      opt.textContent = `${ev.title || "Meet"} – ${dateStr}`;
      meetSelect.appendChild(opt);
    });
  })();

  meetSelect.addEventListener("change", (e) => {
    currentMeetId = e.target.value;
    clearAllGroups();
    if (unsubscribeNotes) {
      unsubscribeNotes();
      unsubscribeNotes = null;
    }
    if (currentMeetId) {
      renderGroupTemplates();
      subscribeToNotes(currentMeetId);
    }
  });
}

function clearAllGroups() {
  document.getElementById("groupsWrapper").innerHTML = "";
}

function renderGroupTemplates() {
  const wrapper = document.getElementById("groupsWrapper");
  AGE_GROUPS.forEach(group => {
    const section = document.createElement("div");
    section.className = "age-group";
    section.dataset.group = group;
    section.innerHTML = `
      <h4>${group}${group === '' ? '8 & Under' : ''}</h4>
      <table class="notes-table">
        <thead>
          <tr>
            <th>Swimmer Name</th>
            <th>ADD</th>
            <th>OUT</th>
            <th></th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
      <button class="add-row-btn" data-group="${group}">+ Add Row</button>
    `;
    wrapper.appendChild(section);

    section.querySelector(".add-row-btn")
      .addEventListener("click", () => addNoteDoc(group));
  });
}

function subscribeToNotes(meetId) {
  const notesCol = collection(db, "events", meetId, "notes");
  const q = query(notesCol, orderBy("createdAt", "asc"));
  unsubscribeNotes = onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach(change => {
      const noteId = change.doc.id;
      const data = change.doc.data();
      if (change.type === "added") {
        const tbody = document.querySelector(`.age-group[data-group="${data.group}"] tbody`);
        if (tbody && !tbody.querySelector(`tr[data-note-id="${noteId}"]`)) {
          const tr = createRowElement(noteId, data);
          tbody.appendChild(tr);
        }
      } else if (change.type === "modified") {
        const tr = document.querySelector(`tr[data-note-id="${noteId}"]`);
        if (tr) {
          const inputs = tr.querySelectorAll("input");
          const activeEl = document.activeElement;
          const editing = Array.from(inputs).some(inp => inp === activeEl);
          if (!editing) {
            inputs[0].value = data.name || "";
            inputs[1].value = data.add || "";
            inputs[2].value = data.out || "";
          }
          const currentGroup = tr.closest('.age-group').dataset.group;
          if (currentGroup !== data.group) {
            const newTbody = document.querySelector(`.age-group[data-group="${data.group}"] tbody`);
            if (newTbody) newTbody.appendChild(tr);
            tr.dataset.group = data.group;
          }
        }
      } else if (change.type === "removed") {
        const tr = document.querySelector(`tr[data-note-id="${noteId}"]`);
        if (tr && tr.parentNode) tr.parentNode.removeChild(tr);
      }
    });
  });
}

async function addNoteDoc(group) {
  if (!currentMeetId) return;
  const notesCol = collection(db, "events", currentMeetId, "notes");
  await addDoc(notesCol, {
    group,
    name: '',
    add: '',
    out: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

function createRowElement(noteId, { group, name = '', add = '', out = '' }) {
  const tr = document.createElement("tr");
  tr.dataset.noteId = noteId;
  tr.dataset.group = group;

  [name, add, out].forEach((val, idx) => {
    const td = document.createElement("td");
    const input = document.createElement("input");
    input.type = "text";
    input.value = val;
    input.className = "notes-input";
    input.addEventListener("blur", () => updateNote(noteId, tr));
    td.appendChild(input);
    tr.appendChild(td);
  });

  const delTd = document.createElement("td");
  const delBtn = document.createElement("button");
  delBtn.textContent = 'X';
  delBtn.className = 'delete-row-btn';
  delBtn.addEventListener("click", () => deleteNote(noteId));
  delTd.appendChild(delBtn);
  tr.appendChild(delTd);

  return tr;
}

async function updateNote(noteId, tr) {
  const group = tr.dataset.group;
  const cells = tr.querySelectorAll("input");
  const data = {
    group,
    name: cells[0].value.trim(),
    add:  cells[1].value.trim(),
    out:  cells[2].value.trim(),
    updatedAt: serverTimestamp()
  };
  const noteRef = doc(db, "events", currentMeetId, "notes", noteId);
  await updateDoc(noteRef, data);
}

async function deleteNote(noteId) {
  const noteRef = doc(db, "events", currentMeetId, "notes", noteId);
  await deleteDoc(noteRef);
}