// change-password.js
import { auth, db } from "./firebase-config.js";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-auth.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", function() {
  const form = document.getElementById("changePasswordForm");
  const errorMsg = document.querySelector(".changePassword__errorMessage");

  form.addEventListener("submit", async function(e) {
    e.preventDefault();
    errorMsg.textContent = ""; // Clear any previous error

    const newPassword = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    // Basic validation: Check if passwords match and meet your criteria
    if (newPassword !== confirmPassword) {
      errorMsg.textContent = "Passwords do not match.";
      return;
    }
    if (newPassword.length < 6) {
      errorMsg.textContent = "Password should be at least 6 characters long.";
      return;
    }

    // Use auth.currentUser to get the logged-in user
    const user = auth.currentUser;
    if (user) {
      try {
        const currentPassword = document.getElementById("currentPassword").value;
        if (!currentPassword) {
          errorMsg.textContent = "Current password is required.";
          return;
        }

        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        console.log("User re-authenticated successfully.");
        
        // Update the user's password in Firebase Auth
        await updatePassword(user, newPassword);
        console.log("Password updated successfully.");

        // Update the Firestore role document: set temporaryPassword to false
        const roleDocRef = doc(db, "userRoles", user.uid);
        await updateDoc(roleDocRef, { temporaryPassword: false });
        console.log("Temporary password flag updated.");

        // Redirect to the home page or a success page
        window.location.href = "index.html";
      } catch (error) {
        console.error("Error updating password:", error.message);
        errorMsg.textContent = "Error: " + error.message;
      }
    } else {
      errorMsg.textContent = "No user is logged in.";
    }
  });
});
