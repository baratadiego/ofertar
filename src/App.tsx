import logo from './assets/logo.svg'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Aula, Docente, Projeto, Semestre } from './lib/types'
import { validar } from './lib/model'
import { abrirArquivo, arquivoAtual, carregarLocal, limparLocal, salvarArquivo, salvarLocal } from './lib/storage'
import { GradeView, type Preset } from './components/Grade'
import { Editor } from './components/Editor'
import { DocentesView, ExportarView, MatrizView, PendenciasView, VersoesView } from './components/Views'
import { ConfigView } from './components/Config'
import exemplo from './data/exemplo.json'
import { Inicio } from './components/Inicio'
import { Icone } from './components/Icones'
import { migrar, periodoDaTurma, rotuloTurma } from './lib/model'

type Aba = 'inicio' | 'grade' | 'docentes' | 'matriz' | 'pendencias' | 'versoes' | 'exportar' | 'config'
const ABAS: { id: Aba; nome: string; grupo: 'oferta' | 'conferencia' | 'projeto'; desc: string }[] = [
  { id: 'inicio', nome: 'Início', grupo: 'oferta', desc: 'Resumo do semestre e o que precisa de atenção.' },
  { id: 'grade', nome: 'Grade', grupo: 'oferta', desc: 'Escolha um componente à direita e clique nas células para marcar os horários.' },
  { id: 'docentes', nome: 'Docentes', grupo: 'oferta', desc: 'CH somada automaticamente a partir da grade. Informe a CH prevista (PAID) para conferir.' },
  { id: 'matriz', nome: 'Matriz', grupo: 'conferencia', desc: 'Obrigatórias de cada período segundo a matriz do ano de ingresso da turma.' },
  { id: 'pendencias', nome: 'Pendências', grupo: 'conferencia', desc: 'Conferência automática: choques, docentes, CH e matriz.' },
  { id: 'versoes', nome: 'Versões', grupo: 'conferencia', desc: 'Guarde cada versão enviada e compare o que mudou.' },
  { id: 'exportar', nome: 'Documentos', grupo: 'projeto', desc: 'Word para discentes e docentes, CSV de CH e memorando.' },
  { id: 'config', nome: 'Configurações', grupo: 'projeto', desc: 'Curso, horários, habilitações, matrizes e turmas do semestre.' },
]
const GRUPOS = { oferta: 'Oferta', conferencia: 'Conferência', projeto: 'Projeto' }
type Tema = 'light' | 'dark' | 'system'

function pref(k: string, v?: string) {
  try { if (v === undefined) return localStorage.getItem('ofertas-curso:' + k); localStorage.setItem('ofertas-curso:' + k, v) } catch { /* ignore */ }
  return null
}

function projetoEmBranco(): Projeto {
  const base = exemplo as unknown as Projeto
  const ano = new Date().getFullYear()
  const per = new Date().getMonth() < 6 ? 2 : 1
  const anoS = per === 1 ? ano + 1 : ano
  return {
    formato: 'ofertas-curso/1',
    config: { ...structuredClone(base.config), instituicao: 'Nome da instituição', curso: 'Nome do curso', sigla: 'CURSO', matrizes: [], habilitacoes: [{ id: 'UNICA', nome: 'Habilitação única', abrev: '' }] },
    docentes: [],
    semestres: [{ id: `${anoS}-${per}`, rotulo: `${anoS}.${per}`, ano: anoS, periodo: per, status: 'Em elaboração', turmas: [], aulas: [], chPrevista: {}, funcoes: {}, pendencias: [], ignorados: [], versoes: [], atualizadoEm: new Date().toISOString() }],
  }
}

export default function App() {
  const [proj, setProj] = useState<Projeto | null>(() => { const p = carregarLocal(); return p ? migrar(p) : null })
  const hist = useRef<{ antes: Projeto[]; depois: Projeto[] }>({ antes: [], depois: [] })
  const [, forcar] = useState(0)
  const [aba, setAba] = useState<Aba>(() => (location.hash.slice(1) as Aba) || 'inicio')
  const [semId, setSemIdRaw] = useState<string>(() => pref('semestre') ?? '')
  const [turmaSel, setTurmaSel] = useState('')
  const [aulaSel, setAulaSel] = useState<string | null>(null)
  const [editor, setEditor] = useState<{ id: string | null; preset?: Preset } | null>(null)
  const [toast, setToast] = useState('')
  const [sujo, setSujo] = useState(false)
  const [nomeArq, setNomeArq] = useState<string | null>(null)
  const [abertura, setAbertura] = useState(false)
  const [recolhido, setRecolhido] = useState(() => pref('menu') === 'recolhido')
  // instalação como app (PWA): o navegador oferece o evento quando o app pode ser instalado
  const [instalar, setInstalar] = useState<{ prompt: () => Promise<void> } | null>(null)
  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setInstalar(e as unknown as { prompt: () => Promise<void> }) }
    const ok = () => setInstalar(null)
    window.addEventListener('beforeinstallprompt', h)
    window.addEventListener('appinstalled', ok)
    return () => { window.removeEventListener('beforeinstallprompt', h); window.removeEventListener('appinstalled', ok) }
  }, [])
  const alternarMenu = () => setRecolhido(r => { pref('menu', r ? 'aberto' : 'recolhido'); return !r })
  const [tema, setTemaRaw] = useState<Tema>(() => (pref('tema') as Tema) || 'light')
  const setTema = (t: Tema) => { setTemaRaw(t); pref('tema', t) }
  useEffect(() => {
    const r = document.documentElement
    if (tema === 'system') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', tema)
  }, [tema])

  const avisar = useCallback((m: string) => { setToast(m); window.clearTimeout((avisar as unknown as { t?: number }).t); (avisar as unknown as { t?: number }).t = window.setTimeout(() => setToast(''), 3200) }, [])
  const setSemId = (id: string) => { setSemIdRaw(id); pref('semestre', id); setAulaSel(null) }

  // autosave no navegador
  useEffect(() => {
    if (!proj) return
    const t = setTimeout(() => salvarLocal(proj), 300)
    return () => clearTimeout(t)
  }, [proj])

  useEffect(() => { try { history.replaceState(null, '', '#' + aba) } catch { /* ignore */ } }, [aba])

  const mudar = useCallback((fn: (p: Projeto) => void) => {
    setProj(prev => {
      if (!prev) return prev
      const n = structuredClone(prev)
      fn(n)
      hist.current.antes.push(prev)
      if (hist.current.antes.length > 80) hist.current.antes.shift()
      hist.current.depois = []
      return n
    })
    setSujo(true)
    forcar(x => x + 1)
  }, [])

  const sem: Semestre | undefined = useMemo(() => {
    if (!proj) return undefined
    return proj.semestres.find(s => s.id === semId) ?? [...proj.semestres].sort((a, b) => b.ano - a.ano || b.periodo - a.periodo)[0]
  }, [proj, semId])

  const mudarSem = useCallback((fn: (s: Semestre, p: Projeto) => void) => {
    const id = sem?.id
    mudar(p => { const s = p.semestres.find(x => x.id === id); if (s) { fn(s, p); s.atualizadoEm = new Date().toISOString() } })
  }, [mudar, sem?.id])

  const desfazer = useCallback(() => {
    const h = hist.current
    const prev = h.antes.pop()
    if (!prev) return
    setProj(cur => { if (cur) h.depois.push(cur); return prev })
    forcar(x => x + 1)
  }, [])
  const refazer = useCallback(() => {
    const h = hist.current
    const nx = h.depois.pop()
    if (!nx) return
    setProj(cur => { if (cur) h.antes.push(cur); return nx })
    forcar(x => x + 1)
  }, [])

  const salvar = useCallback(async (comoNovo = false) => {
    if (!proj) return
    try { const n = await salvarArquivo(proj, comoNovo); setNomeArq(n); setSujo(false); avisar(`Salvo em ${n}`) }
    catch (e) { if ((e as Error).name !== 'AbortError') avisar('Não foi possível salvar: ' + (e as Error).message) }
  }, [proj, avisar])

  const abrir = useCallback(async () => {
    try {
      const p = await abrirArquivo()
      if (!p) return
      hist.current = { antes: [], depois: [] }
      setProj(migrar(p)); setNomeArq(arquivoAtual()); setSujo(false); setSemIdRaw(''); setAulaSel(null)
      avisar('Projeto aberto')
    } catch (e) { if ((e as Error).name !== 'AbortError') avisar((e as Error).message) }
  }, [avisar])

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement
      const editando = alvo && ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); salvar() }
      else if (!editando && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) refazer(); else desfazer() }
      else if (!editando && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); refazer() }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [salvar, desfazer, refazer])

  const problemas = useMemo(() => (proj && sem ? validar(proj, sem) : []), [proj, sem])

  const novoExemplo = () => { hist.current = { antes: [], depois: [] }; setProj(migrar(structuredClone(exemplo as unknown as Projeto))); setSujo(true); setNomeArq(null); setSemIdRaw(''); setAbertura(false); setAba('inicio') }
  const novoBranco = () => { hist.current = { antes: [], depois: [] }; setProj(projetoEmBranco()); setAba('config'); setSujo(true); setNomeArq(null); setSemIdRaw(''); setAbertura(false) }
  if (!proj || abertura) return <BoasVindas atual={proj ? `${proj.config.curso} · ${proj.config.instituicao}` : null} onContinuar={() => setAbertura(false)}
    onAbrir={async () => { await abrir(); setAbertura(false) }} onExemplo={novoExemplo} onBranco={novoBranco} />
  if (!sem) return <div className="vazio">Projeto sem semestres.</div>

  const turmaAtual = sem.turmas.some(t => t.id === turmaSel) ? turmaSel : ([...sem.turmas].sort((a, b) => b.ingresso - a.ingresso || a.habilitacao.localeCompare(b.habilitacao))[0]?.id ?? '')
  const irPara = (turmaId: string, aulaId?: string) => { setTurmaSel(turmaId); setAulaSel(aulaId ?? null); setAba('grade') }
  const nErros = problemas.filter(p => p.nivel === 'erro').length
  const nAvisos = problemas.filter(p => p.nivel === 'aviso').length
  const aulaEd = editor?.id ? sem.aulas.find(a => a.id === editor.id) ?? null : null
  const abaInfo = ABAS.find(a => a.id === aba) ?? ABAS[0]
  const turmaObj = sem.turmas.find(t => t.id === turmaAtual)
  const titulo = aba === 'grade' && turmaObj ? rotuloTurma(proj.config, sem, turmaObj).replace(/ · \d+º sem\.$/, '') : aba === 'inicio' ? `Oferta ${sem.rotulo}` : abaInfo.nome
  const sigla = (proj.config.sigla || proj.config.curso).slice(0, 2).toUpperCase()

  return (
    <div className={`shell ${recolhido ? 'recolhido' : ''}`}>
      <aside className="lateral" aria-label="Menu">
        <div className="logo">
          <span className="sel" title={proj.config.curso}>{sigla}</span>
          <div className="txt"><b>Ofertar</b><span>{proj.config.curso}</span></div>
          <button className="recolher" onClick={alternarMenu} aria-label={recolhido ? 'Expandir menu' : 'Recolher menu'} title={recolhido ? 'Expandir menu' : 'Recolher menu'} aria-expanded={!recolhido}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" />{recolhido ? <path d="M13 10l2 2-2 2" /> : <path d="M15 10l-2 2 2 2" />}</svg>
          </button>
        </div>
        {recolhido
          ? <button className="sem-mini" onClick={alternarMenu} title={`Semestre ${sem.rotulo} — clique para trocar`}>{sem.rotulo}</button>
          : (
            <div className="semcard">
              <label htmlFor="sem-sel">Semestre</label>
              <select id="sem-sel" value={sem.id} onChange={e => setSemId(e.target.value)}>
                {[...proj.semestres].sort((a, b) => b.ano - a.ano || b.periodo - a.periodo).map(s => <option key={s.id} value={s.id}>{s.rotulo}</option>)}
              </select>
              <small>{sem.status}</small>
            </div>
          )}
        {(Object.keys(GRUPOS) as (keyof typeof GRUPOS)[]).map(g => [
          <div className="rot" key={g}>{GRUPOS[g]}</div>,
          ...ABAS.filter(a => a.grupo === g).map(a => (
            <button key={a.id} className="nav-item" title={recolhido ? a.nome : undefined} aria-label={a.nome} aria-current={aba === a.id ? 'page' : undefined} onClick={() => setAba(a.id)}>
              <Icone nome={a.id} /><span className="txt">{a.nome}</span>
              {a.id === 'pendencias' && (nErros + nAvisos > 0) && <span className={`badge ${nErros ? 'err' : 'warn'}`}>{nErros + nAvisos}</span>}
            </button>
          )),
        ])}
        <div className="rodape">
          {instalar && <button className="nav-item" title={recolhido ? 'Instalar no computador' : undefined} aria-label="Instalar no computador" onClick={() => { instalar.prompt().catch(() => {}); setInstalar(null) }}><Icone nome="exportar" /><span className="txt">Instalar no computador</span></button>}
          <button className="nav-item" title={recolhido ? 'Salvar arquivo' : undefined} aria-label="Salvar arquivo" onClick={() => salvar()}><Icone nome="salvar" /><span className="txt">Salvar arquivo</span></button>
          <button className="nav-item" title={recolhido ? 'Tela inicial' : undefined} aria-label="Tela inicial" onClick={() => setAbertura(true)}><Icone nome="sair" /><span className="txt">Tela inicial</span></button>
          <div className="tema" role="group" aria-label="Aparência">
            {(['light', 'dark', 'system'] as Tema[]).map(t => <button key={t} aria-pressed={tema === t} onClick={() => setTema(t)}>{t === 'light' ? 'Claro' : t === 'dark' ? 'Escuro' : 'Sistema'}</button>)}
          </div>
        </div>
      </aside>

      <div className="principal">
        <header className="cabeca">
          <div>
            <div className="trilha">
              <button onClick={() => setAba('inicio')}>{sem.rotulo}</button><span>›</span>
              {aba === 'grade' && turmaObj ? <><button onClick={() => setAulaSel(null)}>Grade</button><span>›</span><b>{periodoDaTurma(sem, turmaObj)}º semestre</b></> : <b>{abaInfo.nome}</b>}
            </div>
            <h1>{titulo}</h1>
            <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{abaInfo.desc}</div>
          </div>
          <div className="acoes">
            <button className="btn" onClick={desfazer} disabled={!hist.current.antes.length} title="Desfazer (Ctrl+Z)">↶ Desfazer</button>
            <button className="btn" onClick={refazer} disabled={!hist.current.depois.length} title="Refazer (Ctrl+Y)">↷ Refazer</button>
            <span className={`salvo ${sujo ? 'pendente' : ''}`} title="As alterações ficam guardadas neste navegador automaticamente">
              <i />{sujo ? (nomeArq ? `Não salvo em ${nomeArq}` : 'Arquivo não salvo') : nomeArq ? `Salvo em ${nomeArq}` : 'Guardado no navegador'}
            </span>
            <button className="btn pri" onClick={() => salvar()} title="Salvar no arquivo .json (Ctrl+S)">Salvar arquivo</button>
          </div>
        </header>
        <main className="conteudo">
          {aba === 'inicio' && <Inicio proj={proj} sem={sem} mudarSem={mudarSem} problemas={problemas} irTurma={irPara} irAba={a => setAba(a)} />}
          {aba === 'grade' && <GradeView proj={proj} sem={sem} mudarSem={mudarSem} problemas={problemas} turmaSel={turmaAtual} setTurmaSel={setTurmaSel} aulaSel={aulaSel} setAulaSel={setAulaSel}
            alternarHorario={(id, cel) => mudarSem(s => { const a = s.aulas.find(x => x.id === id)!; a.horarios = a.horarios.includes(cel) ? a.horarios.filter(h => h !== cel) : [...a.horarios, cel] })}
            abrirEditor={(id, preset) => setEditor({ id, preset })} />}
          {aba === 'docentes' && <DocentesView proj={proj} sem={sem} mudar={mudar} mudarSem={mudarSem} irPara={irPara} />}
          {aba === 'matriz' && <MatrizView proj={proj} sem={sem} turmaSel={turmaAtual} setTurmaSel={setTurmaSel} abrirEditor={(id, preset) => setEditor({ id, preset })} />}
          {aba === 'pendencias' && <PendenciasView proj={proj} sem={sem} problemas={problemas} mudarSem={mudarSem} irPara={irPara} irDocentes={() => setAba('docentes')} />}
          {aba === 'versoes' && <VersoesView proj={proj} sem={sem} mudarSem={mudarSem} avisar={avisar} />}
          {aba === 'exportar' && <ExportarView proj={proj} sem={sem} avisar={avisar} salvarArquivo={() => salvar()} />}
          {aba === 'config' && <ConfigView proj={proj} sem={sem} mudar={mudar} mudarSem={mudarSem} setSemId={setSemId} avisar={avisar} abrir={abrir} salvarComo={() => salvar(true)}
            sair={() => { limparLocal(); hist.current = { antes: [], depois: [] }; setProj(null); setNomeArq(null) }} />}
        </main>
      </div>
      {editor && <Editor proj={proj} sem={sem} aula={aulaEd} preset={editor.preset} onFechar={() => setEditor(null)}
        onSalvar={(a: Aula, novo?: Docente) => {
          mudar(p => {
            if (novo) p.docentes.push(novo)
            const s = p.semestres.find(x => x.id === sem.id)!
            const i = s.aulas.findIndex(x => x.id === a.id)
            if (i >= 0) s.aulas[i] = a; else s.aulas.push(a)
          })
          setEditor(null)
          if (!a.moduloLivre && a.horarios.length === 0 && a.turmas.length) { setTurmaSel(a.turmas.includes(turmaAtual) ? turmaAtual : a.turmas[0]); setAulaSel(a.id); setAba('grade') }
        }}
        onExcluir={id => { mudarSem(s => { s.aulas = s.aulas.filter(x => x.id !== id) }); setEditor(null); setAulaSel(null); avisar('Componente excluído. Use Desfazer se precisar.') }} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}

function BoasVindas({ atual, onContinuar, onAbrir, onExemplo, onBranco }: { atual: string | null; onContinuar: () => void; onAbrir: () => void; onExemplo: () => void; onBranco: () => void }) {
  const amostra = [[1, 1, 0, 1, 1, 0], [1, 1, 0, 1, 1, 0], [1, 2, 1, 1, 0, 1], [1, 2, 1, 0, 0, 1], [0, 0, 1, 0, 3, 1]]
  return (
    <div className="boas">
      <div className="mini-grade" aria-hidden="true">
        {amostra.map((r, i) => [<i className="h" key={'h' + i}>{['07:30', '08:20', '09:10', '10:20', '11:10'][i]}</i>, ...r.map((v, j) => <i key={i + '-' + j} style={v ? { background: `hsl(${[0, 155, 30, 210][v]} 40% var(--cell-l))`, borderLeft: `3px solid hsl(${[0, 155, 30, 210][v]} 50% var(--cell-b))` } : undefined} />)])}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src={logo} alt="" width={40} height={40} />
        <span style={{ font: '600 22px var(--f-body)', letterSpacing: '-.01em' }}>Ofertar</span>
      </div>
      <h1>Organize a oferta de disciplinas do curso num lugar só</h1>
      <p>Monte a grade de cada turma, distribua a carga horária docente e deixe o app apontar choques de horário, componentes sem docente e obrigatórias que ficaram de fora. Os documentos para discentes e docentes saem prontos em Word.</p>
      {atual && (
        <button className="opcao" onClick={onContinuar} style={{ borderColor: 'var(--accent)' }}>
          <b>Continuar o projeto aberto</b><span>{atual} — tudo como você deixou.</span>
        </button>
      )}
      <div className="opcoes">
        <button className="opcao" onClick={onAbrir}><b>Abrir arquivo de projeto</b><span>Um .json salvo antes, por exemplo na pasta da secretaria.</span></button>
        <button className="opcao" onClick={onExemplo}><b>Explorar um curso de exemplo</b><span>Curso fictício com matrizes, docentes e uma oferta montada, para conhecer o app antes de cadastrar o seu.{atual ? ' Substitui o projeto aberto (salve antes).' : ''}</span></button>
        <button className="opcao" onClick={onBranco}><b>Começar um curso novo</b><span>Configure horários, habilitações e matrizes do seu curso.{atual ? ' Substitui o projeto aberto (salve antes).' : ''}</span></button>
      </div>
      <p style={{ fontSize: 13 }}>Os dados ficam neste navegador e no arquivo que você salvar. Nada é enviado para servidores.</p>
      <p style={{ fontSize: 12.5, borderTop: '1px solid var(--line)', paddingTop: 12 }}>Ofertar · desenvolvido no Laboratório Multidisciplinar de Ensino (LAMEN) da Universidade Federal do Amapá · Francisco Diego Barros Barata · software livre (licença MIT) · <a href="https://github.com/baratadiego/ofertar" target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>código e manual</a></p>
    </div>
  )
}
