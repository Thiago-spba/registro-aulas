import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, deleteDoc, getDoc, onSnapshot, collection } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBg2AEb82yO5Sk2TPuITfdPRscoDr-P2P8",
  authDomain: "controle-de-aulas-c2973.firebaseapp.com",
  projectId: "controle-de-aulas-c2973",
  storageBucket: "controle-de-aulas-c2973.firebasestorage.app",
  messagingSenderId: "662572820697",
  appId: "1:662572820697:web:ccc9cb6fd8be236acb76c8",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export async function loginComGoogle() {
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.error("Erro no login:", err.code, err.message);
    alert("Erro ao entrar com Google: " + err.code + "\n" + err.message);
    throw err;
  }
}

export function logout() {
  return signOut(auth);
}

export function observarLogin(callback) {
  return onAuthStateChanged(auth, callback);
}

export function salvarSemana(uid, semanaId, dados) {
  return setDoc(doc(db, "usuarios", uid, "semanas", semanaId), dados, { merge: true });
}

export function observarSemana(uid, semanaId, callback) {
  return onSnapshot(doc(db, "usuarios", uid, "semanas", semanaId), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}

export async function buscarSemana(uid, semanaId) {
  const snap = await getDoc(doc(db, "usuarios", uid, "semanas", semanaId));
  return snap.exists() ? snap.data() : null;
}

// --- Bloco de notas (autosave + lixeira de 15 dias) ---

export function salvarNota(uid, texto) {
  return setDoc(doc(db, "usuarios", uid, "config", "nota"), {
    texto,
    excluida: false,
    atualizadoEm: Date.now(),
  }, { merge: true });
}

export function moverNotaParaLixeira(uid, texto) {
  return setDoc(doc(db, "usuarios", uid, "config", "nota"), {
    texto,
    excluida: true,
    excluidaEm: Date.now(),
  }, { merge: true });
}

export function restaurarNota(uid) {
  return setDoc(doc(db, "usuarios", uid, "config", "nota"), {
    excluida: false,
    excluidaEm: null,
  }, { merge: true });
}

export function excluirNotaDefinitivamente(uid) {
  return deleteDoc(doc(db, "usuarios", uid, "config", "nota"));
}

export function observarNota(uid, callback) {
  return onSnapshot(doc(db, "usuarios", uid, "config", "nota"), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}