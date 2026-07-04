import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  collection,
} from "firebase/firestore";

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

// Em vez do getFirestore(app) padrão, usamos initializeFirestore com duas
// otimizações pensadas pra rede de escola (firewall/proxy restritivo):
//
// 1. experimentalAutoDetectLongPolling: o app já detecta rápido se a
//    conexão "moderna" (streaming) está bloqueada, e cai direto no método
//    mais simples e compatível (long polling) — sem ficar preso esperando
//    a conexão moderna falhar sozinha, que é o que causava a demora.
// 2. persistentLocalCache: guarda uma cópia dos dados no próprio aparelho
//    (como um cache de navegador), pra abrir instantâneo nas próximas vezes,
//    mesmo com internet ruim no momento.
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
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

// --- Registro de aulas por DIA exato (corrige o problema de semanas sem distinguir dias) ---

export function salvarDia(uid, diaId, dados) {
  return setDoc(doc(db, "usuarios", uid, "dias", diaId), dados, { merge: true });
}

export function observarDia(uid, diaId, callback) {
  return onSnapshot(doc(db, "usuarios", uid, "dias", diaId), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}

export async function buscarDia(uid, diaId) {
  const snap = await getDoc(doc(db, "usuarios", uid, "dias", diaId));
  return snap.exists() ? snap.data() : null;
}

// --- Periodos especiais (ferias, feriado, atestado, outro) ---

export function salvarPeriodo(uid, periodo) {
  const id = periodo.id || doc(collection(db, "usuarios", uid, "periodos")).id;
  return setDoc(doc(db, "usuarios", uid, "periodos", id), { ...periodo, id });
}

export function observarPeriodos(uid, callback) {
  return onSnapshot(collection(db, "usuarios", uid, "periodos"), (snap) => {
    callback(snap.docs.map((d) => d.data()));
  });
}

export function excluirPeriodo(uid, id) {
  return deleteDoc(doc(db, "usuarios", uid, "periodos", id));
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

// --- Anotação rápida do dia (rascunho temporário, transferido depois para o registro oficial) ---

export function salvarRascunho(uid, dataId, dados) {
  return setDoc(doc(db, "usuarios", uid, "rascunhos", dataId), dados, { merge: true });
}

export function observarRascunho(uid, dataId, callback) {
  return onSnapshot(doc(db, "usuarios", uid, "rascunhos", dataId), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}

export function excluirRascunho(uid, dataId) {
  return deleteDoc(doc(db, "usuarios", uid, "rascunhos", dataId));
}

// --- Ensino Tecnico: configuracao fixa por dia da semana + registro diario de conteudo ---
export function salvarTecnicoConfig(uid, diaSemana, config) {
  return setDoc(doc(db, "usuarios", uid, "tecnico_config", diaSemana), config, { merge: true });
}
export function observarTecnicoConfig(uid, callback) {
  return onSnapshot(collection(db, "usuarios", uid, "tecnico_config"), (snap) => {
    const config = {};
    snap.docs.forEach((d) => {
      config[d.id] = d.data();
    });
    callback(config);
  });
}
export function salvarTecnicoDia(uid, dataId, dados) {
  return setDoc(doc(db, "usuarios", uid, "tecnico_dias", dataId), dados, { merge: true });
}
export function observarTecnicoDia(uid, dataId, callback) {
  return onSnapshot(doc(db, "usuarios", uid, "tecnico_dias", dataId), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}
export async function buscarTecnicoDia(uid, dataId) {
  const snap = await getDoc(doc(db, "usuarios", uid, "tecnico_dias", dataId));
  return snap.exists() ? snap.data() : null;
}

// Busca a configuração (grade de horários) de TODOS os dias da semana de uma vez.
// Usado pra saber quantos slots existem hoje em cada dia, e não contar
// "aulas fantasmas" de slots que já foram removidos da grade.
export async function buscarTecnicoConfigTudo(uid) {
  const snap = await getDocs(collection(db, "usuarios", uid, "tecnico_config"));
  const config = {};
  snap.docs.forEach((d) => {
    config[d.id] = d.data();
  });
  return config;
}

// --- Notas por dia (substitui a nota unica antiga) ---
export function salvarNotaDia(uid, dataId, texto) {
  return setDoc(doc(db, "usuarios", uid, "notas_dias", dataId), {
    texto,
    atualizadoEm: Date.now(),
  }, { merge: true });
}
export function observarNotaDia(uid, dataId, callback) {
  return onSnapshot(doc(db, "usuarios", uid, "notas_dias", dataId), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}
export function excluirNotaDia(uid, dataId) {
  return deleteDoc(doc(db, "usuarios", uid, "notas_dias", dataId));
}
export function observarTodasNotas(uid, callback) {
  return onSnapshot(collection(db, "usuarios", uid, "notas_dias"), (snap) => {
    const mapa = {};
    snap.docs.forEach((d) => {
      const data = d.data();
      if (data.texto && data.texto.trim() !== "") mapa[d.id] = true;
    });
    callback(mapa);
  });
}