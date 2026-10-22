import { useMemo, useState } from 'react'
import type { Aula, Docente, Projeto, Semestre } from '../lib/types'
import { matrizDaTurma, norm, resumoHorarios, rotuloTurma, sugereModuloLivre, uid } from '../lib/model'
import { Campo, Modal } from './ui'
import type { Preset } from './Grade'

interface Props {
  proj: Projeto
  sem: Semestre
  aula: Aula | null
  preset?: Preset
  onSalvar: (a: Aula, novoDocente?: Docente) => void
  onExcluir: (id: string) => void
  onFechar: () => void
}

export function Editor({ proj, sem, aula, preset, onSalvar, onExcluir, onFechar }: Props) {
  const c = proj.config
  const [a, setA] = useState<Aula>(() => aula ? structuredClone(aula) : {
    id: uid('a'), codigo: preset?.codigo ?? '', nome: preset?.nome ?? '', ch: preset?.ch ?? 60,
    turmas: preset?.turmaId ? [preset.turmaId] : [], alocacao: [], horarios: preset?.horario ? [preset.horario] : [],
    moduloLivre: !preset?.horario && sugereModuloLivre(preset?.nome ?? ''), externo: false, colegiado: '', optativa: false, obs: '',
  })
  const [busca, setBusca] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const [novoDoc, setNovoDoc] = useState<Docente | null>(null)
  const set = (patch: Partial<Aula>) => setA(x => ({ ...x, ...patch }))

  const docentes = useMemo(() => {
    const l = [...proj.docentes]
    if (novoDoc) l.push(novoDoc)
    return l.sort((x, y) => Number(x.vinculo === 'externo') - Number(y.vinculo === 'externo') || x.nome.localeCompare(y.nome))
  }, [proj.docentes, novoDoc])

  const [outrasHab, setOutrasHab] = useState(false)
  const [todasTurmas, setTodasTurmas] = useState(false)
  // habilitações das turmas marcadas (ou da turma de origem)
  const habs = useMemo(() => new Set(sem.turmas.filter(t => a.turmas.includes(t.id)).map(t => t.habilitacao)), [sem.turmas, a.turmas])
  const matrizesDasTurmas = useMemo(() => {
    const ms = sem.turmas.filter(t => a.turmas.includes(t.id)).map(t => matrizDaTurma(c, t)).filter(Boolean) as typeof c.matrizes
    return [...new Set(ms)]
  }, [sem.turmas, a.turmas, c])

  const sugestoes = useMemo(() => {
    const q = norm(busca)
    const lista: { m: string; codigo: string; nome: string; ch: number; nivel: number }[] = []
    // sem busca: só a(s) matriz(es) das turmas marcadas; com busca: matrizes da mesma habilitação
    // (outros currículos da mesma habilitação valem para remanescentes); outras habilitações só se o usuário pedir
    const mats = q
      ? [...matrizesDasTurmas, ...c.matrizes.filter(m => !matrizesDasTurmas.includes(m) && (outrasHab || !habs.size || habs.has(m.habilitacao)))]
      : (matrizesDasTurmas.length ? matrizesDasTurmas : c.matrizes.filter(m => outrasHab || !habs.size || habs.has(m.habilitacao)))
    const vistos = new Set<string>()
    for (const m of mats) for (const k of m.componentes) {
      if (q && !norm(k.codigo + ' ' + k.nome).includes(q)) continue
      if (vistos.has(k.codigo)) continue
      vistos.add(k.codigo)
      lista.push({ m: m.nome, codigo: k.codigo, nome: k.nome, ch: k.ch, nivel: k.nivel })
    }
    return lista.slice(0, 40)
  }, [busca, c, matrizesDasTurmas, habs, outrasHab])

  // turmas que podem ser conjuntas: mesma habilitação, ou outra habilitação cuja matriz tem o mesmo código
  const podeJuntar = (tid: string) => {
    if (todasTurmas || a.turmas.includes(tid) || !habs.size) return true
    const t = sem.turmas.find(x => x.id === tid)!
    if (habs.has(t.habilitacao)) return true
    if (!a.codigo) return false
    return !!matrizDaTurma(c, t)?.componentes.some(k => k.codigo === a.codigo)
  }
  const turmasOrd = [...sem.turmas].sort((x, y) => y.ingresso - x.ingresso || x.habilitacao.localeCompare(y.habilitacao))
  const ocultas = turmasOrd.filter(t => !podeJuntar(t.id)).length
  const valido = a.nome.trim() && a.turmas.length > 0

  return (
    <Modal titulo={aula ? 'Editar componente' : 'Incluir componente'} onClose={onFechar} rodape={
      <>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {aula && !confirmar && <button className="btn danger" onClick={() => setConfirmar(true)}>Excluir</button>}
          {confirmar && (
            <span className="confirma">Excluir {a.codigo || a.nome} desta oferta?
              <button className="btn sm danger" onClick={() => onExcluir(a.id)}>Sim, excluir</button>
              <button className="btn sm" onClick={() => setConfirmar(false)}>Não</button>
            </span>
          )}
          {aula && !confirmar && <button className="btn ghost" onClick={() => onSalvar({ ...a, id: uid('a'), horarios: [] })}>Duplicar sem horário</button>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={onFechar}>Cancelar</button>
          <button className="btn pri" disabled={!valido} onClick={() => onSalvar(a, novoDoc && a.alocacao.some(x => x.docente === novoDoc.id) ? novoDoc : undefined)}>Salvar</button>
        </div>
      </>
    }>
      <Campo rotulo="Buscar na matriz (código ou nome)">
        <input className="inp" id="busca-matriz" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Ex.: zoologia, DCBS0332" autoFocus={!aula} />
      </Campo>
      {habs.size > 0 && (
        <label className="check" style={{ marginTop: -6 }}>
          <input type="checkbox" checked={outrasHab} onChange={e => setOutrasHab(e.target.checked)} />
          Buscar também nas matrizes de outra habilitação
          <span className="muted">(hoje: só {[...habs].map(h => c.habilitacoes.find(x => x.id === h)?.nome ?? h).join(' e ')})</span>
        </label>
      )}
      {(busca || !aula) && sugestoes.length > 0 && (
        <div className="sug">
          {sugestoes.map(s => (
            <button key={s.m + s.codigo} onClick={() => { set({ codigo: s.codigo, nome: s.nome, ch: s.ch, ...(aula ? {} : { moduloLivre: sugereModuloLivre(s.nome) }) }); setBusca('') }}>
              <span className="mono">{s.codigo}</span><span>{s.nome}</span><span className="nv">{s.ch}h · {s.nivel ? `${s.nivel}º nível` : 'optativa'}</span>
            </button>
          ))}
        </div>
      )}
      <div className="linha">
        <Campo rotulo="Código" style={{ flex: '0 1 130px' }}><input className="inp mono" id="ed-codigo" value={a.codigo} onChange={e => set({ codigo: e.target.value.toUpperCase().trim() })} /></Campo>
        <Campo rotulo="Nome do componente" style={{ flex: '1 1 260px' }}><input className="inp" id="ed-nome" value={a.nome} onChange={e => set({ nome: e.target.value })} /></Campo>
        <Campo rotulo="CH (h)" style={{ flex: '0 0 90px' }}><input className="inp num" id="ed-ch" type="number" min={0} step={15} value={a.ch} onChange={e => set({ ch: +e.target.value })} /></Campo>
      </div>

      <Campo rotulo="Turmas (marque mais de uma para turma conjunta)">
        <div className="chips">
          {turmasOrd.filter(t => podeJuntar(t.id)).map(t => (
            <button key={t.id} type="button" className="chip" aria-pressed={a.turmas.includes(t.id)}
              onClick={() => set({ turmas: a.turmas.includes(t.id) ? a.turmas.filter(x => x !== t.id) : [...a.turmas, t.id] })}>
              {rotuloTurma(c, sem, t, true)}
            </button>
          ))}
          {ocultas > 0 && <button type="button" className="btn sm ghost" onClick={() => setTodasTurmas(true)}>+ {ocultas} turma(s) de outra habilitação</button>}
        </div>
        {ocultas > 0 && <small className="muted">Turmas de outra habilitação só aparecem quando o código existe também na matriz delas (componentes compartilhados).</small>}
      </Campo>

      <div className="campo">
        <span>Docentes e CH de cada um (divida a CH quando o componente é compartilhado)</span>
        {a.alocacao.map((al, i) => (
          <div className="aloc" key={i}>
            <select className="inp" value={al.docente} aria-label="Docente" onChange={e => { const l = [...a.alocacao]; l[i] = { ...al, docente: e.target.value }; set({ alocacao: l }) }}>
              {docentes.map(d => <option key={d.id} value={d.id}>{d.nome}{d.vinculo === 'externo' ? ' (externo)' : ''}{d.situacao !== 'ativo' ? ` — ${d.situacao}` : ''}</option>)}
            </select>
            <input className="inp num" type="number" min={0} step={15} value={al.ch} aria-label="CH do docente" onChange={e => { const l = [...a.alocacao]; l[i] = { ...al, ch: +e.target.value }; set({ alocacao: l }) }} />
            <button className="btn ghost sm" onClick={() => set({ alocacao: a.alocacao.filter((_, j) => j !== i) })} aria-label="Remover docente">✕</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn sm" onClick={() => set({ alocacao: [...a.alocacao, { docente: docentes.find(d => d.situacao === 'ativo')?.id ?? docentes[0]?.id ?? '', ch: a.ch }] })}>+ Docente</button>
          {!novoDoc && <button className="btn sm ghost" onClick={() => {
            const d: Docente = { id: uid('d'), nome: '', curto: '', tratamento: 'Prof.', vinculo: 'externo', situacao: 'ativo', obs: '' }
            setNovoDoc(d)
          }}>Cadastrar docente novo</button>}
        </div>
        {novoDoc && (
          <div className="linha" style={{ padding: 10, background: 'var(--surface-2)', borderRadius: 6 }}>
            <Campo rotulo="Nome completo"><input className="inp" value={novoDoc.nome} onChange={e => setNovoDoc({ ...novoDoc, nome: e.target.value, curto: e.target.value.split(' ').slice(0, 2).join(' ') })} /></Campo>
            <Campo rotulo="Tratamento" style={{ flex: '0 0 100px' }}>
              <select className="inp" value={novoDoc.tratamento} onChange={e => setNovoDoc({ ...novoDoc, tratamento: e.target.value })}><option>Prof.</option><option>Profa.</option></select>
            </Campo>
            <Campo rotulo="Vínculo" style={{ flex: '0 0 140px' }}>
              <select className="inp" value={novoDoc.vinculo} onChange={e => setNovoDoc({ ...novoDoc, vinculo: e.target.value as Docente['vinculo'] })}><option value="curso">Do curso</option><option value="externo">Externo</option></select>
            </Campo>
            <button className="btn sm pri" disabled={!novoDoc.nome.trim()} onClick={() => set({ alocacao: [...a.alocacao, { docente: novoDoc.id, ch: a.ch }] })}>Alocar</button>
          </div>
        )}
      </div>

      <div className="linha">
        <label className="check"><input type="checkbox" checked={a.externo} onChange={e => set({ externo: e.target.checked })} /> Docente de outro colegiado</label>
        <label className="check"><input type="checkbox" checked={a.moduloLivre} onChange={e => set({ moduloLivre: e.target.checked })} /> Módulo livre (sem horário fixo){!a.moduloLivre && sugereModuloLivre(a.nome) && <span className="tag info">sugerido</span>}</label>
        <label className="check"><input type="checkbox" checked={a.optativa} onChange={e => set({ optativa: e.target.checked })} /> Optativa (pode coincidir com outra)</label>
      </div>
      {a.externo && <Campo rotulo="Colegiado responsável"><input className="inp" id="ed-colegiado" value={a.colegiado} onChange={e => set({ colegiado: e.target.value })} placeholder="Ex.: Pedagogia, Letras, Campus Mazagão" /></Campo>}
      <Campo rotulo="Observação (aparece só aqui e na aba Pendências)"><input className="inp" id="ed-obs" value={a.obs} onChange={e => set({ obs: e.target.value })} /></Campo>
      {!a.moduloLivre && (
        <div className="linha" style={{ alignItems: 'center' }}>
          <span className="muted" style={{ fontSize: 13 }}>Horário: {resumoHorarios(c, a.horarios) || 'nenhum — marque na grade depois de salvar'}</span>
          {a.horarios.length > 0 && <button className="btn sm ghost" onClick={() => set({ horarios: [] })}>Limpar horário</button>}
        </div>
      )}
    </Modal>
  )
}
