import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDdV4XjYaq9m6wV71KZUC3CrKYdwlO3kDo",
  authDomain: "room-expense-manager-c22f4.firebaseapp.com",
  projectId: "room-expense-manager-c22f4",
  storageBucket: "room-expense-manager-c22f4.firebasestorage.app",
  messagingSenderId: "912277700757",
  appId: "1:912277700757:web:248f033acd0e6d0ebf9b9c",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;