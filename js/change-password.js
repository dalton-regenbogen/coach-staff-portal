// change-password.js

// 1) Auth + Firestore instances
import { auth, db } 
  from "./firebase-config.js";

// 2) Auth functions: updatePassword, reauthenticateWithCredential, etc.
import { 
  updatePassword, 
  EmailAuthProvider, 
  reauthenticateWithCredential 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// 3) Firestore functions: doc + updateDoc (this is the correct SDK!)
import { 
  doc, 
  updateDoc 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", function() {
  const form     = document.getElementById("changePasswordForm");
  const errorMsg = document.querySelector(".changePassword__errorMessage");

  form.addEventListener("submit", async function(e) {
    e.preventDefault();
    errorMsg.textContent = ""; // clear previous

    // Grab values from your HTML inputs
    const currentPassword = document.getElementById("currentPassword").value.trim();
    const newPassword     = document.getElementById("newPassword").value.trim();
    const confirmPassword = document.getElementById("confirmPassword").value.trim();

    // 1) Check basic validation
    if (!currentPassword) {
      errorMsg.textContent = "Current password is required.";
      return;
    }
    if (newPassword !== confirmPassword) {
      errorMsg.textContent = "Passwords do not match.";
      return;
    }
    if (newPassword.length < 6) {
      errorMsg.textContent = "Password should be at least 6 characters long.";
      return;
    }

    // 2) Re-authenticate the logged-in user with their current password
    const user = auth.currentUser;
    if (!user) {
      errorMsg.textContent = "No user is currently signed in. Please log in again.";
      return;
    }

    try {
      // Build an EmailAuthProvider credential
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      console.log("✅ User re-authenticated successfully.");

      // 3) Update the password in Firebase Auth
      await updatePassword(user, newPassword);
      console.log("✅ Password updated successfully in Auth.");

      console.log("→ About to clear temporaryPassword in Firestore for uid:", user.uid);
      const roleDocRef = doc(db, "userRoles", user.uid);
      console.log("   · roleDocRef.path =", roleDocRef.path);

      await updateDoc(roleDocRef, { temporaryPassword: false });
      console.log("✅ Cleared temporaryPassword flag in Firestore.");

      // 5) Redirect to your homepage (or wherever)
      window.location.href = "homepage.html"; // or "homepage.html", whichever is correct

    } catch (error) {
      console.error("❌ Error updating password or re-authenticating:", error);
      // Display a friendly message
      if (error.code === "auth/wrong-password") {
        errorMsg.textContent = "Current password is incorrect.";
      } else if (error.code === "auth/requires-recent-login") {
        errorMsg.textContent = "Please log in again before changing your password.";
      } else {
        errorMsg.textContent = "Error: " + error.message;
      }
    }
  });
});


