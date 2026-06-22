   import { useState, useEffect, useMemo, useRef } from 'react'
import './App.css'
import {
  loginComGoogle, logout, observarLogin,
  salvarDia, observarDia, buscarDia,
  salvarPeriodo, observarPeriodos, excluirPeriodo,
  salvarNota, moverNotaParaLixeira, restaurarNota, excluirNotaDefinitivamente, observarNota,
  salvarRascunho, observarRascunho, excluirRascunho,
} from './firebase'

const DIAS_LIXEIRA = 15

const ESCOLA = 'E.E. Prof. Simão Mathias'
const ENDERECO = 'Av. Ragueb Chohfi, 4757 — Jardim Três Marias, São Paulo - SP, 08380-330'

const MANHA = [
  { aula: '1ª aula', inicio: '7h00', fim: '7h50' },
  { aula: '2ª aula', inicio: '7h50', fim: '8h40' },
  { aula: '3ª aula', inicio: '8h40', fim: '9h30' },
  { aula: 'Intervalo', inicio: '9h30', fim: '9h50', intervalo: true },
  { aula: '4ª aula', inicio: '9h50', fim: '10h40' },
  { aula: '5ª aula', inicio: '10h40', fim: '11h30' },
  { aula: '6ª aula', inicio: '11h30', fim: '12h20' },
]

const TARDE = [
  { aula: '1ª aula', inicio: '13h00', fim: '13h50' },
  { aula: '2ª aula', inicio: '13h50', fim: '14h40' },
  { aula: '3ª aula', inicio: '14h40', fim: '15h30' },
  { aula: 'Intervalo', inicio: '15h30', fim: '15h50', intervalo: true },
  { aula: '4ª aula', inicio: '15h50', fim: '16h40' },
  { aula: '5ª aula', inicio: '16h40', fim: '17h30' },
  { aula: '6ª aula', inicio: '17h30', fim: '18h20' },
]

const NOMES_DIA_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const MESES_NOMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

const TIPOS_PERIODO = [
  { valor: 'ferias', rotulo: '🏖️ Férias' },
  { valor: 'feriado', rotulo: '📅 Feriado' },
  { valor: 'atestado', rotulo: '🩺 Atestado' },
  { valor: 'outro', rotulo: 'ℹ️ Outro motivo' },
]

function rotuloTipoPeriodo(tipo) {
  const item = TIPOS_PERIODO.find((t) => t.valor === tipo)
  return item ? item.rotulo : tipo
}

// --- Funções de data (tudo baseado em ID "AAAA-MM-DD", sem ambiguidade de fuso) ---

function pad(n) {
  return String(n).padStart(2, '0')
}

function toId(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function fromId(id) {
  const [ano, mes, dia] = id.split('-').map(Number)
  return new Date(ano, mes - 1, dia)
}

function addDias(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function fmtData(date) {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
}

function fmtDataId(id) {
  return fmtData(fromId(id))
}

function nomeDiaSemana(date) {
  return NOMES_DIA_SEMANA[date.getDay()]
}

function hojeId() {
  return toId(new Date())
}

function ehFimDeSemana(date) {
  const d = date.getDay()
  return d === 0 || d === 6
}

function diaAnteriorUtil(id) {
  let d = addDias(fromId(id), -1)
  while (ehFimDeSemana(d)) d = addDias(d, -1)
  return toId(d)
}

function diaProximoUtil(id) {
  let d = addDias(fromId(id), 1)
  while (ehFimDeSemana(d)) d = addDias(d, 1)
  return toId(d)
}

function primeiroUltimoDiaMes(dataId) {
  const d = fromId(dataId)
  const ano = d.getFullYear()
  const mes = d.getMonth()
  const primeiro = new Date(ano, mes, 1)
  const ultimo = new Date(ano, mes + 1, 0)
  return { inicio: toId(primeiro), fim: toId(ultimo) }
}

function primeiroUltimoDiaSemana(dataId) {
  const d = fromId(dataId)
  const diaSemana = d.getDay() // 0=domingo, 1=segunda, ... 6=sabado
  const deltaSegunda = diaSemana === 0 ? -6 : 1 - diaSemana
  const segunda = addDias(d, deltaSegunda)
  const sexta = addDias(segunda, 4)
  return { inicio: toId(segunda), fim: toId(sexta) }
}

function nomeMesAno(dataId) {
  const d = fromId(dataId)
  return `${MESES_NOMES[d.getMonth()]} de ${d.getFullYear()}`
}

function periodoQueCobre(periodos, dataId) {
  return periodos.find((p) => p.inicio <= dataId && dataId <= p.fim)
}

function makeEmptyRegistro(rows) {
  const r = {}
  rows.forEach((row, i) => {
    if (!row.intervalo) r[i] = { turma: '', professor: '', conteudo: '' }
  })
  return r
}

function algumPreenchido(dados) {
  return dados && Object.values(dados).some((d) => d.turma && d.turma.trim() !== '')
}

// --- Exportação ---

function blocoDiaCSV(linhas, dataId, manhaDados, tardeDados) {
  const d = fromId(dataId)
  linhas.push([`════ ${nomeDiaSemana(d)} — ${fmtData(d)} ════`])
  linhas.push([])
  const addBloco = (titulo, rows, dados) => {
    linhas.push([titulo])
    linhas.push(['Aula', 'Início', 'Fim', 'Turma', 'Professor / Matéria', 'Conteúdo dado'])
    rows.forEach((row, i) => {
      if (row.intervalo) {
        linhas.push([row.aula, row.inicio, row.fim, '— intervalo —', '', ''])
      } else {
        const dd = dados[i] || { turma: '', professor: '', conteudo: '' }
        linhas.push([row.aula, row.inicio, row.fim, dd.turma, dd.professor, dd.conteudo])
      }
    })
    linhas.push([])
  }
  addBloco('Turno Manhã', MANHA, manhaDados)
  addBloco('Turno Tarde', TARDE, tardeDados)
  linhas.push([])
}

function baixarCSV(linhas, nomeArquivo) {
  const csv = linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  a.click()
  URL.revokeObjectURL(url)
}

async function exportarIntervalo(uid, periodos, inicioId, fimId, dataAtualId, manhaAtual, tardeAtual) {
  const linhas = []
  linhas.push([ESCOLA])
  linhas.push(['Professor: Thiago Fernando'])
  linhas.push([`Período: ${fmtDataId(inicioId)} a ${fmtDataId(fimId)}`])
  linhas.push([])

  let cursor = fromId(inicioId)
  const fim = fromId(fimId)
  let teveConteudo = false

  while (cursor <= fim) {
    const id = toId(cursor)
    const periodo = periodoQueCobre(periodos, id)

    if (periodo) {
      linhas.push([`── ${rotuloTipoPeriodo(periodo.tipo)}: ${fmtDataId(periodo.inicio)} a ${fmtDataId(periodo.fim)}${periodo.observacao ? ' — ' + periodo.observacao : ''} ──`])
      linhas.push([])
      teveConteudo = true
      const proximoCursor = addDias(fromId(periodo.fim), 1)
      cursor = proximoCursor > cursor ? proximoCursor : addDias(cursor, 1)
      continue
    }

    let dados
    if (id === dataAtualId) {
      dados = { manha: manhaAtual, tarde: tardeAtual }
    } else {
      dados = await buscarDia(uid, id)
    }

    if (dados && (algumPreenchido(dados.manha) || algumPreenchido(dados.tarde))) {
      blocoDiaCSV(linhas, id, dados.manha || makeEmptyRegistro(MANHA), dados.tarde || makeEmptyRegistro(TARDE))
      teveConteudo = true
    }

    cursor = addDias(cursor, 1)
  }

  if (!teveConteudo) {
    linhas.push(['Nenhuma aula ou período especial registrado neste intervalo.'])
  }

  const nomeBase = `registro-aulas_${inicioId}_a_${fimId}`
  baixarCSV(linhas, `${nomeBase}.csv`)
}

// --- Componentes ---

function Tabela({ titulo, rows, dados, onChange }) {
  return (
    <div className="tabela-bloco">
      <h3>{titulo}</h3>
      <table>
        <thead>
          <tr>
            <th>Aula</th><th>Início</th><th>Fim</th><th>Turma</th><th>Professor / Matéria</th><th>Conteúdo dado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            if (row.intervalo) {
              return (
                <tr key={i} className="linha-intervalo">
                  <td>{row.aula}</td><td>{row.inicio}</td><td>{row.fim}</td>
                  <td colSpan={3}>— intervalo —</td>
                </tr>
              )
            }
            const d = dados[i] || { turma: '', professor: '', conteudo: '' }
            const preenchida = d.turma.trim() !== ''
            return (
              <tr key={i} className={preenchida ? 'linha-dada' : ''}>
                <td>{row.aula}</td><td>{row.inicio}</td><td>{row.fim}</td>
                <td><input value={d.turma} placeholder="ex: 7º A" onChange={(e) => onChange(i, 'turma', e.target.value)} /></td>
                <td><input value={d.professor} placeholder="ex: Maria — Matemática" onChange={(e) => onChange(i, 'professor', e.target.value)} /></td>
                <td><input value={d.conteudo} placeholder="ex: Equações de 1º grau" onChange={(e) => onChange(i, 'conteudo', e.target.value)} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="total">
        Total — {titulo}: <strong>{Object.values(dados).filter((d) => d.turma.trim() !== '').length}</strong>
      </div>
    </div>
  )
}

function PainelPeriodos({ user, periodos }) {
  const [aberto, setAberto] = useState(false)
  const [tipo, setTipo] = useState('ferias')
  const [inicio, setInicio] = useState(hojeId())
  const [fim, setFim] = useState(hojeId())
  const [observacao, setObservacao] = useState('')

  function salvar() {
    if (inicio > fim) {
      alert('A data de início precisa ser antes (ou igual) à data de fim.')
      return
    }
    salvarPeriodo(user.uid, { tipo, inicio, fim, observacao, criadoEm: Date.now() })
    setObservacao('')
  }

  function remover(id) {
    if (confirm('Remover este período especial?')) {
      excluirPeriodo(user.uid, id)
    }
  }

  if (!aberto) {
    return (
      <button className="botao-periodos-abrir" onClick={() => setAberto(true)}>
        📅 Gerenciar períodos especiais (férias, feriado, atestado){periodos.length > 0 ? ` — ${periodos.length} cadastrado(s)` : ''}
      </button>
    )
  }

  return (
    <div className="painel-periodos">
      <div className="painel-periodos-cabecalho">
        <h3>📅 Períodos especiais</h3>
        <button className="botao-fechar-rascunho" onClick={() => setAberto(false)}>Fechar</button>
      </div>
      <p className="rascunho-dica">Marque férias, feriados ou atestados. Esses dias deixam de aparecer como "vazios" e mostram o motivo certo no registro e na exportação.</p>

      <div className="periodo-form">
        <label>
          Tipo
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS_PERIODO.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
          </select>
        </label>
        <label>
          De
          <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </label>
        <label>
          Até
          <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
        </label>
        <label className="periodo-form-obs">
          Observação (opcional)
          <input type="text" value={observacao} placeholder="ex: Atestado médico" onChange={(e) => setObservacao(e.target.value)} />
        </label>
        <button className="botao-transferir" onClick={salvar}>+ Adicionar período</button>
      </div>

      {periodos.length > 0 && (
        <div className="periodo-lista">
          {periodos
            .slice()
            .sort((a, b) => (a.inicio < b.inicio ? 1 : -1))
            .map((p) => (
              <div key={p.id} className="periodo-item">
                <span>{rotuloTipoPeriodo(p.tipo)} — {fmtDataId(p.inicio)} a {fmtDataId(p.fim)}{p.observacao ? ` (${p.observacao})` : ''}</span>
                <button className="botao-apagar-nota" onClick={() => remover(p.id)}>Remover</button>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

function RascunhoRapido({ user, dataAtualId, onTransferido }) {
  const [aberto, setAberto] = useState(false)
  const [turmasManha, setTurmasManha] = useState({})
  const [turmasTarde, setTurmasTarde] = useState({})
  const saveTimer = useRef(null)
  const dataId = hojeId()

  useEffect(() => {
    if (!user) return
    const unsub = observarRascunho(user.uid, dataId, (data) => {
      setTurmasManha((data && data.manha) || {})
      setTurmasTarde((data && data.tarde) || {})
    })
    return unsub
  }, [user, dataId])

  function aoDigitar(turno, i, valor) {
    const atualizado = turno === 'manha' ? { ...turmasManha, [i]: valor } : { ...turmasTarde, [i]: valor }
    if (turno === 'manha') setTurmasManha(atualizado)
    else setTurmasTarde(atualizado)

    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      salvarRascunho(user.uid, dataId, {
        manha: turno === 'manha' ? atualizado : turmasManha,
        tarde: turno === 'tarde' ? atualizado : turmasTarde,
      })
    }, 400)
  }

  function apagarRascunho() {
    excluirRascunho(user.uid, dataId)
    setTurmasManha({})
    setTurmasTarde({})
  }

  async function transferirParaOficial() {
    const atual = await buscarDia(user.uid, dataId)
    let novaManha = (atual && atual.manha) || makeEmptyRegistro(MANHA)
    let novaTarde = (atual && atual.tarde) || makeEmptyRegistro(TARDE)

    Object.entries(turmasManha).forEach(([i, valor]) => {
      if (valor && valor.trim() !== '') {
        novaManha = { ...novaManha, [i]: { ...novaManha[i], turma: valor } }
      }
    })
    Object.entries(turmasTarde).forEach(([i, valor]) => {
      if (valor && valor.trim() !== '') {
        novaTarde = { ...novaTarde, [i]: { ...novaTarde[i], turma: valor } }
      }
    })

    await salvarDia(user.uid, dataId, { manha: novaManha, tarde: novaTarde })
    apagarRascunho()
    setAberto(false)
    if (dataAtualId === dataId && onTransferido) onTransferido()
  }

  const temAlgo = Object.values(turmasManha).some((v) => v && v.trim() !== '') ||
    Object.values(turmasTarde).some((v) => v && v.trim() !== '')

  if (!aberto) {
    return (
      <button className="botao-rascunho-abrir" onClick={() => setAberto(true)}>
        ⚡ Anotação rápida do dia{temAlgo ? ' (tem rascunho salvo)' : ''}
      </button>
    )
  }

  return (
    <div className="rascunho-bloco">
      <div className="rascunho-cabecalho">
        <h3>⚡ Anotação rápida — hoje ({fmtDataId(dataId)})</h3>
        <button className="botao-fechar-rascunho" onClick={() => setAberto(false)}>Fechar</button>
      </div>
      <p className="rascunho-dica">Anote só a sala/turma que a administração informar. Depois clique em "Transferir" para preencher a tabela oficial de hoje.</p>

      <div className="rascunho-colunas">
        <div className="rascunho-coluna">
          <h4>Manhã</h4>
          {MANHA.map((row, i) => row.intervalo ? null : (
            <div key={i} className="rascunho-linha">
              <span>{row.aula}</span>
              <input
                value={turmasManha[i] || ''}
                placeholder="sala / turma"
                onChange={(e) => aoDigitar('manha', i, e.target.value)}
              />
            </div>
          ))}
        </div>
        <div className="rascunho-coluna">
          <h4>Tarde</h4>
          {TARDE.map((row, i) => row.intervalo ? null : (
            <div key={i} className="rascunho-linha">
              <span>{row.aula}</span>
              <input
                value={turmasTarde[i] || ''}
                placeholder="sala / turma"
                onChange={(e) => aoDigitar('tarde', i, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="rascunho-acoes">
        <button className="botao-transferir" onClick={transferirParaOficial} disabled={!temAlgo}>
          ✅ Transferir para a tabela oficial de hoje
        </button>
        <button className="botao-apagar-rascunho" onClick={apagarRascunho} disabled={!temAlgo}>
          🗑 Apagar rascunho
        </button>
      </div>
    </div>
  )
}

function NotaWidget({ user }) {
  const [nota, setNota] = useState(null)
  const [texto, setTexto] = useState('')
  const saveTimer = useRef(null)

  useEffect(() => {
    if (!user) return
    const unsub = observarNota(user.uid, (data) => {
      setNota(data)
      if (data && !data.excluida) setTexto(data.texto || '')
      if (!data) setTexto('')
    })
    return unsub
  }, [user])

  useEffect(() => {
    if (!nota || !nota.excluida || !nota.excluidaEm) return
    const dias = (Date.now() - nota.excluidaEm) / (1000 * 60 * 60 * 24)
    if (dias >= DIAS_LIXEIRA) {
      excluirNotaDefinitivamente(user.uid)
    }
  }, [nota, user])

  function aoDigitar(valor) {
    setTexto(valor)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      salvarNota(user.uid, valor)
    }, 500)
  }

  function apagar() {
    moverNotaParaLixeira(user.uid, texto)
  }

  function restaurar() {
    restaurarNota(user.uid)
  }

  const naLixeira = nota && nota.excluida
  const diasRestantes = (naLixeira && nota.excluidaEm)
    ? Math.max(0, DIAS_LIXEIRA - Math.floor((Date.now() - nota.excluidaEm) / (1000 * 60 * 60 * 24)))
    : null

  return (
    <div className="nota-bloco">
      <div className="nota-cabecalho">
        <h3>📝 Bloco de notas</h3>
        {!naLixeira && <button className="botao-apagar-nota" onClick={apagar} disabled={!texto}>Apagar</button>}
      </div>

      {naLixeira ? (
        <div className="nota-lixeira">
          <p>Nota apagada — fica na lixeira por mais <strong>{diasRestantes} dia(s)</strong> antes de excluir para sempre.</p>
          <p className="nota-preview">{nota.texto?.slice(0, 120) || '(nota vazia)'}{nota.texto?.length > 120 ? '…' : ''}</p>
          <button className="botao-restaurar" onClick={restaurar}>Restaurar nota</button>
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
  )
}

function TelaLogin() {
  return (
    <div className="login-tela">
      <div className="login-card">
        <h1>{ESCOLA}</h1>
        <p>{ENDERECO}</p>
        <p className="subtitulo">Controle de Aulas — Professor Thiago Fernando</p>
        <button className="botao-login" onClick={loginComGoogle}>Entrar com Google</button>
      </div>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(undefined)
  const [dataAtualId, setDataAtualId] = useState(hojeId())
  const [salvando, setSalvando] = useState(false)
  const [manhaDados, setManhaDados] = useState(makeEmptyRegistro(MANHA))
  const [tardeDados, setTardeDados] = useState(makeEmptyRegistro(TARDE))
  const [temaEscuro, setTemaEscuro] = useState(() => localStorage.getItem('tema') === 'escuro')
  const [periodos, setPeriodos] = useState([])
  const [forcarEdicaoData, setForcarEdicaoData] = useState(null)
  const [painelExportar, setPainelExportar] = useState(false)
  const [periodoInicioExp, setPeriodoInicioExp] = useState(hojeId())
  const [periodoFimExp, setPeriodoFimExp] = useState(hojeId())
  const [exportando, setExportando] = useState(false)
  const [totalSemana, setTotalSemana] = useState(null)
  const saveTimer = useRef(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-tema', temaEscuro ? 'escuro' : 'claro')
    localStorage.setItem('tema', temaEscuro ? 'escuro' : 'claro')
  }, [temaEscuro])

  useEffect(() => observarLogin(setUser), [])

  useEffect(() => {
    if (!user) return
    const unsub = observarPeriodos(user.uid, setPeriodos)
    return unsub
  }, [user])

  useEffect(() => {
    if (!user) return
    const unsub = observarDia(user.uid, dataAtualId, (data) => {
      setManhaDados((data && data.manha) || makeEmptyRegistro(MANHA))
      setTardeDados((data && data.tarde) || makeEmptyRegistro(TARDE))
    })
    return unsub
  }, [user, dataAtualId])

  async function recalcularTotalSemana() {
    if (!user) return
    const { inicio, fim } = primeiroUltimoDiaSemana(dataAtualId)
    let cursor = fromId(inicio)
    const fimDate = fromId(fim)
    let soma = 0
    while (cursor <= fimDate) {
      const id = toId(cursor)
      const dados = await buscarDia(user.uid, id)
      if (dados) {
        soma += Object.values(dados.manha || {}).filter((d) => d.turma && d.turma.trim() !== '').length
        soma += Object.values(dados.tarde || {}).filter((d) => d.turma && d.turma.trim() !== '').length
      }
      cursor = addDias(cursor, 1)
    }
    setTotalSemana(soma)
  }

  useEffect(() => {
    recalcularTotalSemana()
  }, [user, dataAtualId])

  function agendarSalvar(novaManha, novaTarde) {
    if (!user) return
    clearTimeout(saveTimer.current)
    setSalvando(true)
    saveTimer.current = setTimeout(async () => {
      await salvarDia(user.uid, dataAtualId, { manha: novaManha, tarde: novaTarde })
      setSalvando(false)
      recalcularTotalSemana()
    }, 600)
  }

  function atualizarManha(i, campo, valor) {
    const novo = { ...manhaDados, [i]: { ...manhaDados[i], [campo]: valor } }
    setManhaDados(novo)
    agendarSalvar(novo, tardeDados)
  }

  function atualizarTarde(i, campo, valor) {
    const novo = { ...tardeDados, [i]: { ...tardeDados[i], [campo]: valor } }
    setTardeDados(novo)
    agendarSalvar(manhaDados, novo)
  }

  const totalDia = useMemo(() => {
    const m = Object.values(manhaDados).filter((d) => d.turma.trim() !== '').length
    const t = Object.values(tardeDados).filter((d) => d.turma.trim() !== '').length
    return m + t
  }, [manhaDados, tardeDados])

  function abrirPainelExportar() {
    setPeriodoInicioExp(dataAtualId)
    setPeriodoFimExp(dataAtualId)
    setPainelExportar(true)
  }

  async function aoExportarMesAtual() {
    setExportando(true)
    const { inicio, fim } = primeiroUltimoDiaMes(dataAtualId)
    await exportarIntervalo(user.uid, periodos, inicio, fim, dataAtualId, manhaDados, tardeDados)
    setExportando(false)
  }

  async function aoExportarPeriodo() {
    setExportando(true)
    await exportarIntervalo(user.uid, periodos, periodoInicioExp, periodoFimExp, dataAtualId, manhaDados, tardeDados)
    setExportando(false)
    setPainelExportar(false)
  }

  if (user === undefined) {
    return <div className="carregando">Carregando…</div>
  }

  if (user === null) {
    return <TelaLogin />
  }

  const dataObj = fromId(dataAtualId)
  const periodoAtivo = periodoQueCobre(periodos, dataAtualId)
  const ehHoje = dataAtualId === hojeId()
  const forcarEdicao = forcarEdicaoData === dataAtualId

  return (
    <div className="app">
      <header className="cabecalho">
        <div className="cabecalho-topo">
          <div>
            <h1>{ESCOLA}</h1>
            <p>{ENDERECO}</p>
            <p className="professor">Professor: Thiago Fernando</p>
          </div>
          <button className="botao-sair" onClick={logout}>Sair</button>
          <button className="botao-tema" onClick={() => setTemaEscuro(!temaEscuro)}>
            {temaEscuro ? '☀️ Claro' : '🌙 Escuro'}
          </button>
        </div>
      </header>

      <div className="nav-dia">
        <button onClick={() => setDataAtualId(diaAnteriorUtil(dataAtualId))}>← Dia anterior</button>
        <div className="nav-dia-central">
          <input
            type="date"
            value={dataAtualId}
            onChange={(e) => setDataAtualId(e.target.value)}
          />
          <span className="nav-dia-nome">{nomeDiaSemana(dataObj)}</span>
          {!ehHoje && <button className="botao-ir-hoje" onClick={() => setDataAtualId(hojeId())}>Ir para hoje</button>}
        </div>
        <button onClick={() => setDataAtualId(diaProximoUtil(dataAtualId))}>Próximo dia →</button>
      </div>

      <RascunhoRapido user={user} dataAtualId={dataAtualId} onTransferido={() => {}} />

      <PainelPeriodos user={user} periodos={periodos} />

      <NotaWidget user={user} />

      <div className="acoes">
        <span className="status-salvando">{salvando ? 'Salvando…' : 'Salvo ✓'}</span>
        <button className="botao-exportar" onClick={aoExportarMesAtual} disabled={exportando}>
          ⬇ Exportar {nomeMesAno(dataAtualId)}
        </button>
        <button className="botao-periodo" onClick={abrirPainelExportar} disabled={exportando}>
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
              <input type="date" value={periodoInicioExp} onChange={(e) => setPeriodoInicioExp(e.target.value)} />
            </label>
            <label>
              Até:
              <input type="date" value={periodoFimExp} onChange={(e) => setPeriodoFimExp(e.target.value)} />
            </label>
          </div>
          <div className="painel-exportar-acoes">
            <button className="botao-exportar" onClick={aoExportarPeriodo} disabled={exportando}>
              {exportando ? 'Gerando…' : '⬇ Gerar arquivo deste período'}
            </button>
            <button className="botao-cancelar" onClick={() => setPainelExportar(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {periodoAtivo && !forcarEdicao ? (
        <div className="aviso-periodo">
          <h3>{rotuloTipoPeriodo(periodoAtivo.tipo)}</h3>
          <p>Período de {fmtDataId(periodoAtivo.inicio)} a {fmtDataId(periodoAtivo.fim)}</p>
          {periodoAtivo.observacao && <p className="aviso-periodo-obs">{periodoAtivo.observacao}</p>}
          <p className="aviso-periodo-legenda">Este dia está marcado como sem aula. Se precisar registrar uma aula mesmo assim, clique abaixo.</p>
          <button className="botao-cancelar" onClick={() => setForcarEdicaoData(dataAtualId)}>Registrar aula mesmo assim</button>
        </div>
      ) : (
        <>
          <Tabela titulo="Turno Manhã" rows={MANHA} dados={manhaDados} onChange={atualizarManha} />
          <Tabela titulo="Turno Tarde" rows={TARDE} dados={tardeDados} onChange={atualizarTarde} />
          <div className="total-geral">
            <div>Total de aulas no dia: <strong>{totalDia}</strong></div>
            <div className="total-semana">Total de aulas nesta semana (Seg a Sex): <strong>{totalSemana === null ? '…' : totalSemana}</strong></div>
          </div>
        </>
      )}
    </div>
  )
}   
