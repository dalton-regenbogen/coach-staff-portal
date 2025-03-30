document.addEventListener("DOMContentLoaded", function() {
  const form = document.getElementById("loginForm");
  const errorMsg = document.getElementById("errorMsg");

  form.addEventListener("submit", function(e) {
    e.preventDefault(); // Prevent page refresh
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    
    // Hard-coded credentials for demo purposes
    if (username === "user" && password === "pass") {
      sessionStorage.setItem("loggedIn", "true");
      sessionStorage.setItem("username", username);
      window.location.href = "index.html";
    } else {
      errorMsg.textContent = "Invalid credentials! Please try again.";
      errorMsg.style.color = "red";
    }
  });
});
