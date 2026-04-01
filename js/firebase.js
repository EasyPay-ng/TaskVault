// Import Firebase SDKs (via CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";

// Your Firebase config
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
const analytics = getAnalytics(app);

// Export app so you can use it in other JS files
export { app };
