import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Replace with your own Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyCQTg0yFXBONr9H7ZWFzmFxSjyrUtd77d8",
  authDomain: "alexisunplugged-343da.firebaseapp.com",
  projectId: "alexisunplugged-343da",
  storageBucket: "alexisunplugged-343da.firebasestorage.app",
  messagingSenderId: "57327556211",
  appId: "1:57327556211:web:faaa8ffeb98dbac1cdbc06"
};


const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);