// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

// Your specific TaskVault Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAv6QCpopa0Q77AVTyjU5cqJEIKIE9OVTs",
  authDomain: "taskvault-412a0.firebaseapp.com",
  projectId: "taskvault-412a0",
  storageBucket: "taskvault-412a0.firebasestorage.app",
  messagingSenderId: "420716701831",
  appId: "1:420716701831:web:c987d91f7f4c8684eb7022",
  measurementId: "G-93JG3LB08B"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize and Export services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const analytics = getAnalytics(app);
