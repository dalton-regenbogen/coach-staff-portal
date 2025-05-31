// File: /js/main.js

// 1. Import auth + db from your firebase-config.js
import { auth, db } from "./firebase-config.js";

// 2. Import the Auth listeners and signOut
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// 3. Import Firestore functions from the Firestore SDK
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  // Listen for auth state changes
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // ─── User is signed in ─────────────────────────────────────
      console.log("User is logged in:", user.email);

      // Show/hide UI elements accordingly

     // document.querySelector(".logout").classList.remove("hidden");

      // Fetch the userRoles document for this user
      const roleDocRef = doc(db, "userRoles", user.uid);
      try {
        const roleDocSnap = await getDoc(roleDocRef);
        let temporaryPassword = false;

        if (roleDocSnap.exists()) {
          const data = roleDocSnap.data();
          temporaryPassword = data.temporaryPassword || false;
          console.log("temporaryPassword flag:", temporaryPassword);
        }

        // If the user still has a temporary password, force them to change it
        if (temporaryPassword) {
          console.log("Redirecting to change-password page...");
          // You might want to pass a query param or simply redirect
          window.location.href = "change-password.html";
          return;
        }

        // If temporaryPassword is false, you can also check data.role here
        // and show/hide UI elements based on role, e.g.:
        // let role = data.role || "coach";
        // if (role === "admin") { ... }

      } catch (fetchError) {
        console.error("Error fetching role document:", fetchError);
      }

    } else {
      // ─── No user is signed in ────────────────────────────────────
      console.log("No user is logged in.");
      document.querySelector(".navbar__links").classList.add("hidden");
      document.querySelector(".login").style.display = "block";
      document.querySelector(".logout").classList.add("hidden");
    }
  });
});

// Attach the logout function globally
window.logout = function() {
  signOut(auth)
    .then(() => {
      console.log("User signed out successfully.");
      window.location.href = "login.html";
    })
    .catch((error) => {
      console.error("Error signing out:", error);
    });
};
