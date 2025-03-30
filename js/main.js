document.addEventListener("DOMContentLoaded", function() {
  // Check if the user is logged in
  if (sessionStorage.getItem("loggedIn") === "true") {
    // Show navlinks by removing the "hidden" class
    document.querySelector('.nav-links').classList.remove('hidden');
    
    document.querySelector('.logout').classList.remove('hidden');
    // Optionally, hide the login button if the user is logged in
    document.querySelector('.login').style.display = "none";
  } else {
    // Ensure navlinks remain hidden if not logged in
    document.querySelector('.nav-links').classList.add('hidden');
  }
});

// Add a function to log out
function logout() {
  sessionStorage.removeItem("loggedIn");
  sessionStorage.removeItem("username");
  // Reload the page or redirect to login page
  window.location.href = "login.html";
}