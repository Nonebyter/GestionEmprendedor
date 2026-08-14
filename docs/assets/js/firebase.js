// Configuracion e inicializacion de Firebase (version web, sin servidor).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCdgVAiJfHiTPzDbiUx5ZX4lSfE7iDna1g",
  authDomain: "gestionemprendedor.firebaseapp.com",
  projectId: "gestionemprendedor",
  storageBucket: "gestionemprendedor.firebasestorage.app",
  messagingSenderId: "270859244522",
  appId: "1:270859244522:web:a16176cdcc4f1d32631893"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Personaliza aqui los datos del negocio.
export const BUSINESS = {
  name: "Mi Emprendimiento",
  phone: "",        // formato internacional sin +, ej: 50588887777 (para WhatsApp)
  currency: "€"  // simbolo de la moneda, ej: "$", "₡", "₽", "€"
};
