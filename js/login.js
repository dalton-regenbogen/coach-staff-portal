// login.js
import { auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/9.21.0/firebase-auth.js";

function getFriendlyErrorMessage(error) {
  switch (error.code) {
    // Use a generic message for both wrong-password and user-not-found
    case "auth/invalid-login-credentials":
    case "auth/user-not-found":
      return "Incorrect email or password. Please try again.";
    case "auth/invalid-email":
      return "The email address is not valid.";
    case "auth/too-many-requests":
      return "Too many login attempts. Please try again later.";
    default:
      return "An error occurred: " + error.message;
  }
}


document.addEventListener("DOMContentLoaded", function() {
  console.log("Login page loaded.");

  // Get the elements from the DOM
  const loginForm = document.getElementById("loginForm");
  const errorMsg = document.querySelector(".loginForm__errorMessage");
  const forgotPasswordLink = document.getElementById("forgetPassword");

  // Listen for form submission. This will trigger when the user hits Enter or clicks the submit button.
  loginForm.addEventListener("submit", function(e) {
    e.preventDefault(); // Prevent the default form submission behavior

    errorMsg.textContent = ""; // Clear previous error message

    // Retrieve the values from the inputs
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const remember = document.getElementById("remember__box").checked;

    // Set persistence based on the checkbox: local persistence if "Remember Me" is checked; session persistence if not.
    const persistence = remember ? browserLocalPersistence : browserSessionPersistence;

    // Set Firebase persistence and then sign in
    setPersistence(auth, persistence)
      .then(() => {
        return signInWithEmailAndPassword(auth, email, password);
      })
      .then((userCredential) => {
        console.log("Login successful:", userCredential.user.email);
        // Redirect to index.html on successful login
        window.location.href = "homepage.html";
      })
      .catch((error) => {
        console.error("Login error:", error);
        console.log("Error code:", error.code);
        console.log("Error message:", error.message);
        errorMsg.textContent = getFriendlyErrorMessage(error);
      });
  });

  // Implement "Forgot Password" functionality.
  forgotPasswordLink.addEventListener("click", function(e) {
    e.preventDefault();
    const email = document.getElementById("email").value;
    if (!email) {
      alert("Please enter your email address first.");
      return;
    }
    sendPasswordResetEmail(auth, email)
      .then(() => {
        alert("Password reset email sent! Check your inbox.");
      })
      .catch((error) => {
        alert("Error: " + error.message);
      });
  });
});
