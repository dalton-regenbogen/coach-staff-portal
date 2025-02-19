document.addEventListener("DOMContentLoaded", function () {
  const swimmerNames = ["Swimmer 1", "Swimmer 2", "Swimmer 3", "Swimmer 4"];
  const tableBody = document.getElementById("attendance-body");
  const saveButton = document.getElementById("save-attendance");
  const message = document.getElementById("attendance-message");

  // Populate table with swimmers
  function populateAttendanceTable(swimmerNames = []) {
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


  // Save attendance data (temporarily in localStorage)
  saveButton.addEventListener("click", function () {
    const date = document.getElementById("date").value;
    if (!date) {
        message.textContent = "Please select a date.";
        message.style.color = "red";
        return;
    }

    const checkboxes = document.querySelectorAll(".attendance-check");
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

  document.getElementById("viewAttendance").addEventListener("click", function () {
    const attendanceHistoryDiv = document.getElementById("attendanceHistory");
    const allAttendance = JSON.parse(localStorage.getItem("attendance")) || {};
    
    if (Object.keys(allAttendance).length === 0) {
        attendanceHistoryDiv.innerHTML = "<p>No attendance records found.</p>";
        return;
    }

    attendanceHistoryDiv.innerHTML = "<h3>Past Attendance Records</h3>";

    for (const [date, records] of Object.entries(allAttendance)) {
        let table = `<h4>${date}</h4><table><tr><th>Swimmer</th><th>Present</th></tr>`;
        
        records.forEach(record => {
            table += `<tr>
                        <td>${record.name}</td>
                        <td>${record.present ? "✔️" : "❌"}</td>
                      </tr>`;
        });

        table += "</table>";
        attendanceHistoryDiv.innerHTML += table;
    }
  });

});

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
      const csvData = event.target.result;
      const rows = csvData.split("\n");
      let swimmerNames = [];

      rows.forEach(row => {
          let name = row.trim();
          if (name) swimmerNames.push(name);
      });

      // Save swimmer names in localStorage
      localStorage.setItem("swimmers", JSON.stringify(swimmerNames));

      // Update the attendance table
      populateAttendanceTable(swimmerNames);

      message.textContent = "Swimmers imported successfully!";
      message.style.color = "green";
  };

  reader.readAsText(file);
});

