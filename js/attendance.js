// Ensure the script is loading
console.log("attendance.js is loaded!");

// Function to populate the attendance table
function populateAttendanceTable(swimmerNames = []) {
    console.log("populateAttendanceTable is now defined!");
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
});

// CSV Upload Function
document.getElementById("uploadCsv").addEventListener("click", function () {
    const fileInput = document.getElementById("csvFile");
    const message = document.getElementById("uploadMessage");

    if (!fileInput.files.length) {
        message.textContent = "Please select a CSV file.";
        message.style.color = "red";
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function (event) {
        const csvData = event.target.result.trim();
        console.log("CSV Data Loaded:", csvData);
        const rows = csvData.split("\n");
        let swimmerNames = [];

        rows.forEach(row => {
            let name = row.trim();
            if (name) swimmerNames.push(name);
        });

        console.log("Parsed Names:", swimmerNames);

        if (swimmerNames.length === 0) {
            message.textContent = "CSV file appears empty or incorrect format.";
            message.style.color = "red";
            return;
        }

        // Save swimmer names in localStorage
        localStorage.setItem("swimmers", JSON.stringify(swimmerNames));

        // Update the attendance table
        populateAttendanceTable(swimmerNames);

        message.textContent = "Swimmers imported successfully!";
        message.style.color = "green";
    };

    reader.onerror = function () {
        console.error("Error reading file");
        message.textContent = "Error reading file.";
        message.style.color = "red";
    };

    reader.readAsText(file);
});

// Save attendance records by date
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

    // Retrieve existing attendance records
    let allAttendance = JSON.parse(localStorage.getItem("attendance")) || {};
    allAttendance[date] = attendanceData; // Store by date

    localStorage.setItem("attendance", JSON.stringify(allAttendance));

    message.textContent = "Attendance saved for " + date + "!";
    message.style.color = "green";
});

// View past attendance
document.getElementById("viewAttendance").addEventListener("click", function () {
  const attendanceHistoryDiv = document.getElementById("attendanceHistory");
  const allAttendance = JSON.parse(localStorage.getItem("attendance")) || {};

  // Get the selected date range
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;

  if (!startDate && !endDate) {
      attendanceHistoryDiv.innerHTML = "<p>Please select a date range.</p>";
      return;
  }

  attendanceHistoryDiv.innerHTML = "<h3>Attendance Summary</h3>";

  let totalSessions = 0;
  let totalPresent = {};
  let totalPossible = {};

  // Initialize attendance counters
  const storedSwimmers = JSON.parse(localStorage.getItem("swimmers")) || [];
  storedSwimmers.forEach(name => {
      totalPresent[name] = 0;
      totalPossible[name] = 0;
  });

  // Loop through all attendance records
  for (const [date, records] of Object.entries(allAttendance)) {
      // Check if the date falls within the selected range
      if (
          (startDate && date < startDate) ||
          (endDate && date > endDate)
      ) {
          continue;
      }

      totalSessions++;

      records.forEach(record => {
          totalPossible[record.name]++;
          if (record.present) {
              totalPresent[record.name]++;
          }
      });
  }

  // Calculate and display percentages
  let summaryTable = `<table><tr><th>Swimmer</th><th>Attendance (%)</th></tr>`;
  storedSwimmers.forEach(name => {
      const percentage = totalPossible[name] > 0 
          ? ((totalPresent[name] / totalPossible[name]) * 100).toFixed(2)
          : 0;
      summaryTable += `
          <tr>
              <td>${name}</td>
              <td>${percentage}%</td>
          </tr>`;
  });
  summaryTable += `</table>`;

  attendanceHistoryDiv.innerHTML += summaryTable;
});