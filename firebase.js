import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDj5Pnv0lNeChf_t2XGdhiru5hjwKb6iIw",
  authDomain: "engin360-56474.firebaseapp.com",
  projectId: "engin360-56474",
  storageBucket: "engin360-56474.firebasestorage.app",
  messagingSenderId: "82163330076",
  appId: "1:82163330076:web:f1c7b7b10e74ee8f4283d9",
  measurementId: "G-1DVGR3MD40"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db, firebaseConfig };
