// Import the authentication and Firestore database instances from firebase-config.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", function() {
  // Listen for changes in the user's sign-in state.
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // User is logged in:
      console.log("User is logged in:", user.email);
      document.querySelector('.navbar__links').classList.remove('hidden');
      document.querySelector('.login').style.display = 'none';
      document.querySelector('.logout').classList.remove('hidden');

      // Fetch the user's role document from Firestore.
      const roleDocRef = doc(db, "userRoles", user.uid);
      try {
        const roleDocSnap = await getDoc(roleDocRef);
        let role = "coach"; // default role
        let temporaryPassword = false; // defualt flag
        if (roleDocSnap.exists()) {
          const data = roleDocSnap.data();
          role = data.role;
          temporaryPassword = data.temporaryPassword || false;
        }
        console.log("User role:", role);
        console.log("temporaryPassword Flag:", temporaryPassword);

         // If the temporaryPassword flag is true, force password change
        if (temporaryPassword) {
          console.log("Redirecting to change-password page...");
          window.location.href = "change-password.html";
          return;  // Stop further processing.
        }
        // Based on the role, you can further adjust the UI here.
      } catch (error) {
        console.error("Error fetching role document:", error);
      }
    } else {
      // User is not logged in:
      console.log("No user is logged in.");
      document.querySelector('.navbar__links').classList.add('hidden');
      document.querySelector('.login').style.display = 'block';
      document.querySelector('.logout').classList.add('hidden');
    }
  });
});

// Attach the logout function to the global window object
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
