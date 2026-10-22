import { useEffect, useMemo, useState } from 'react'
import type { Aula, Problema, Projeto, Semestre } from '../lib/types'
import { aulasEsperadas, corDocente, corTurma, habil, matrizDaTurma, nomeDocente, periodoDaTurma, rotuloTurma, sugereModuloLivre, turmaCurta } from '../lib/model'

export type Preset = { turmaId?: string; horario?: string; codigo?: string; nome?: string; ch?: number }

interface TabelaProps {
  proj: Projeto
  aulas: Aula[]
  turnos: string[]
  conflitos?: Set<string>
  selecionada?: string | null
  pintando?: boolean
  mostrarTurma?: boolean
  cor?: { forte: string; clara: string }
  onCelula?: (cel: string, aulasNaCelula: Aula[]) => void
}

export function GradeTabela({ proj, aulas, turnos, conflitos, selecionada, pintando, mostrarTurma, cor, onCelula }: TabelaProps) {
  const thCor = cor ? { background: cor.forte, color: '#fff', borderBottomColor: cor.forte } : undefined
  const horaCor = cor ? { background: `color-mix(in srgb, ${cor.forte} 13%, var(--surface))`, color: 'var(--ink)', fontWeight: 600 } : undefined
  const sepCor = cor ? { background: `color-mix(in srgb, ${cor.forte} 22%, var(--surface))`, color: 'var(--ink)' } : undefined
  const c = proj.config
  const docMap = useMemo(() => new Map(proj.docentes.map(d => [d.id, d])), [proj.docentes])
  const porCel = useMemo(() => {
    const m = new Map<string, Aula[]>()
    for (const a of aulas) if (!a.moduloLivre) for (const h of a.horarios) m.set(h, [...(m.get(h) ?? []), a])
    return m
  }, [aulas])
  const tns = c.turnos.filter(t => turnos.includes(t.id))
  return (
    <div className="rolagem">
      <table className="grade">
        <thead>
          <tr><th className="hora" style={thCor}>Horário</th>{c.dias.map(d => <th key={d} style={thCor}>{d}</th>)}</tr>
        </thead>
        <tbody>
          {tns.map((tn, ti) => (
            [
              (tns.length > 1 || tn.id === 'N') && <tr className="sep" key={tn.id + '-sep'}><td colSpan={c.dias.length + 1} style={sepCor}>{tn.nome}</td></tr>,
              ...tn.slots.map((sl, i) => {
                const intervalo = i > 0 && tn.slots[i - 1].fim !== sl.inicio
                return (
                  <tr key={sl.id} className={intervalo ? 'intervalo' : undefined}>
                    <td className="hora" style={horaCor}>{sl.inicio}<br />{sl.fim}</td>
                    {c.dias.map((_, d) => {
                      const cel = `${d}-${sl.id}`
                      const as = porCel.get(cel) ?? []
                      const acima = i > 0 ? (porCel.get(`${d}-${tn.slots[i - 1].id}`) ?? []) : []
                      const cls = [as.length ? '' : 'vazia', pintando ? 'pintavel' : '', conflitos?.has(cel) ? 'conflito' : ''].join(' ')
                      return (
                        <td key={cel} className={cls} onClick={onCelula ? () => onCelula(cel, as) : undefined} title={as.map(a => `${a.codigo} ${a.nome}`).join('\n') || undefined}>
                          {as.map(a => {
                            const cont = acima.includes(a) && !intervalo
                            const d0 = a.alocacao[0]?.docente
                            const h = d0 ? corDocente(d0) : 0
                            const docs = a.alocacao.map(x => nomeDocente(docMap.get(x.docente))).join(' + ')
                            return (
                              <div key={a.id} className={`blk ${a.alocacao.length ? '' : 'indef'} ${cont ? 'cont' : ''} ${selecionada === a.id ? 'sel' : ''} ${selecionada && selecionada !== a.id ? 'esmaecido' : ''}`} style={{ ['--h' as string]: h }}>
                                <span className="cod">{a.codigo}{mostrarTurma ? ' · ' + a.turmas.map(x => turmaCurta(c, x)).join('+') : ''}</span>
                                <span className="nm">{a.nome}</span>
                                <span className="dc">{docs || 'A definir'}</span>
                              </div>
                            )
                          })}
                        </td>
                      )
                    })}
                  </tr>
                )
              }),
              ti < tns.length - 1 ? null : null,
            ]
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface Props {
  proj: Projeto
  sem: Semestre
  mudarSem: (fn: (s: Semestre, p: Projeto) => void) => void
  problemas: Problema[]
  turmaSel: string
  setTurmaSel: (id: string) => void
  aulaSel: string | null
  setAulaSel: (id: string | null) => void
  alternarHorario: (aulaId: string, cel: string) => void
  abrirEditor: (aulaId: string | null, preset?: Preset) => void
}

export function GradeView({ proj, sem, mudarSem, problemas, turmaSel, setTurmaSel, aulaSel, setAulaSel, alternarHorario, abrirEditor }: Props) {
  const c = proj.config
  const turmas = useMemo(() => [...sem.turmas].sort((a, b) => b.ingresso - a.ingresso || a.habilitacao.localeCompare(b.habilitacao)), [sem.turmas])
  const turma = sem.turmas.find(t => t.id === turmaSel) ?? turmas[0]
  const aulasTurma = useMemo(() => sem.aulas.filter(a => turma && a.turmas.includes(turma.id)), [sem.aulas, turma])
  const docMap = useMemo(() => new Map(proj.docentes.map(d => [d.id, d])), [proj.docentes])

  const usados = useMemo(() => c.turnos.filter(tn => aulasTurma.some(a => a.horarios.some(h => tn.slots.some(s => h.endsWith('-' + s.id))))).map(t => t.id), [aulasTurma, c.turnos])
  const [turnos, setTurnos] = useState<string[]>([])
  const [novaTurma, setNovaTurma] = useState<{ ingresso: number; habilitacao: string } | null>(null)
  const lerPref = (k: string) => { try { return localStorage.getItem('ofertas-curso:' + k) === '1' } catch { return false } }
  const gravarPref = (k: string, v: boolean) => { try { localStorage.setItem('ofertas-curso:' + k, v ? '1' : '0') } catch { /* ignore */ } }
  const [recT, setRecTRaw] = useState(() => lerPref('recolher-turmas'))
  const [recC, setRecCRaw] = useState(() => lerPref('recolher-componentes'))
  const setRecT = (v: boolean) => { setRecTRaw(v); gravarPref('recolher-turmas', v) }
  const setRecC = (v: boolean) => { setRecCRaw(v); gravarPref('recolher-componentes', v) }
  useEffect(() => { setTurnos(usados.length ? usados : c.turnos.slice(0, 2).map(t => t.id)) }, [turma?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  // turnos exibidos: começam pelos que a turma usa; o usuário pode esconder qualquer um (sempre fica ao menos um)
  const turnosVis = c.turnos.map(t => t.id).filter(id => turnos.includes(id))

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.veu')) setAulaSel(null) }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [setAulaSel])

  const conflitos = useMemo(() => {
    const s = new Set<string>()
    const ids = new Set(aulasTurma.map(a => a.id))
    for (const p of problemas) if (p.celulas && p.aulaIds?.some(x => ids.has(x))) p.celulas.forEach(x => s.add(x))
    return s
  }, [problemas, aulasTurma])

  const contagem = (tid: string) => problemas.filter(p => p.turmaId === tid && p.nivel !== 'info').length
  const erros = (tid: string) => problemas.filter(p => p.turmaId === tid && p.nivel === 'erro').length

  const sel = sem.aulas.find(a => a.id === aulaSel)
  const naoOfertadas = useMemo(() => {
    if (!turma) return []
    const m = matrizDaTurma(c, turma)
    if (!m) return []
    const per = periodoDaTurma(sem, turma)
    const of = new Set(aulasTurma.map(a => a.codigo))
    return m.componentes.filter(x => x.nivel === per && x.natureza === 'obrigatoria' && !of.has(x.codigo))
  }, [c, turma, sem, aulasTurma])

  const cartao = (a: Aula) => {const esp = aulasEsperadas(c, a)
          const n = a.horarios.length
          const d0 = a.alocacao[0]?.docente
          const indisp = a.alocacao.some(x => docMap.get(x.docente)?.situacao !== 'ativo')
          return (
            <div key={a.id} className={`comp ${a.alocacao.length ? '' : 'indef'}`} style={{ ['--h' as string]: d0 ? corDocente(d0) : 0 }}
              role="button" tabIndex={0} aria-pressed={aulaSel === a.id}
              onClick={() => setAulaSel(aulaSel === a.id ? null : a.id)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAulaSel(aulaSel === a.id ? null : a.id) } }}>
              <span className="c">{a.codigo || 'sem código'} · {a.ch}h</span>
              <span className="acoes"><button className="btn ghost sm" onClick={e => { e.stopPropagation(); abrirEditor(a.id) }} aria-label={`Editar ${a.nome}`}>Editar</button></span>
              <span className="t">{a.nome}</span>
              <span className={`d ${a.alocacao.length ? '' : 'indef'}`} style={{ gridColumn: '1 / -1' }}>{a.alocacao.map(x => nomeDocente(docMap.get(x.docente))).join(' + ') || 'Docente a definir'}</span>
              {!a.moduloLivre && (
                <span className={`carga ${n === esp ? 'ok' : n > esp ? 'mais' : ''}`}>
                  <span className="barra"><i style={{ width: `${Math.min(100, (n / (esp || 1)) * 100)}%` }} /></span>
                  <span className="num">{n}/{esp}</span>
                </span>
              )}
              <span className="tags" style={{ marginTop: 2 }}>
                <button className="btn sm ghost" style={{ padding: '1px 6px', fontSize: 12 }} onClick={e => { e.stopPropagation(); if (aulaSel === a.id) setAulaSel(null); mudarSem(s => { const x = s.aulas.find(y => y.id === a.id)!; x.moduloLivre = !x.moduloLivre }) }}>
                  {a.moduloLivre ? '↑ Voltar para a grade' : '↓ Mover para módulo livre'}
                </button>
                {!a.moduloLivre && sugereModuloLivre(a.nome) && <span className="tag info" title="Estágios, práticas, ACE e TCC costumam ser ofertados em módulo livre">módulo livre?</span>}
              </span>
              {(a.moduloLivre || a.optativa || a.externo || a.turmas.length > 1 || indisp) && (
                <span className="tags">
                  {a.moduloLivre && <span className="tag info">Módulo livre</span>}
                  {a.optativa && <span className="tag">Optativa</span>}
                  {a.externo && <span className="tag warn">Externo</span>}
                  {indisp && <span className="tag err">Docente indisponível</span>}
                  {a.turmas.length > 1 && <span className="tag">Junto com {a.turmas.filter(x => x !== turma.id).map(x => turmaCurta(c, x)).join(', ')}</span>}
                </span>
              )}
            </div>
          )
        }

  if (!turma) return <div className="vazio">Este semestre ainda não tem turmas. Adicione em Configurações → Turmas do semestre.</div>

  const ordenadas = [...aulasTurma].sort((a, b) => Number(a.moduloLivre) - Number(b.moduloLivre) || (a.horarios[0] ?? 'z').localeCompare(b.horarios[0] ?? 'z'))
  const matriz = matrizDaTurma(c, turma)

  return (
    <div className={`mesa ${recT ? 'rec-t' : ''} ${recC ? 'rec-c' : ''}`}>
      {recT ? (
        <nav className="lista-turmas mini" aria-label="Turmas">
          <button className="btn-painel" onClick={() => setRecT(false)} title="Mostrar lista de turmas" aria-label="Mostrar lista de turmas">»</button>
          {turmas.map(t => (
            <button key={t.id} className="turma-mini" style={{ boxShadow: `inset 3px 0 0 ${corTurma(c, t).forte}` }} aria-pressed={t.id === turma.id}
              title={`${rotuloTurma(c, sem, t)}${contagem(t.id) ? ` · ${contagem(t.id)} pendência(s)` : ''}`} onClick={() => { setTurmaSel(t.id); setAulaSel(null) }}>
              <b>{String(t.ingresso).slice(2)}</b><small>{habil(c, t.habilitacao).abrev.replace('.', '')}</small>
              {contagem(t.id) > 0 && <i className={erros(t.id) ? 'err' : 'warn'} />}
            </button>
          ))}
        </nav>
      ) : (
      <nav className="lista-turmas" aria-label="Turmas">
        <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>Turmas · {sem.rotulo}<button className="btn-painel" onClick={() => setRecT(true)} title="Recolher lista de turmas" aria-label="Recolher lista de turmas">«</button></h3>
        {turmas.map(t => (
          <button key={t.id} className="turma-btn" style={{ boxShadow: `inset 3px 0 0 ${corTurma(c, t).forte}` }} aria-pressed={t.id === turma.id} onClick={() => { setTurmaSel(t.id); setAulaSel(null) }}>
            <b>{rotuloTurma(c, sem, t, true)}</b>
            <small>{periodoDaTurma(sem, t)}º semestre</small>
            {contagem(t.id) > 0 && <span className={`badge ${erros(t.id) ? 'err' : 'warn'}`}>{contagem(t.id)}</span>}
          </button>
        ))}
        {!novaTurma && <button className="btn sm ghost" style={{ marginTop: 6, justifyContent: 'flex-start' }} onClick={() => setNovaTurma({ ingresso: sem.ano, habilitacao: c.habilitacoes[0]?.id ?? '' })}>+ Adicionar turma</button>}
        {novaTurma && (() => {
          const id = `${novaTurma.ingresso}-${novaTurma.habilitacao}`
          const per = (sem.ano - novaTurma.ingresso) * 2 + sem.periodo
          const existe = sem.turmas.some(t => t.id === id)
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8, background: 'var(--surface-2)', borderRadius: 8, marginTop: 6 }}>
              <label className="campo"><span>Ano de ingresso</span><input className="inp num" style={{ width: '100%', textAlign: 'left' }} type="number" value={novaTurma.ingresso} onChange={e => setNovaTurma({ ...novaTurma, ingresso: +e.target.value })} /></label>
              <label className="campo"><span>Habilitação</span><select className="inp" value={novaTurma.habilitacao} onChange={e => setNovaTurma({ ...novaTurma, habilitacao: e.target.value })}>{c.habilitacoes.map(h => <option key={h.id} value={h.id}>{h.nome}</option>)}</select></label>
              <small className={existe || per < 1 ? '' : 'muted'} style={existe || per < 1 ? { color: 'var(--err)' } : undefined}>{existe ? 'Essa turma já existe.' : per < 1 ? 'Ingresso posterior ao semestre.' : `Turma ${novaTurma.ingresso} ${habil(c, novaTurma.habilitacao).abrev} · ${per}º semestre`}</small>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn sm pri" disabled={existe || per < 1} onClick={() => { mudarSem(s => { s.turmas.push({ id, ingresso: novaTurma.ingresso, habilitacao: novaTurma.habilitacao, nota: '' }) }); setTurmaSel(id); setNovaTurma(null) }}>Adicionar</button>
                <button className="btn sm" onClick={() => setNovaTurma(null)}>Cancelar</button>
              </div>
            </div>
          )
        })()}
      </nav>
      )}

      <section className="grade-wrap">
        <div className="grade-topo">
          <div>
            <h2>{rotuloTurma(c, sem, turma)}</h2>
            <div className="sub">{matriz ? matriz.nome : 'Sem matriz associada'} · {aulasTurma.length} componentes</div>
          </div>
          <div className="turnos-tog">
            <button className="btn sm" onClick={() => { const v = !(recT && recC); setRecT(v); setRecC(v) }} title="Recolher ou mostrar as listas laterais">{recT && recC ? 'Mostrar painéis' : 'Ampliar quadro'}</button>
            {c.turnos.map(tn => (
              <label key={tn.id} className="check">
                <input type="checkbox" checked={turnosVis.includes(tn.id)} disabled={turnosVis.length === 1 && turnosVis.includes(tn.id)}
                  onChange={e => setTurnos(e.target.checked ? [...turnos, tn.id] : turnos.filter(x => x !== tn.id))} />
                {tn.nome}
                {usados.includes(tn.id) && !turnosVis.includes(tn.id) && <span className="tag warn" title="Esta turma tem aulas neste turno, que estão escondidas">aulas ocultas</span>}
              </label>
            ))}
          </div>
        </div>
        {sel ? (
          <div className="dica">
            Marcando horários de <b>{sel.codigo} {sel.nome}</b>
            <span className="num">· {sel.horarios.length} de {aulasEsperadas(c, sel)} aulas na semana</span>
            <span className="muted">Clique nas células para marcar ou desmarcar.</span>
            <button className="btn sm" onClick={() => setAulaSel(null)}>Concluir (Esc)</button>
          </div>
        ) : (
          <div className="dica muted" style={{ background: 'var(--surface-2)' }}>Escolha um componente à direita para marcar horários, ou clique numa célula vazia para incluir um componente nela.</div>
        )}
        <GradeTabela
          cor={corTurma(c, turma)} proj={proj} aulas={aulasTurma} turnos={turnosVis} conflitos={conflitos} selecionada={aulaSel} pintando={!!sel}
          onCelula={(cel, as) => {
            if (sel) return alternarHorario(sel.id, cel)
            if (as.length) return setAulaSel(as[0].id)
            abrirEditor(null, { turmaId: turma.id, horario: cel })
          }}
        />
        {turma.nota && <p className="nota-turma">{turma.nota}</p>}
      </section>

      {recC ? (
        <aside className="painel-mini">
          <button className="btn-painel" onClick={() => setRecC(false)} title="Mostrar componentes da turma" aria-label="Mostrar componentes da turma">«</button>
          <button className="vertical" onClick={() => setRecC(false)}>Componentes ({ordenadas.length})</button>
          <button className="btn-painel" onClick={() => abrirEditor(null, { turmaId: turma.id })} title="Incluir componente" aria-label="Incluir componente">+</button>
        </aside>
      ) : (
      <aside className="painel-comp">
        <header>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}><button className="btn-painel" onClick={() => setRecC(true)} title="Recolher componentes" aria-label="Recolher componentes">»</button>Componentes da turma</h3>
          <button className="btn sm pri" onClick={() => abrirEditor(null, { turmaId: turma.id })}>+ Incluir</button>
        </header>
        {ordenadas.length === 0 && <p className="muted" style={{ margin: 0 }}>Nenhum componente ainda. Use “+ Incluir” ou as sugestões da matriz abaixo.</p>}
        {ordenadas.filter(a => !a.moduloLivre).map(a => cartao(a))}
        <div className="rot" style={{ padding: '10px 2px 2px', font: '600 11px var(--f-body)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>Módulo livre (sem horário fixo)</div>
        {ordenadas.filter(a => a.moduloLivre).length === 0 && <p className="muted" style={{ margin: 0, fontSize: 13 }}>Nenhum. Estágios, práticas, ACE e TCC costumam ficar aqui — use “Mover para módulo livre” no componente.</p>}
        {ordenadas.filter(a => a.moduloLivre).map(a => cartao(a))}
        {naoOfertadas.length > 0 && (
          <details open={naoOfertadas.length <= 4}>
            <summary className="muted" style={{ cursor: 'pointer', fontSize: 13 }}>Matriz do {periodoDaTurma(sem, turma)}º período: {naoOfertadas.length} obrigatória(s) fora da oferta</summary>
            <div className="sug" style={{ marginTop: 6 }}>
              {naoOfertadas.map(x => (
                <button key={x.codigo} onClick={() => abrirEditor(null, { turmaId: turma.id, codigo: x.codigo, nome: x.nome, ch: x.ch })}>
                  <span className="mono">{x.codigo}</span><span>{x.nome}</span><span className="nv">{x.ch}h</span>
                </button>
              ))}
            </div>
          </details>
        )}
      </aside>
      )}
    </div>
  )
}
