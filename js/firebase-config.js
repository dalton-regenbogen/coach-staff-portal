// firebase-config.js

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { initializeFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth }      from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';


export const firebaseConfig = {
  apiKey: "AIzaSyAougKlsWUt__5xtSq2tKZFnY6dbp2oekg",
  authDomain: "coachstaffportal.firebaseapp.com",
  databaseURL: "https://coachstaffportal-default-rtdb.firebaseio.com",
  projectId: "coachstaffportal",
  storageBucket: "coachstaffportal.firebasestorage.app",
  messagingSenderId: "409842010087",
  appId: "1:409842010087:web:b609e2d48b7f7f43381f42"
};


export const app  = initializeApp(firebaseConfig);
export const db   = initializeFirestore(app, {
  experimentalForceLongPolling: true
});
export const auth = getAuth(app);


