import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA_oQJ2efek6QG-08YDGI1j0F5DuQsEXp4",
  authDomain: "decora-c29a2.firebaseapp.com",
  projectId: "decora-c29a2",
  storageBucket: "decora-c29a2.firebasestorage.app",
  messagingSenderId: "832564979501",
  appId: "1:832564979501:web:9c4606f45164f8c79795a4",
  measurementId: "G-SD35V9GY8J"
};

export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const db = getFirestore(app);
