// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import { firebaseConfig } from "./config.js"; // This is the config you saved earlier

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);