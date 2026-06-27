import { useState, useEffect, useMemo, useRef } from "react";
import "./App.css";
import {
  loginComGoogle,
  logout,
  observarLogin,
  salvarDia,
  observarDia,
  buscarDia,
  salvarPeriodo,
  observarPeriodos,
  excluirPeriodo,
  salvarNotaDia,
  observarNotaDia,
  excluirNotaDia,
  observarTodasNotas,
  salvarRascunho,
  observarRascunho,
  excluirRascunho,
  salvarTecnicoConfig,
  observarTecnicoConfig,
  salvarTecnicoDia,
  observarTecnicoDia,
  buscarTecnicoDia,
} from "./firebase";

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

const NOMES_DIA_SEMANA = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];
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

const TIPOS_PERIODO = [
  { valor: "ferias", rotulo: "🏖️ Férias" },
  { valor: "recesso", rotulo: "🏫 Recesso escolar" },
  { valor: "feriado", rotulo: "📅 Feriado" },
  { valor: "atestado", rotulo: "🩺 Atestado" },
  { valor: "outro", rotulo: "ℹ️ Outro motivo" },
];

function rotuloTipoPeriodo(tipo) {
  const item = TIPOS_PERIODO.find((t) => t.valor === tipo);
  return item ? item.rotulo : tipo;
}

// --- Funções de data (tudo baseado em ID "AAAA-MM-DD", sem ambiguidade de fuso) ---

function pad(n) {
  return String(n).padStart(2, "0");
}

function toId(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromId(id) {
  const [ano, mes, dia] = id.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

function addDias(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function fmtData(date) {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function fmtDataId(id) {
  return fmtData(fromId(id));
}

function nomeDiaSemana(date) {
  return NOMES_DIA_SEMANA[date.getDay()];
}

function hojeId() {
  return toId(new Date());
}

function ehFimDeSemana(date) {
  const d = date.getDay();
  return d === 0 || d === 6;
}

function diaAnteriorUtil(id) {
  let d = addDias(fromId(id), -1);
  while (ehFimDeSemana(d)) d = addDias(d, -1);
  return toId(d);
}

function diaProximoUtil(id) {
  let d = addDias(fromId(id), 1);
  while (ehFimDeSemana(d)) d = addDias(d, 1);
  return toId(d);
}

function primeiroUltimoDiaMes(dataId) {
  const d = fromId(dataId);
  const ano = d.getFullYear();
  const mes = d.getMonth();
  const primeiro = new Date(ano, mes, 1);
  const ultimo = new Date(ano, mes + 1, 0);
  return { inicio: toId(primeiro), fim: toId(ultimo) };
}

function primeiroUltimoDiaSemana(dataId) {
  const d = fromId(dataId);
  const diaSemana = d.getDay(); // 0=domingo, 1=segunda, ... 6=sabado
  const deltaSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
  const segunda = addDias(d, deltaSegunda);
  const sexta = addDias(segunda, 4);
  return { inicio: toId(segunda), fim: toId(sexta) };
}

function nomeMesAno(dataId) {
  const d = fromId(dataId);
  return `${MESES_NOMES[d.getMonth()]} de ${d.getFullYear()}`;
}

function periodoQueCobre(periodos, dataId) {
  return periodos.find((p) => p.inicio <= dataId && dataId <= p.fim);
}

function makeEmptyRegistro(rows) {
  const r = {};
  rows.forEach((row, i) => {
    if (!row.intervalo) r[i] = { turma: "", professor: "", conteudo: "" };
  });
  return r;
}

function algumPreenchido(dados) {
  return (
    dados && Object.values(dados).some((d) => d.turma && d.turma.trim() !== "")
  );
}

function contarPreenchidos(dados) {
  return dados
    ? Object.values(dados).filter((d) => d.turma && d.turma.trim() !== "")
        .length
    : 0;
}

// --- Exportação ---

function blocoDiaCSV(linhas, dataId, manhaDados, tardeDados) {
  const d = fromId(dataId);
  linhas.push([`════ ${nomeDiaSemana(d)} — ${fmtData(d)} ════`]);
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
        const dd = dados[i] || { turma: "", professor: "", conteudo: "" };
        linhas.push([
          row.aula,
          row.inicio,
          row.fim,
          dd.turma,
          dd.professor,
          dd.conteudo,
        ]);
      }
    });
    linhas.push([
      "",
      "",
      "",
      "",
      "Total do turno:",
      String(contarPreenchidos(dados)),
    ]);
    linhas.push([]);
  };
  addBloco("Turno Manhã", MANHA, manhaDados);
  addBloco("Turno Tarde", TARDE, tardeDados);
  const totalDia =
    contarPreenchidos(manhaDados) + contarPreenchidos(tardeDados);
  linhas.push(["", "", "", "", "TOTAL DO DIA:", String(totalDia)]);
  linhas.push([]);
  return totalDia;
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

async function exportarIntervalo(
  uid,
  periodos,
  inicioId,
  fimId,
  dataAtualId,
  manhaAtual,
  tardeAtual,
) {
  const linhas = [];
  linhas.push([ESCOLA]);
  linhas.push(["Professor: Thiago Fernando"]);
  linhas.push([`Período: ${fmtDataId(inicioId)} a ${fmtDataId(fimId)}`]);
  linhas.push([]);

  let cursor = fromId(inicioId);
  const fim = fromId(fimId);
  let teveConteudo = false;
  let totalGeral = 0;
  let diasComAula = 0;

  while (cursor <= fim) {
    const id = toId(cursor);
    const periodo = periodoQueCobre(periodos, id);

    if (periodo) {
      linhas.push([
        `── ${rotuloTipoPeriodo(periodo.tipo)}: ${fmtDataId(periodo.inicio)} a ${fmtDataId(periodo.fim)}${periodo.observacao ? " — " + periodo.observacao : ""} ──`,
      ]);
      linhas.push([]);
      teveConteudo = true;
      const proximoCursor = addDias(fromId(periodo.fim), 1);
      cursor = proximoCursor > cursor ? proximoCursor : addDias(cursor, 1);
      continue;
    }

    let dados;
    if (id === dataAtualId) {
      dados = { manha: manhaAtual, tarde: tardeAtual };
    } else {
      dados = await buscarDia(uid, id);
    }

    if (
      dados &&
      (algumPreenchido(dados.manha) || algumPreenchido(dados.tarde))
    ) {
      const totalDia = blocoDiaCSV(
        linhas,
        id,
        dados.manha || makeEmptyRegistro(MANHA),
        dados.tarde || makeEmptyRegistro(TARDE),
      );
      totalGeral += totalDia;
      diasComAula += 1;
      teveConteudo = true;
    }

    cursor = addDias(cursor, 1);
  }

  if (!teveConteudo) {
    linhas.push([
      "Nenhuma aula ou período especial registrado neste intervalo.",
    ]);
  } else {
    linhas.push(["════ RESUMO DO PERÍODO ════"]);
    linhas.push(["Dias com aula registrada:", String(diasComAula)]);
    linhas.push(["TOTAL GERAL DE AULAS:", String(totalGeral)]);
  }

  const nomeBase = `registro-aulas_${inicioId}_a_${fimId}`;
  baixarCSV(linhas, `${nomeBase}.csv`);
}

// --- Componentes ---

const ANOS_TURMA = ["1º", "2º", "3º", "4º", "5º", "6º", "7º", "8º", "9º"];
const LETRAS_TURMA = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
];

// Reconhece formatos antigos digitados à mão: "6ª A", "6º A", "6A", "Sala 6 A",
// "Turma: 6-A", "06 A", etc. Sempre tenta achar um número de 1 a 9 seguido,
// em algum momento, de uma letra de A a Z.
function partesTurma(turma) {
  let limpo = (turma || "").trim();
  if (!limpo) return { ano: "", letra: "" };

  // remove prefixos comuns tipo "Turma:", "Sala", "Classe"
  limpo = limpo.replace(/^(turma|sala|classe)\s*[:\-]?\s*/i, "");

  // aceita: número, indicador ordinal opcional (º ° ª o .), separador opcional (- / espaço), letra opcional
  const m = limpo.match(/(\d{1,2})\s*[º°ªo.]*\s*[-/]?\s*([a-z])?/i);
  if (m) {
    const ano = `${parseInt(m[1], 10)}º`;
    const letra = (m[2] || "").toUpperCase();
    // só aceita anos de 1º a 9º (faixa válida da escola); fora disso, não reconhece
    const anoNum = parseInt(m[1], 10);
    if (anoNum >= 1 && anoNum <= 9) {
      return { ano, letra };
    }
  }
  return { ano: "", letra: "" };
}

function juntarTurma(ano, letra) {
  if (!ano && !letra) return "";
  return `${ano}${letra ? " " + letra : ""}`.trim();
}

function SeletorTurma({ valor, onChange }) {
  const { ano, letra } = partesTurma(valor);
  const temTextoOriginal = valor && valor.trim() !== "";
  const naoReconhecido = temTextoOriginal && !ano;

  return (
    <div className="seletor-turma">
      <div className="seletor-turma-linha">
        <select
          value={ano}
          onChange={(e) => onChange(juntarTurma(e.target.value, letra))}
        >
          <option value="">Ano</option>
          {ANOS_TURMA.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          value={letra}
          onChange={(e) => onChange(juntarTurma(ano, e.target.value))}
        >
          <option value="">Turma</option>
          {LETRAS_TURMA.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>
      {naoReconhecido && (
        <div className="turma-original-aviso-bloco">
          <span
            className="turma-original-aviso"
            title="Este dado antigo não foi reconhecido pelo formato atual. Nada foi perdido — o texto original continua salvo. Selecione Ano/Turma acima para corrigir, ou apague abaixo."
          >
            ⚠️ valor salvo: "{valor}"
          </span>
          <button
            type="button"
            className="botao-apagar-turma-antiga"
            onClick={() => onChange("")}
            title="Apagar este valor antigo"
          >
            🗑 Apagar
          </button>
        </div>
      )}
    </div>
  );
}

function NavDia({ dataAtualId, setDataAtualId, totalDia }) {
  const dataObj = fromId(dataAtualId);
  const ehHoje = dataAtualId === hojeId();
  return (
    <div className="nav-dia nav-dia-interna">
      <button onClick={() => setDataAtualId(diaAnteriorUtil(dataAtualId))}>
        ← Dia anterior
      </button>
      <div className="nav-dia-central">
        <input
          type="date"
          className={totalDia > 0 ? "data-preenchida" : ""}
          value={dataAtualId}
          onChange={(e) => setDataAtualId(e.target.value)}
        />
        <span className="nav-dia-nome">{nomeDiaSemana(dataObj)}</span>
        {!ehHoje && (
          <button
            className="botao-ir-hoje"
            onClick={() => setDataAtualId(hojeId())}
          >
            Ir para hoje
          </button>
        )}
      </div>
      <button onClick={() => setDataAtualId(diaProximoUtil(dataAtualId))}>
        Próximo dia →
      </button>
    </div>
  );
}

function AbaColapsavel({ titulo, badge, abaPlaceholder, children }) {
  const [aberta, setAberta] = useState(false);
  return (
    <div
      className={`aba-colapsavel ${abaPlaceholder ? "aba-placeholder" : ""}`}
    >
      <button
        className="aba-colapsavel-cabecalho"
        onClick={() => setAberta(!aberta)}
      >
        <span>
          {titulo}
          {badge ? ` ${badge}` : ""}
        </span>
        <span className="aba-colapsavel-seta">{aberta ? "▲" : "▼"}</span>
      </button>
      {aberta && <div className="aba-colapsavel-conteudo">{children}</div>}
    </div>
  );
}

function Tabela({ titulo, rows, dados, onChange, totalSemana }) {
  const totalTabela = Object.values(dados).filter(
    (d) => d.turma.trim() !== "",
  ).length;
  return (
    <div className="tabela-bloco">
      <h3>{titulo}</h3>
      <div className="tabela-scroll">
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
                    <SeletorTurma
                      valor={d.turma}
                      onChange={(v) => onChange(i, "turma", v)}
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
      </div>
      <div className="total">
        <span>
          Total — {titulo}: <strong>{totalTabela}</strong>
        </span>
        {typeof totalSemana === "number" && (
          <span className="total-semana-rodape">
            {" "}
            &nbsp;|&nbsp; Total na semana (Seg a Sex):{" "}
            <strong>{totalSemana}</strong>
          </span>
        )}
      </div>
    </div>
  );
}

function diasNoMes(ano, mes) {
  return new Date(ano, mes, 0).getDate();
}

function ResumoTotais({ user, periodos }) {
  const [aberto, setAberto] = useState(false);
  const hoje = fromId(hojeId());
  const [diaSel, setDiaSel] = useState(hoje.getDate());
  const [mesSel, setMesSel] = useState(hoje.getMonth() + 1);
  const [anoSel, setAnoSel] = useState(hoje.getFullYear());
  const [carregando, setCarregando] = useState(false);
  const [totalSemana2, setTotalSemana2] = useState(null);
  const [totalMes2, setTotalMes2] = useState(null);
  const [labelSemana, setLabelSemana] = useState("");
  const [diasPulados, setDiasPulados] = useState(0);
  const [detalheSemana, setDetalheSemana] = useState([]);
  const [mostrarDetalhe, setMostrarDetalhe] = useState(false);

  const maxDiaMes = diasNoMes(anoSel, mesSel);
  const dataRef = `${anoSel}-${pad(mesSel)}-${pad(Math.min(diaSel, maxDiaMes))}`;

  async function somarPeriodo(inicioId, fimId) {
    let cursor = fromId(inicioId);
    const fimDate = fromId(fimId);
    let soma = 0;
    let pulados = 0;
    const detalhe = [];
    while (cursor <= fimDate) {
      const id = toId(cursor);
      const periodo = periodoQueCobre(periodos, id);
      if (periodo) {
        pulados += 1;
        detalhe.push({ id, total: 0, motivo: rotuloTipoPeriodo(periodo.tipo) });
      } else {
        const dados = await buscarDia(user.uid, id);
        const totalDoDia = dados
          ? Object.values(dados.manha || {}).filter(
              (d) => d.turma && d.turma.trim() !== "",
            ).length +
            Object.values(dados.tarde || {}).filter(
              (d) => d.turma && d.turma.trim() !== "",
            ).length
          : 0;
        soma += totalDoDia;
        detalhe.push({ id, total: totalDoDia, motivo: null });
      }
      cursor = addDias(cursor, 1);
    }
    return { soma, pulados, detalhe };
  }

  async function calcular(dataEscolhida) {
    setCarregando(true);
    const { inicio: iniSemana, fim: fimSemana } =
      primeiroUltimoDiaSemana(dataEscolhida);
    const { inicio: iniMes, fim: fimMes } = primeiroUltimoDiaMes(dataEscolhida);

    const [resSemana, resMes] = await Promise.all([
      somarPeriodo(iniSemana, fimSemana),
      somarPeriodo(iniMes, fimMes),
    ]);

    setTotalSemana2(resSemana.soma);
    setTotalMes2(resMes.soma);
    setDiasPulados(resSemana.pulados);
    setDetalheSemana(resSemana.detalhe);
    setLabelSemana(`${fmtDataId(iniSemana)} a ${fmtDataId(fimSemana)}`);
    setCarregando(false);
  }

  useEffect(() => {
    if (aberto) calcular(dataRef);
  }, [aberto, dataRef, periodos]);

  if (!aberto) {
    return (
      <button className="botao-resumo-abrir" onClick={() => setAberto(true)}>
        📊 Totais
      </button>
    );
  }

  const opcoesDia = Array.from({ length: maxDiaMes }, (_, i) => i + 1);

  return (
    <div className="painel-resumo-semanal">
      <div className="painel-periodos-cabecalho">
        <h3>📊 Totais</h3>
        <button
          className="botao-fechar-rascunho"
          onClick={() => setAberto(false)}
        >
          Fechar
        </button>
      </div>
      <p className="rascunho-dica">
        Mostrando a semana e o mês atuais. Se quiser ver outra data, escolha
        abaixo.
      </p>

      <div className="resumo-data-cascata">
        <label>
          Dia
          <select
            value={Math.min(diaSel, maxDiaMes)}
            onChange={(e) => setDiaSel(Number(e.target.value))}
          >
            {opcoesDia.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mês
          <select
            value={mesSel}
            onChange={(e) => setMesSel(Number(e.target.value))}
          >
            {MESES_NOMES.map((nome, i) => (
              <option key={nome} value={i + 1}>
                {nome.charAt(0).toUpperCase() + nome.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ano
          <select
            value={anoSel}
            onChange={(e) => setAnoSel(Number(e.target.value))}
          >
            {[anoSel - 1, anoSel, anoSel + 1]
              .filter((a, i, arr) => arr.indexOf(a) === i)
              .sort()
              .map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
          </select>
        </label>
      </div>

      {carregando ? (
        <p>Calculando…</p>
      ) : (
        <>
          {diasPulados > 0 && (
            <p className="resumo-aviso-periodo">
              {diasPulados} dia(s) dessa semana não contam no total porque estão
              marcados como férias/feriado/atestado.
            </p>
          )}
          <div className="resumo-totais-grid">
            <div className="resumo-total-card">
              <span>Semana ({labelSemana})</span>
              <strong>{totalSemana2 ?? "…"}</strong>
            </div>
            <div className="resumo-total-card">
              <span>
                Mês de {MESES_NOMES[mesSel - 1]} de {anoSel}
              </span>
              <strong>{totalMes2 ?? "…"}</strong>
            </div>
          </div>

          <button
            className="botao-ver-detalhe"
            onClick={() => setMostrarDetalhe(!mostrarDetalhe)}
          >
            {mostrarDetalhe
              ? "▲ Esconder detalhe da semana"
              : "▼ Ver detalhe da semana (confirmar dia a dia)"}
          </button>

          {mostrarDetalhe && (
            <div className="resumo-semanal-dias">
              {detalheSemana.map((d) => (
                <div
                  key={d.id}
                  className={`resumo-semanal-dia ${d.total > 0 ? "tem-aula" : ""}`}
                >
                  <span>
                    {nomeDiaSemana(fromId(d.id))} ({fmtDataId(d.id)})
                    {d.motivo ? ` — ${d.motivo}` : ""}
                  </span>
                  <strong>{d.motivo ? "—" : d.total}</strong>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PainelPeriodos({ user, periodos }) {
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState("ferias");
  const [inicio, setInicio] = useState(hojeId());
  const [fim, setFim] = useState(hojeId());
  const [observacao, setObservacao] = useState("");

  function salvar() {
    if (inicio > fim) {
      alert("A data de início precisa ser antes (ou igual) à data de fim.");
      return;
    }
    salvarPeriodo(user.uid, {
      tipo,
      inicio,
      fim,
      observacao,
      criadoEm: Date.now(),
    });
    setObservacao("");
  }

  function remover(id) {
    if (confirm("Remover este período especial?")) {
      excluirPeriodo(user.uid, id);
    }
  }

  if (!aberto) {
    return (
      <button className="botao-periodos-abrir" onClick={() => setAberto(true)}>
        📅 Períodos
        {periodos.length > 0 ? ` (${periodos.length})` : ""}
      </button>
    );
  }

  return (
    <div className="painel-periodos">
      <div className="painel-periodos-cabecalho">
        <h3>📅 Períodos especiais</h3>
        <button
          className="botao-fechar-rascunho"
          onClick={() => setAberto(false)}
        >
          Fechar
        </button>
      </div>
      <p className="rascunho-dica">
        Marque férias, feriados ou atestados. Esses dias deixam de aparecer como
        "vazios" e mostram o motivo certo no registro e na exportação.
      </p>

      <div className="periodo-form">
        <label>
          Tipo
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS_PERIODO.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label>
          De
          <input
            type="date"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
          />
        </label>
        <label>
          Até
          <input
            type="date"
            value={fim}
            onChange={(e) => setFim(e.target.value)}
          />
        </label>
        <label className="periodo-form-obs">
          Observação (opcional)
          <input
            type="text"
            value={observacao}
            placeholder="ex: Atestado médico"
            onChange={(e) => setObservacao(e.target.value)}
          />
        </label>
        <button className="botao-transferir" onClick={salvar}>
          + Adicionar período
        </button>
      </div>

      {periodos.length > 0 && (
        <div className="periodo-lista">
          {periodos
            .slice()
            .sort((a, b) => (a.inicio < b.inicio ? 1 : -1))
            .map((p) => (
              <div key={p.id} className="periodo-item">
                <span>
                  {rotuloTipoPeriodo(p.tipo)} — {fmtDataId(p.inicio)} a{" "}
                  {fmtDataId(p.fim)}
                  {p.observacao ? ` (${p.observacao})` : ""}
                </span>
                <button
                  className="botao-apagar-nota"
                  onClick={() => remover(p.id)}
                >
                  Remover
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function RascunhoRapido({ user, dataAtualId, onTransferido }) {
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

  async function transferirParaOficial() {
    const atual = await buscarDia(user.uid, dataId);
    let novaManha = (atual && atual.manha) || makeEmptyRegistro(MANHA);
    let novaTarde = (atual && atual.tarde) || makeEmptyRegistro(TARDE);

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

    await salvarDia(user.uid, dataId, { manha: novaManha, tarde: novaTarde });
    apagarRascunho();
    setAberto(false);
    if (dataAtualId === dataId && onTransferido) onTransferido();
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
        <h3>⚡ Anotação rápida — hoje ({fmtDataId(dataId)})</h3>
        <button
          className="botao-fechar-rascunho"
          onClick={() => setAberto(false)}
        >
          Fechar
        </button>
      </div>
      <p className="rascunho-dica">
        Anote só a sala/turma que a administração informar. Depois clique em
        "Transferir" para preencher a tabela oficial de hoje.
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
          ✅ Transferir para a tabela oficial de hoje
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

function CalendarioNotas({
  anoSel,
  mesSel,
  diasComNota,
  dataSelecionada,
  onSelecionarDia,
  onMudarMes,
}) {
  const primeiroDiaSemana = new Date(anoSel, mesSel - 1, 1).getDay();
  const totalDias = diasNoMes(anoSel, mesSel);
  const celulas = [];
  for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null);
  for (let d = 1; d <= totalDias; d++) celulas.push(d);
  const nomeMes = MESES_NOMES[mesSel - 1];

  return (
    <div className="calendario-notas">
      <div className="calendario-notas-cabecalho">
        <button onClick={() => onMudarMes(-1)}>←</button>
        <strong>
          {nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)} de {anoSel}
        </strong>
        <button onClick={() => onMudarMes(1)}>→</button>
      </div>
      <div className="calendario-notas-dias-semana">
        {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="calendario-notas-grade">
        {celulas.map((d, i) => {
          if (d === null) {
            return <span key={i} className="calendario-notas-vazio"></span>;
          }
          const id = `${anoSel}-${pad(mesSel)}-${pad(d)}`;
          const temNota = !!diasComNota[id];
          const selecionado = id === dataSelecionada;
          return (
            <button
              key={i}
              className={`calendario-notas-dia ${temNota ? "tem-nota" : ""} ${
                selecionado ? "selecionado" : ""
              }`}
              onClick={() => onSelecionarDia(id)}
              title={temNota ? "Tem anotação neste dia" : ""}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NotaWidget({ user, dataAtualId, setDataAtualId }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [diasComNota, setDiasComNota] = useState({});
  const [mostrarCalendario, setMostrarCalendario] = useState(false);
  const saveTimer = useRef(null);

  const dataObjAtual = fromId(dataAtualId);
  const [anoCal, setAnoCal] = useState(dataObjAtual.getFullYear());
  const [mesCal, setMesCal] = useState(dataObjAtual.getMonth() + 1);

  useEffect(() => {
    const d = fromId(dataAtualId);
    setAnoCal(d.getFullYear());
    setMesCal(d.getMonth() + 1);
  }, [dataAtualId]);

  useEffect(() => {
    if (!user) return;
    const unsub = observarNotaDia(user.uid, dataAtualId, (data) => {
      setTexto((data && data.texto) || "");
    });
    return unsub;
  }, [user, dataAtualId]);

  useEffect(() => {
    if (!user) return;
    const unsub = observarTodasNotas(user.uid, setDiasComNota);
    return unsub;
  }, [user]);

  function aoDigitar(valor) {
    setTexto(valor);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (valor.trim() === "") {
        excluirNotaDia(user.uid, dataAtualId);
      } else {
        salvarNotaDia(user.uid, dataAtualId, valor);
      }
    }, 500);
  }

  function mudarMes(delta) {
    let novoMes = mesCal + delta;
    let novoAno = anoCal;
    if (novoMes > 12) {
      novoMes = 1;
      novoAno += 1;
    }
    if (novoMes < 1) {
      novoMes = 12;
      novoAno -= 1;
    }
    setMesCal(novoMes);
    setAnoCal(novoAno);
  }

  if (!aberto) {
    return (
      <button className="botao-periodos-abrir" onClick={() => setAberto(true)}>
        📝 Notas
        {diasComNota[dataAtualId] ? " •" : ""}
      </button>
    );
  }

  return (
    <div className="nota-bloco">
      <div className="nota-cabecalho">
        <h3>📝 Nota — {fmtDataId(dataAtualId)}</h3>
        <div className="nota-cabecalho-botoes">
          <button
            className="botao-ver-detalhe"
            onClick={() => setMostrarCalendario(!mostrarCalendario)}
          >
            {mostrarCalendario ? "▲ Esconder calendário" : "🗓 Calendário"}
          </button>
          <button
            className="botao-fechar-rascunho"
            onClick={() => setAberto(false)}
          >
            Fechar
          </button>
        </div>
      </div>

      {mostrarCalendario && (
        <CalendarioNotas
          anoSel={anoCal}
          mesSel={mesCal}
          diasComNota={diasComNota}
          dataSelecionada={dataAtualId}
          onSelecionarDia={(id) => setDataAtualId(id)}
          onMudarMes={mudarMes}
        />
      )}

      <textarea
        className="nota-texto"
        placeholder="Anote aqui qualquer coisa sobre este dia — salva automaticamente…"
        value={texto}
        onChange={(e) => aoDigitar(e.target.value)}
      />
    </div>
  );
}

const DIAS_SEMANA_TECNICO = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
const NOMES_DIAS_TECNICO = {
  seg: "Segunda-feira",
  ter: "Terça-feira",
  qua: "Quarta-feira",
  qui: "Quinta-feira",
  sex: "Sexta-feira",
};

function diaSemanaKey(date) {
  return DIAS_SEMANA_TECNICO[date.getDay()];
}

// Valores padrão iniciais — sexta já com os dados reais informados;
// quarta com horário provisório (editável na tela).
const SLOTS_PADRAO_TECNICO = {
  sex: [
    {
      inicio: "10h40",
      fim: "11h30",
      disciplina: "Lógica e Linguagem de Programação",
    },
    {
      inicio: "11h30",
      fim: "12h20",
      disciplina: "Lógica e Linguagem de Programação",
    },
    {
      inicio: "12h20",
      fim: "13h10",
      disciplina: "Lógica e Linguagem de Programação",
    },
    {
      inicio: "13h10",
      fim: "14h00",
      disciplina: "Lógica e Linguagem de Programação",
    },
  ],
  qua: [
    { inicio: "10h40", fim: "11h30", disciplina: "" },
    { inicio: "11h30", fim: "12h20", disciplina: "" },
    { inicio: "12h20", fim: "13h10", disciplina: "" },
  ],
};

function novoSlotPadrao() {
  return { inicio: "", fim: "", disciplina: "" };
}

function TecnicoTab({ user, dataAtualId }) {
  const [config, setConfig] = useState({});
  const [dadosDia, setDadosDia] = useState(null);
  const [totalSemana, setTotalSemana] = useState(null);
  const [slotsLocais, setSlotsLocais] = useState(null);
  const saveTimerConfig = useRef(null);
  const saveTimerConteudo = useRef(null);

  const dataObj = fromId(dataAtualId);
  const chaveDia = diaSemanaKey(dataObj);
  const nomeDia = NOMES_DIAS_TECNICO[chaveDia];

  useEffect(() => {
    if (!user) return;
    const unsub = observarTecnicoConfig(user.uid, setConfig);
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = observarTecnicoDia(user.uid, dataAtualId, setDadosDia);
    return unsub;
  }, [user, dataAtualId]);

  useEffect(() => {
    if (!saveTimerConfig.current) {
      const slotsConfig =
        (config[chaveDia] && config[chaveDia].slots) ||
        SLOTS_PADRAO_TECNICO[chaveDia] ||
        [];
      setSlotsLocais(slotsConfig);
    }
  }, [config, chaveDia]);

  useEffect(() => {
    async function calcular() {
      if (!user || !nomeDia) {
        setTotalSemana(null);
        return;
      }
      const { inicio, fim } = primeiroUltimoDiaSemana(dataAtualId);
      let cursor = fromId(inicio);
      const fimDate = fromId(fim);
      let soma = 0;
      while (cursor <= fimDate) {
        const id = toId(cursor);
        const dados = await buscarTecnicoDia(user.uid, id);
        if (dados && dados.conteudos) {
          soma += Object.values(dados.conteudos).filter(
            (c) => c && c.trim() !== "",
          ).length;
        }
        cursor = addDias(cursor, 1);
      }
      setTotalSemana(soma);
    }
    calcular();
  }, [user, dataAtualId, dadosDia]);

  if (!nomeDia) {
    return (
      <p className="aba-placeholder-texto">
        Não há aula técnica configurada para finais de semana.
      </p>
    );
  }

  const slots = slotsLocais || [];
  const conteudos = (dadosDia && dadosDia.conteudos) || {};

  function atualizarSlot(i, campo, valor) {
    const novosSlots = slots.map((s, idx) =>
      idx === i ? { ...s, [campo]: valor } : s,
    );
    setSlotsLocais(novosSlots);
    clearTimeout(saveTimerConfig.current);
    saveTimerConfig.current = setTimeout(() => {
      salvarTecnicoConfig(user.uid, chaveDia, { slots: novosSlots });
      saveTimerConfig.current = null;
    }, 600);
  }

  function adicionarAula() {
    const novosSlots = [...slots, novoSlotPadrao()];
    setSlotsLocais(novosSlots);
    salvarTecnicoConfig(user.uid, chaveDia, { slots: novosSlots });
  }

  function removerAula(i) {
    if (!confirm(`Remover esta aula da configuração de ${nomeDia}?`)) return;
    const novosSlots = slots.filter((_, idx) => idx !== i);
    setSlotsLocais(novosSlots);
    salvarTecnicoConfig(user.uid, chaveDia, { slots: novosSlots });
  }

  function atualizarConteudo(i, valor) {
    const novosConteudos = { ...conteudos, [i]: valor };
    clearTimeout(saveTimerConteudo.current);
    saveTimerConteudo.current = setTimeout(() => {
      salvarTecnicoDia(user.uid, dataAtualId, { conteudos: novosConteudos });
    }, 500);
    setDadosDia({ ...dadosDia, conteudos: novosConteudos });
  }

  const totalDiaTecnico = Object.values(conteudos).filter(
    (c) => c && c.trim() !== "",
  ).length;

  return (
    <div className="tecnico-bloco">
      <h4>
        {nomeDia} — {fmtDataId(dataAtualId)}
      </h4>
      {slots.length === 0 ? (
        <p className="aba-placeholder-texto">
          Nenhuma aula técnica configurada para {nomeDia.toLowerCase()} ainda.
        </p>
      ) : (
        <div className="tabela-scroll">
          <table>
            <thead>
              <tr>
                <th>Aula</th>
                <th>Início</th>
                <th>Fim</th>
                <th>Disciplina</th>
                <th>Conteúdo dado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {slots.map((slot, i) => {
                const preenchida = conteudos[i] && conteudos[i].trim() !== "";
                return (
                  <tr key={i} className={preenchida ? "linha-dada" : ""}>
                    <td>{i + 1}ª aula</td>
                    <td>
                      <input
                        className="input-horario-tecnico"
                        value={slot.inicio}
                        onChange={(e) =>
                          atualizarSlot(i, "inicio", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="input-horario-tecnico"
                        value={slot.fim}
                        onChange={(e) =>
                          atualizarSlot(i, "fim", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        placeholder="ex: Lógica e Linguagem de Programação"
                        value={slot.disciplina}
                        onChange={(e) =>
                          atualizarSlot(i, "disciplina", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        placeholder="ex: Estruturas de repetição"
                        defaultValue={conteudos[i] || ""}
                        onChange={(e) => atualizarConteudo(i, e.target.value)}
                      />
                    </td>
                    <td>
                      <button
                        className="botao-apagar-nota"
                        onClick={() => removerAula(i)}
                        title="Remover esta aula da configuração"
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <button className="botao-transferir" onClick={adicionarAula}>
        + Adicionar aula em {nomeDia.toLowerCase()}
      </button>
      <div className="total">
        <span>
          Total — {nomeDia}: <strong>{totalDiaTecnico}</strong>
        </span>
        <span className="total-semana-rodape">
          {" "}
          &nbsp;|&nbsp; Total na semana (Técnico):{" "}
          <strong>{totalSemana === null ? "…" : totalSemana}</strong>
        </span>
      </div>
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
  const [dataAtualId, setDataAtualId] = useState(hojeId());
  const [salvando, setSalvando] = useState(false);
  const [manhaDados, setManhaDados] = useState(makeEmptyRegistro(MANHA));
  const [tardeDados, setTardeDados] = useState(makeEmptyRegistro(TARDE));
  const [temaEscuro, setTemaEscuro] = useState(
    () => localStorage.getItem("tema") === "escuro",
  );
  const [periodos, setPeriodos] = useState([]);
  const [forcarEdicaoData, setForcarEdicaoData] = useState(null);
  const [painelExportar, setPainelExportar] = useState(false);
  const [periodoInicioExp, setPeriodoInicioExp] = useState(hojeId());
  const [periodoFimExp, setPeriodoFimExp] = useState(hojeId());
  const [exportando, setExportando] = useState(false);
  const [totalSemana, setTotalSemana] = useState(null);
  const saveTimer = useRef(null);

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
    const unsub = observarPeriodos(user.uid, setPeriodos);
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = observarDia(user.uid, dataAtualId, (data) => {
      setManhaDados((data && data.manha) || makeEmptyRegistro(MANHA));
      setTardeDados((data && data.tarde) || makeEmptyRegistro(TARDE));
    });
    return unsub;
  }, [user, dataAtualId]);

  async function recalcularTotalSemana() {
    if (!user) return;
    const { inicio, fim } = primeiroUltimoDiaSemana(dataAtualId);
    let cursor = fromId(inicio);
    const fimDate = fromId(fim);
    let soma = 0;
    while (cursor <= fimDate) {
      const id = toId(cursor);
      const dados = await buscarDia(user.uid, id);
      if (dados) {
        soma += Object.values(dados.manha || {}).filter(
          (d) => d.turma && d.turma.trim() !== "",
        ).length;
        soma += Object.values(dados.tarde || {}).filter(
          (d) => d.turma && d.turma.trim() !== "",
        ).length;
      }
      cursor = addDias(cursor, 1);
    }
    setTotalSemana(soma);
  }

  useEffect(() => {
    recalcularTotalSemana();
  }, [user, dataAtualId]);

  function agendarSalvar(novaManha, novaTarde) {
    if (!user) return;
    clearTimeout(saveTimer.current);
    setSalvando(true);
    saveTimer.current = setTimeout(async () => {
      await salvarDia(user.uid, dataAtualId, {
        manha: novaManha,
        tarde: novaTarde,
      });
      setSalvando(false);
      recalcularTotalSemana();
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

  const totalDia = useMemo(() => {
    const m = Object.values(manhaDados).filter(
      (d) => d.turma.trim() !== "",
    ).length;
    const t = Object.values(tardeDados).filter(
      (d) => d.turma.trim() !== "",
    ).length;
    return m + t;
  }, [manhaDados, tardeDados]);

  function abrirPainelExportar() {
    setPeriodoInicioExp(dataAtualId);
    setPeriodoFimExp(dataAtualId);
    setPainelExportar(true);
  }

  async function aoExportarMesAtual() {
    setExportando(true);
    const { inicio, fim } = primeiroUltimoDiaMes(dataAtualId);
    await exportarIntervalo(
      user.uid,
      periodos,
      inicio,
      fim,
      dataAtualId,
      manhaDados,
      tardeDados,
    );
    setExportando(false);
  }

  async function aoExportarPeriodo() {
    setExportando(true);
    await exportarIntervalo(
      user.uid,
      periodos,
      periodoInicioExp,
      periodoFimExp,
      dataAtualId,
      manhaDados,
      tardeDados,
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

  const periodoAtivo = periodoQueCobre(periodos, dataAtualId);
  const forcarEdicao = forcarEdicaoData === dataAtualId;
  const ehFimDeSemanaHoje = ehFimDeSemana(fromId(dataAtualId));

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

      <div className="acessos-rapidos">
        <a
          className="botao-acesso-rapido"
          href="https://saladofuturo.educacao.sp.gov.br/"
          target="_blank"
          rel="noopener noreferrer"
        >
          🚀 Sala do Futuro
        </a>
        <a
          className="botao-acesso-rapido"
          href="https://sed.educacao.sp.gov.br/"
          target="_blank"
          rel="noopener noreferrer"
        >
          🗂️ SED
        </a>
      </div>

      {periodoAtivo && !forcarEdicao ? (
        <div className="aviso-periodo">
          <NavDia
            dataAtualId={dataAtualId}
            setDataAtualId={setDataAtualId}
            totalDia={totalDia}
          />
          <h3>{rotuloTipoPeriodo(periodoAtivo.tipo)}</h3>
          <p>
            Período de {fmtDataId(periodoAtivo.inicio)} a{" "}
            {fmtDataId(periodoAtivo.fim)}
          </p>
          {periodoAtivo.observacao && (
            <p className="aviso-periodo-obs">{periodoAtivo.observacao}</p>
          )}
          <p className="aviso-periodo-legenda">
            Este dia está marcado como sem aula. Se precisar registrar uma aula
            mesmo assim, clique abaixo.
          </p>
          <button
            className="botao-cancelar"
            onClick={() => setForcarEdicaoData(dataAtualId)}
          >
            Registrar aula mesmo assim
          </button>
        </div>
      ) : (
        <>
          <AbaColapsavel
            titulo="🌅 Turno Manhã"
            badge={`(${Object.values(manhaDados).filter((d) => d.turma.trim() !== "").length} aulas)`}
          >
            <NavDia
              dataAtualId={dataAtualId}
              setDataAtualId={setDataAtualId}
              totalDia={totalDia}
            />
            {ehFimDeSemanaHoje ? (
              <p className="aba-placeholder-texto">
                Não há aula nos fins de semana.
              </p>
            ) : (
              <Tabela
                titulo="Turno Manhã"
                rows={MANHA}
                dados={manhaDados}
                onChange={atualizarManha}
                totalSemana={totalSemana}
              />
            )}
          </AbaColapsavel>

          <AbaColapsavel
            titulo="🌇 Turno Tarde"
            badge={`(${Object.values(tardeDados).filter((d) => d.turma.trim() !== "").length} aulas)`}
          >
            <NavDia
              dataAtualId={dataAtualId}
              setDataAtualId={setDataAtualId}
              totalDia={totalDia}
            />
            {ehFimDeSemanaHoje ? (
              <p className="aba-placeholder-texto">
                Não há aula nos fins de semana.
              </p>
            ) : (
              <Tabela
                titulo="Turno Tarde"
                rows={TARDE}
                dados={tardeDados}
                onChange={atualizarTarde}
                totalSemana={totalSemana}
              />
            )}
          </AbaColapsavel>

          <AbaColapsavel titulo="🛠️ Ensino Técnico">
            <NavDia
              dataAtualId={dataAtualId}
              setDataAtualId={setDataAtualId}
              totalDia={totalDia}
            />
            <TecnicoTab user={user} dataAtualId={dataAtualId} />
          </AbaColapsavel>
        </>
      )}

      {painelExportar && (
        <div className="painel-exportar">
          <h4>Exportar por período</h4>
          <div className="painel-exportar-linha">
            <label>
              De:
              <input
                type="date"
                value={periodoInicioExp}
                onChange={(e) => setPeriodoInicioExp(e.target.value)}
              />
            </label>
            <label>
              Até:
              <input
                type="date"
                value={periodoFimExp}
                onChange={(e) => setPeriodoFimExp(e.target.value)}
              />
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

      <RascunhoRapido
        user={user}
        dataAtualId={dataAtualId}
        onTransferido={() => {}}
      />

      <ResumoTotais user={user} periodos={periodos} />

      <PainelPeriodos user={user} periodos={periodos} />

      <NotaWidget
        user={user}
        dataAtualId={dataAtualId}
        setDataAtualId={setDataAtualId}
      />

      <div className="acoes">
        <span className="status-salvando">
          {salvando ? "Salvando…" : "Salvo ✓"}
        </span>
        <button
          className="botao-exportar"
          onClick={aoExportarMesAtual}
          disabled={exportando}
        >
          ⬇ Exportar {nomeMesAno(dataAtualId)}
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
    </div>
  );
}
