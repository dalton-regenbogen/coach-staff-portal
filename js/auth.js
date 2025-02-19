document.getElementById("login-form").addEventListener("submit", function(event) {
  event.preventDefault(); // Prevent form submission

  let email = document.getElementById("email").value;
  let password = document.getElementById("password").value;
  let message = document.getElementById("login-message");

  // Fake login check (replace with real authentication later)
  if (email === "coach@example.com" && password === "password123") {
      message.textContent = "Login successful! Redirecting...";
      message.style.color = "green";

      // Simulate redirection to a protected page
      setTimeout(() => {
          window.location.href = "staff.html"; // Redirect to Staff Resources page
      }, 1500);
  } else {
      message.textContent = "Invalid email or password.";
      message.style.color = "red";
  }
});
