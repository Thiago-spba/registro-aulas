import { useState, useEffect, useMemo, useRef } from "react";
import "./App.css";
import {
  loginComGoogle,
  logout,
  observarLogin,
  salvarSemana,
  observarSemana,
  buscarSemana,
  salvarNota,
  moverNotaParaLixeira,
  restaurarNota,
  excluirNotaDefinitivamente,
  observarNota,
  salvarRascunho,
  observarRascunho,
  excluirRascunho,
} from "./firebase";

const DIAS_LIXEIRA = 15;

const ESCOLA = "E.E. Prof. Simão Mathias";
const ENDERECO =
  "Av. Ragueb Chohfi, 4757 — Jardim Três Marias, São Paulo - SP, 08380-330";

const MANHA = [
  { aula: "1ª aula", inicio: "7h00", fim: "7h50" },
  { aula: "2ª aula", inicio: "7h50", fim: "8h40" },
  { aula: "3ª aula", inicio: "8h40", fim: "9h30" },
  { aula: "Intervalo", inicio: "9h30", fim: "9h50", intervalo: true },
  { aula: "4ª aula", inicio: "9h50", fim: "10h40" },
  { aula: "5ª aula", inicio: "10h40", fim: "11h30" },
  { aula: "6ª aula", inicio: "11h30", fim: "12h20" },
];

const TARDE = [
  { aula: "1ª aula", inicio: "13h00", fim: "13h50" },
  { aula: "2ª aula", inicio: "13h50", fim: "14h40" },
  { aula: "3ª aula", inicio: "14h40", fim: "15h30" },
  { aula: "Intervalo", inicio: "15h30", fim: "15h50", intervalo: true },
  { aula: "4ª aula", inicio: "15h50", fim: "16h40" },
  { aula: "5ª aula", inicio: "16h40", fim: "17h30" },
  { aula: "6ª aula", inicio: "17h30", fim: "18h20" },
];

function semanaInfo(offset) {
  const hoje = new Date();
  const dia = hoje.getDay();
  const segunda = new Date(hoje);
  segunda.setDate(hoje.getDate() - ((dia + 6) % 7) + offset * 7);
  const sexta = new Date(segunda);
  sexta.setDate(segunda.getDate() + 4);
  const fmt = (d) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  const id = `${segunda.getFullYear()}-${String(segunda.getMonth() + 1).padStart(2, "0")}-${String(segunda.getDate()).padStart(2, "0")}`;
  return { label: `${fmt(segunda)} a ${fmt(sexta)}`, id };
}

const MESES_NOMES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function nomeDoMes(offset) {
  const { id } = semanaInfo(offset);
  const [ano, mes] = id.split("-").map(Number);
  return `${MESES_NOMES[mes - 1]} de ${ano}`;
}

function hojeId() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
}

function makeEmptyRegistro(rows) {
  const r = {};
  rows.forEach((row, i) => {
    if (!row.intervalo) r[i] = { turma: "", professor: "", conteudo: "" };
  });
  return r;
}

function blocoSemanaCSV(linhas, semanaLabelTexto, manhaDados, tardeDados) {
  linhas.push([`════ SEMANA: ${semanaLabelTexto} ════`]);
  linhas.push([]);
  const addBloco = (titulo, rows, dados) => {
    linhas.push([titulo]);
    linhas.push([
      "Aula",
      "Início",
      "Fim",
      "Turma",
      "Professor / Matéria",
      "Conteúdo dado",
    ]);
    rows.forEach((row, i) => {
      if (row.intervalo) {
        linhas.push([row.aula, row.inicio, row.fim, "— intervalo —", "", ""]);
      } else {
        const d = dados[i] || { turma: "", professor: "", conteudo: "" };
        linhas.push([
          row.aula,
          row.inicio,
          row.fim,
          d.turma,
          d.professor,
          d.conteudo,
        ]);
      }
    });
    linhas.push([]);
  };
  addBloco("Turno Manhã", MANHA, manhaDados);
  addBloco("Turno Tarde", TARDE, tardeDados);
  linhas.push([]);
}

function baixarCSV(linhas, nomeArquivo) {
  const csv = linhas
    .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportarPeriodo(
  uid,
  offsetInicio,
  offsetFim,
  manhaAtual,
  tardeAtual,
  semanaOffsetAtual,
) {
  const linhas = [];
  linhas.push([ESCOLA]);
  linhas.push([`Professor: Thiago Fernando`]);
  linhas.push([]);

  const inicio = Math.min(offsetInicio, offsetFim);
  const fim = Math.max(offsetInicio, offsetFim);

  for (let off = inicio; off <= fim; off++) {
    const { label, id } = semanaInfo(off);
    let dados;
    if (off === semanaOffsetAtual) {
      dados = { manha: manhaAtual, tarde: tardeAtual };
    } else {
      dados = await buscarSemana(uid, id);
    }
    const manhaDados = (dados && dados.manha) || makeEmptyRegistro(MANHA);
    const tardeDados = (dados && dados.tarde) || makeEmptyRegistro(TARDE);
    blocoSemanaCSV(linhas, label, manhaDados, tardeDados);
  }

  const { label: labelInicio } = semanaInfo(inicio);
  const { label: labelFim } = semanaInfo(fim);
  const nomeBase =
    inicio === fim
      ? `registro-aulas-semana-${labelInicio}`
      : `registro-aulas-${labelInicio}_a_${labelFim}`;
  baixarCSV(linhas, `${nomeBase.replace(/\//g, "-").replace(/ /g, "_")}.csv`);
}

function inicioFimDoMes(offsetAtual) {
  // Descobre o offset da primeira e ultima semana que tocam o mes da semana atual
  const { id } = semanaInfo(offsetAtual);
  const [ano, mes] = id.split("-").map(Number);
  let inicio = offsetAtual;
  let fim = offsetAtual;
  while (true) {
    const ant = semanaInfo(inicio - 1);
    const [a, m] = ant.id.split("-").map(Number);
    if (a === ano && m === mes) inicio -= 1;
    else break;
  }
  while (true) {
    const prox = semanaInfo(fim + 1);
    const [a, m] = prox.id.split("-").map(Number);
    if (a === ano && m === mes) fim += 1;
    else break;
  }
  return { inicio, fim };
}

function Tabela({ titulo, rows, dados, onChange }) {
  return (
    <div className="tabela-bloco">
      <h3>{titulo}</h3>
      <table>
        <thead>
          <tr>
            <th>Aula</th>
            <th>Início</th>
            <th>Fim</th>
            <th>Turma</th>
            <th>Professor / Matéria</th>
            <th>Conteúdo dado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            if (row.intervalo) {
              return (
                <tr key={i} className="linha-intervalo">
                  <td>{row.aula}</td>
                  <td>{row.inicio}</td>
                  <td>{row.fim}</td>
                  <td colSpan={3}>— intervalo —</td>
                </tr>
              );
            }
            const d = dados[i] || { turma: "", professor: "", conteudo: "" };
            const preenchida = d.turma.trim() !== "";
            return (
              <tr key={i} className={preenchida ? "linha-dada" : ""}>
                <td>{row.aula}</td>
                <td>{row.inicio}</td>
                <td>{row.fim}</td>
                <td>
                  <input
                    value={d.turma}
                    placeholder="ex: 7º A"
                    onChange={(e) => onChange(i, "turma", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    value={d.professor}
                    placeholder="ex: Maria — Matemática"
                    onChange={(e) => onChange(i, "professor", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    value={d.conteudo}
                    placeholder="ex: Equações de 1º grau"
                    onChange={(e) => onChange(i, "conteudo", e.target.value)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="total">
        Total — {titulo}:{" "}
        <strong>
          {Object.values(dados).filter((d) => d.turma.trim() !== "").length}
        </strong>
      </div>
    </div>
  );
}

function RascunhoRapido({
  user,
  semanaOffset,
  manhaDados,
  tardeDados,
  setManhaDados,
  setTardeDados,
  semanaId,
  agendarSalvar,
}) {
  const [aberto, setAberto] = useState(false);
  const [turmasManha, setTurmasManha] = useState({});
  const [turmasTarde, setTurmasTarde] = useState({});
  const saveTimer = useRef(null);
  const dataId = hojeId();

  useEffect(() => {
    if (!user) return;
    const unsub = observarRascunho(user.uid, dataId, (data) => {
      setTurmasManha((data && data.manha) || {});
      setTurmasTarde((data && data.tarde) || {});
    });
    return unsub;
  }, [user, dataId]);

  function aoDigitar(turno, i, valor) {
    const atualizado =
      turno === "manha"
        ? { ...turmasManha, [i]: valor }
        : { ...turmasTarde, [i]: valor };
    if (turno === "manha") setTurmasManha(atualizado);
    else setTurmasTarde(atualizado);

    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      salvarRascunho(user.uid, dataId, {
        manha: turno === "manha" ? atualizado : turmasManha,
        tarde: turno === "tarde" ? atualizado : turmasTarde,
      });
    }, 400);
  }

  function apagarRascunho() {
    excluirRascunho(user.uid, dataId);
    setTurmasManha({});
    setTurmasTarde({});
  }

  function transferirParaOficial() {
    // So transfere se a semana exibida na tela for a semana atual (offset 0),
    // que e sempre a semana de "hoje".
    if (semanaOffset !== 0) {
      alert(
        'Vá para a "Semana atual" antes de transferir, pois a anotação rápida é sempre do dia de hoje.',
      );
      return;
    }
    let novaManha = manhaDados;
    let novaTarde = tardeDados;
    Object.entries(turmasManha).forEach(([i, valor]) => {
      if (valor && valor.trim() !== "") {
        novaManha = { ...novaManha, [i]: { ...novaManha[i], turma: valor } };
      }
    });
    Object.entries(turmasTarde).forEach(([i, valor]) => {
      if (valor && valor.trim() !== "") {
        novaTarde = { ...novaTarde, [i]: { ...novaTarde[i], turma: valor } };
      }
    });
    setManhaDados(novaManha);
    setTardeDados(novaTarde);
    agendarSalvar(novaManha, novaTarde);
    apagarRascunho();
    setAberto(false);
  }

  const temAlgo =
    Object.values(turmasManha).some((v) => v && v.trim() !== "") ||
    Object.values(turmasTarde).some((v) => v && v.trim() !== "");

  if (!aberto) {
    return (
      <button className="botao-rascunho-abrir" onClick={() => setAberto(true)}>
        ⚡ Anotação rápida do dia{temAlgo ? " (tem rascunho salvo)" : ""}
      </button>
    );
  }

  return (
    <div className="rascunho-bloco">
      <div className="rascunho-cabecalho">
        <h3>⚡ Anotação rápida — hoje</h3>
        <button
          className="botao-fechar-rascunho"
          onClick={() => setAberto(false)}
        >
          Fechar
        </button>
      </div>
      <p className="rascunho-dica">
        Anote só a sala/turma que a administração informar. Depois clique em
        "Transferir" para preencher a tabela oficial.
      </p>

      <div className="rascunho-colunas">
        <div className="rascunho-coluna">
          <h4>Manhã</h4>
          {MANHA.map((row, i) =>
            row.intervalo ? null : (
              <div key={i} className="rascunho-linha">
                <span>{row.aula}</span>
                <input
                  value={turmasManha[i] || ""}
                  placeholder="sala / turma"
                  onChange={(e) => aoDigitar("manha", i, e.target.value)}
                />
              </div>
            ),
          )}
        </div>
        <div className="rascunho-coluna">
          <h4>Tarde</h4>
          {TARDE.map((row, i) =>
            row.intervalo ? null : (
              <div key={i} className="rascunho-linha">
                <span>{row.aula}</span>
                <input
                  value={turmasTarde[i] || ""}
                  placeholder="sala / turma"
                  onChange={(e) => aoDigitar("tarde", i, e.target.value)}
                />
              </div>
            ),
          )}
        </div>
      </div>

      <div className="rascunho-acoes">
        <button
          className="botao-transferir"
          onClick={transferirParaOficial}
          disabled={!temAlgo}
        >
          ✅ Transferir para a tabela oficial
        </button>
        <button
          className="botao-apagar-rascunho"
          onClick={apagarRascunho}
          disabled={!temAlgo}
        >
          🗑 Apagar rascunho
        </button>
      </div>
    </div>
  );
}

function NotaWidget({ user }) {
  const [nota, setNota] = useState(null);
  const [texto, setTexto] = useState("");
  const saveTimer = useRef(null);

  useEffect(() => {
    if (!user) return;
    const unsub = observarNota(user.uid, (data) => {
      setNota(data);
      if (data && !data.excluida) setTexto(data.texto || "");
      if (!data) setTexto("");
    });
    return unsub;
  }, [user]);

  // Limpeza automática: se passou de 15 dias na lixeira, exclui de vez
  useEffect(() => {
    if (!nota || !nota.excluida || !nota.excluidaEm) return;
    const dias = (Date.now() - nota.excluidaEm) / (1000 * 60 * 60 * 24);
    if (dias >= DIAS_LIXEIRA) {
      excluirNotaDefinitivamente(user.uid);
    }
  }, [nota, user]);

  function aoDigitar(valor) {
    setTexto(valor);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      salvarNota(user.uid, valor);
    }, 500);
  }

  function apagar() {
    moverNotaParaLixeira(user.uid, texto);
  }

  function restaurar() {
    restaurarNota(user.uid);
  }

  const naLixeira = nota && nota.excluida;
  const diasRestantes = naLixeira
    ? Math.max(
        0,
        DIAS_LIXEIRA -
          Math.floor((Date.now() - nota.excluidaEm) / (1000 * 60 * 60 * 24)),
      )
    : null;

  return (
    <div className="nota-bloco">
      <div className="nota-cabecalho">
        <h3>📝 Bloco de notas</h3>
        {!naLixeira && (
          <button
            className="botao-apagar-nota"
            onClick={apagar}
            disabled={!texto}
          >
            Apagar
          </button>
        )}
      </div>

      {naLixeira ? (
        <div className="nota-lixeira">
          <p>
            Nota apagada — fica na lixeira por mais{" "}
            <strong>{diasRestantes} dia(s)</strong> antes de excluir para
            sempre.
          </p>
          <p className="nota-preview">
            {nota.texto?.slice(0, 120) || "(nota vazia)"}
            {nota.texto?.length > 120 ? "…" : ""}
          </p>
          <button className="botao-restaurar" onClick={restaurar}>
            Restaurar nota
          </button>
        </div>
      ) : (
        <textarea
          className="nota-texto"
          placeholder="Anote aqui qualquer coisa — salva automaticamente…"
          value={texto}
          onChange={(e) => aoDigitar(e.target.value)}
        />
      )}
    </div>
  );
}

function TelaLogin() {
  return (
    <div className="login-tela">
      <div className="login-card">
        <h1>{ESCOLA}</h1>
        <p>{ENDERECO}</p>
        <p className="subtitulo">
          Controle de Aulas — Professor Thiago Fernando
        </p>
        <button className="botao-login" onClick={loginComGoogle}>
          Entrar com Google
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined);
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [manhaDados, setManhaDados] = useState(makeEmptyRegistro(MANHA));
  const [tardeDados, setTardeDados] = useState(makeEmptyRegistro(TARDE));
  const [temaEscuro, setTemaEscuro] = useState(
    () => localStorage.getItem("tema") === "escuro",
  );
  const [painelExportar, setPainelExportar] = useState(false);
  const [periodoInicio, setPeriodoInicio] = useState(0);
  const [periodoFim, setPeriodoFim] = useState(0);
  const [exportando, setExportando] = useState(false);
  const saveTimer = useRef(null);
  const { label: semanaLabel, id: semanaId } = semanaInfo(semanaOffset);

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-tema",
      temaEscuro ? "escuro" : "claro",
    );
    localStorage.setItem("tema", temaEscuro ? "escuro" : "claro");
  }, [temaEscuro]);

  useEffect(() => observarLogin(setUser), []);

  useEffect(() => {
    if (!user) return;
    setManhaDados(makeEmptyRegistro(MANHA));
    setTardeDados(makeEmptyRegistro(TARDE));
    const unsub = observarSemana(user.uid, semanaId, (data) => {
      if (data) {
        setManhaDados(data.manha || makeEmptyRegistro(MANHA));
        setTardeDados(data.tarde || makeEmptyRegistro(TARDE));
      }
    });
    return unsub;
  }, [user, semanaId]);

  function agendarSalvar(novaManha, novaTarde) {
    if (!user) return;
    clearTimeout(saveTimer.current);
    setSalvando(true);
    saveTimer.current = setTimeout(async () => {
      await salvarSemana(user.uid, semanaId, {
        manha: novaManha,
        tarde: novaTarde,
        label: semanaLabel,
      });
      setSalvando(false);
    }, 600);
  }

  function atualizarManha(i, campo, valor) {
    const novo = { ...manhaDados, [i]: { ...manhaDados[i], [campo]: valor } };
    setManhaDados(novo);
    agendarSalvar(novo, tardeDados);
  }

  function atualizarTarde(i, campo, valor) {
    const novo = { ...tardeDados, [i]: { ...tardeDados[i], [campo]: valor } };
    setTardeDados(novo);
    agendarSalvar(manhaDados, novo);
  }

  const opcoesSemanas = useMemo(() => {
    const arr = [];
    for (let i = -8; i <= 4; i++) arr.push(i);
    return arr;
  }, []);

  const totalGeral = useMemo(() => {
    const m = Object.values(manhaDados).filter(
      (d) => d.turma.trim() !== "",
    ).length;
    const t = Object.values(tardeDados).filter(
      (d) => d.turma.trim() !== "",
    ).length;
    return m + t;
  }, [manhaDados, tardeDados]);

  function abrirPainelExportar() {
    setPeriodoInicio(semanaOffset);
    setPeriodoFim(semanaOffset);
    setPainelExportar(true);
  }

  async function aoExportarMesAtual() {
    setExportando(true);
    const { inicio, fim } = inicioFimDoMes(semanaOffset);
    await exportarPeriodo(
      user.uid,
      inicio,
      fim,
      manhaDados,
      tardeDados,
      semanaOffset,
    );
    setExportando(false);
  }

  async function aoExportarPeriodo() {
    setExportando(true);
    await exportarPeriodo(
      user.uid,
      periodoInicio,
      periodoFim,
      manhaDados,
      tardeDados,
      semanaOffset,
    );
    setExportando(false);
    setPainelExportar(false);
  }

  if (user === undefined) {
    return <div className="carregando">Carregando…</div>;
  }

  if (user === null) {
    return <TelaLogin />;
  }

  return (
    <div className="app">
      <header className="cabecalho">
        <div className="cabecalho-topo">
          <div>
            <h1>{ESCOLA}</h1>
            <p>{ENDERECO}</p>
            <p className="professor">Professor: Thiago Fernando</p>
          </div>
          <button className="botao-sair" onClick={logout}>
            Sair
          </button>
          <button
            className="botao-tema"
            onClick={() => setTemaEscuro(!temaEscuro)}
          >
            {temaEscuro ? "☀️ Claro" : "🌙 Escuro"}
          </button>
        </div>
      </header>

      <div className="nav-semana">
        <button onClick={() => setSemanaOffset(semanaOffset - 1)}>
          ← Anterior
        </button>
        <select
          value={semanaOffset}
          onChange={(e) => setSemanaOffset(Number(e.target.value))}
        >
          {opcoesSemanas.map((off) => {
            const { label } = semanaInfo(off);
            return (
              <option key={off} value={off}>
                Semana {label}
                {off === 0 ? " (atual)" : ""}
              </option>
            );
          })}
        </select>
        <button onClick={() => setSemanaOffset(semanaOffset + 1)}>
          Próxima →
        </button>
      </div>

      <RascunhoRapido
        user={user}
        semanaOffset={semanaOffset}
        manhaDados={manhaDados}
        tardeDados={tardeDados}
        setManhaDados={setManhaDados}
        setTardeDados={setTardeDados}
        semanaId={semanaId}
        agendarSalvar={agendarSalvar}
      />

      <NotaWidget user={user} />

      <div className="acoes">
        <span className="status-salvando">
          {salvando ? "Salvando…" : "Salvo ✓"}
        </span>
        <button
          className="botao-exportar"
          onClick={aoExportarMesAtual}
          disabled={exportando}
        >
          ⬇ Exportar {nomeDoMes(semanaOffset)}
        </button>
        <button
          className="botao-periodo"
          onClick={abrirPainelExportar}
          disabled={exportando}
        >
          📅 Escolher período
        </button>
        <button className="botao-imprimir" onClick={() => window.print()}>
          🖨 Imprimir / Compartilhar como PDF
        </button>
      </div>

      {painelExportar && (
        <div className="painel-exportar">
          <h4>Exportar por período</h4>
          <div className="painel-exportar-linha">
            <label>
              De:
              <select
                value={periodoInicio}
                onChange={(e) => setPeriodoInicio(Number(e.target.value))}
              >
                {opcoesSemanas.map((off) => {
                  const { label } = semanaInfo(off);
                  return (
                    <option key={off} value={off}>
                      Semana {label}
                    </option>
                  );
                })}
              </select>
            </label>
            <label>
              Até:
              <select
                value={periodoFim}
                onChange={(e) => setPeriodoFim(Number(e.target.value))}
              >
                {opcoesSemanas.map((off) => {
                  const { label } = semanaInfo(off);
                  return (
                    <option key={off} value={off}>
                      Semana {label}
                    </option>
                  );
                })}
              </select>
            </label>
          </div>
          <div className="painel-exportar-acoes">
            <button
              className="botao-exportar"
              onClick={aoExportarPeriodo}
              disabled={exportando}
            >
              {exportando ? "Gerando…" : "⬇ Gerar arquivo deste período"}
            </button>
            <button
              className="botao-cancelar"
              onClick={() => setPainelExportar(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <Tabela
        titulo="Turno Manhã"
        rows={MANHA}
        dados={manhaDados}
        onChange={atualizarManha}
      />
      <Tabela
        titulo="Turno Tarde"
        rows={TARDE}
        dados={tardeDados}
        onChange={atualizarTarde}
      />

      <div className="total-geral">
        Total de aulas na semana: <strong>{totalGeral}</strong>
      </div>
    </div>
  );
}
