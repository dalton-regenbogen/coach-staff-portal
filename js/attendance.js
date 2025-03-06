// Import Firebase modules
import { getDatabase, ref, set, get, onValue } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

// Ensure the script is loading
console.log("attendance.js is loaded!");

// Function to populate the attendance table
function populateAttendanceTable(swimmerNames = []) {
    console.log("Populating Attendance Table:", swimmerNames);
    const tableBody = document.getElementById("attendance-body");
    tableBody.innerHTML = ""; // Clear existing rows

    swimmerNames.forEach(name => {
        let row = document.createElement("tr");
        row.innerHTML = `
            <td>${name}</td>
            <td><input type="checkbox" class="attendance-check"></td>
        `;
        tableBody.appendChild(row);
    });
}

// Load stored swimmers on page load
document.addEventListener("DOMContentLoaded", function () {
    const storedSwimmers = JSON.parse(localStorage.getItem("swimmers")) || [];
    populateAttendanceTable(storedSwimmers);
}


    // Sync attendance in real-time
    // Real-Time Attendance Viewer with Debugging Logs
function syncAttendanceTable() {
    const attendanceHistoryDiv = document.getElementById("attendanceHistory");
    const db = getDatabase();
    const attendanceRef = ref(db, 'attendance');

    // Listen for changes in the attendance node
    onValue(attendanceRef, (snapshot) => {
        console.log("🔥 onValue Triggered: Attendance data changed!");

        const allAttendance = snapshot.val();
        console.log("📊 Fetched Attendance Data:", allAttendance);

        attendanceHistoryDiv.innerHTML = "<h3>Real-Time Attendance Records</h3>";

        if (!allAttendance) {
            console.log("ℹ️ No attendance records found.");
            attendanceHistoryDiv.innerHTML += "<p>No attendance records found.</p>";
            return;
        }

        // Rebuild the attendance table dynamically
        for (const [key, value] of Object.entries(allAttendance)) {
            let table = `<h4>${value.date} - ${value.coachID}</h4><table><tr><th>Swimmer</th><th>Present</th></tr>`;
            value.records.forEach(record => {
                table += `<tr>
                            <td>${record.name}</td>
                            <td>${record.present ? "✔️" : "❌"}</td>
                          </tr>`;
            });

            table += "</table>";
            attendanceHistoryDiv.innerHTML += table;
        }
    }, (error) => {
        console.error("❌ Error listening to attendance changes:", error);
    });
}


// Save attendance records to Firebase
document.getElementById("save-attendance").addEventListener("click", function () {
    const date = document.getElementById("date").value;
    const message = document.getElementById("attendance-message");

    if (!date) {
        message.textContent = "Please select a date.";
        message.style.color = "red";
        return;
    }

    const checkboxes = document.querySelectorAll(".attendance-check");
    const storedSwimmers = JSON.parse(localStorage.getItem("swimmers")) || [];
    let attendanceData = [];

    checkboxes.forEach((checkbox, index) => {
        attendanceData.push({
            name: storedSwimmers[index],
            present: checkbox.checked
        });
    });

    // Create a unique key: date-coachID (assuming each coach has a unique ID)
    const coachID = "coach1"; // We can make this dynamic later
    const attendanceKey = `${date}-${coachID}`;

    // Save to Firebase
    const db = getDatabase();
    set(ref(db, 'attendance/' + attendanceKey), {
        date: date,
        coachID: coachID,
        records: attendanceData,
        timestamp: new Date().toISOString()
    }).then(() => {
        message.textContent = "Attendance saved for " + date + "!";
        message.style.color = "green";
    }).catch((error) => {
        console.error("Error saving attendance:", error);
        message.textContent = "Error saving attendance.";
        message.style.color = "red";
    });
});

// Real-Time Attendance Viewer
function syncAttendanceTable() {
    const attendanceHistoryDiv = document.getElementById("attendanceHistory");
    const db = getDatabase();
    const attendanceRef = ref(db, 'attendance');

    // Listen for changes in the attendance node
    onValue(attendanceRef, (snapshot) => {
        const allAttendance = snapshot.val();
        attendanceHistoryDiv.innerHTML = "<h3>Real-Time Attendance Records</h3>";

        if (!allAttendance) {
            attendanceHistoryDiv.innerHTML += "<p>No attendance records found.</p>";
            return;
        }

        // Rebuild the attendance table dynamically
        for (const [key, value] of Object.entries(allAttendance)) {
            let table = `<h4>${value.date} - ${value.coachID}</h4><table><tr><th>Swimmer</th><th>Present</th></tr>`;
            value.records.forEach(record => {
                table += `<tr>
                            <td>${record.name}</td>
                            <td>${record.present ? "✔️" : "❌"}</td>
                          </tr>`;
            });

            table += "</table>";
            attendanceHistoryDiv.innerHTML += table;
        }
    }, (error) => {
        console.error("Error listening to attendance changes:", error);
    });
}
