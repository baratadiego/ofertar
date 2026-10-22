import { useMemo, useState } from 'react'
import type { Docente, Problema, Projeto, Semestre, Versao } from '../lib/types'
import { diferencas, distribuicaoCH, minimoEnsino, semDocenteInterno, matrizDaTurma, nomeDocente, periodoDaTurma, resumoHorarios, rotuloStatus, rotuloTurma, turmaCurta, uid, type StatusCH } from '../lib/model'
import { csvCargaHoraria, gerarDocx, gerarQuadroDepartamento, memorandoExternos } from '../lib/exportar'
import { baixar } from '../lib/storage'
import { Campo, Modal, Pill } from './ui'
import { GradeTabela, type Preset } from './Grade'

type MudarSem = (fn: (s: Semestre, p: Projeto) => void) => void
type Mudar = (fn: (p: Projeto) => void) => void

// =============== DOCENTES ===============
const CLS_STATUS: Record<StatusCH, string> = { confere: 'ok', diverge: 'warn', 'sem-prevista': 'mute', 'funcao-sem-componente': 'warn', indisponivel: 'err' }

export function DocentesView({ proj, sem, mudar, mudarSem, irPara }: { proj: Projeto; sem: Semestre; mudar: Mudar; mudarSem: MudarSem; irPara: (turmaId: string, aulaId?: string) => void }) {
  const c = proj.config
  const [filtro, setFiltro] = useState<'todos' | 'diverge' | 'sem-prevista'>('todos')
  const [aberto, setAberto] = useState<string | null>(null)
  const [editando, setEditando] = useState<Docente | null>(null)
  const dist = useMemo(() => distribuicaoCH(proj, sem), [proj, sem])
  const linhas = dist.comAulas.filter(l => filtro === 'todos' || l.status === filtro)
  const externos = proj.docentes.filter(d => d.vinculo === 'externo').map(d => ({ d, aulas: sem.aulas.filter(a => a.alocacao.some(x => x.docente === d.id)) })).filter(x => x.aulas.length)
  const novo = () => setEditando({ id: uid('d'), nome: '', curto: '', tratamento: 'Prof.', vinculo: 'curso', situacao: 'ativo', obs: '' })
  const inpFuncao = (id: string, nome: string) => <input className="inp" style={{ width: 120 }} aria-label={`Função de ${nome}`} value={sem.funcoes?.[id] ?? ''} placeholder="—" onChange={e => mudarSem(s => { s.funcoes = { ...s.funcoes, [id]: e.target.value } })} />
  const inpPos = (id: string, nome: string, v: number) => <input className="inp num" type="number" min={0} step={15} title="CH de ensino na pós-graduação neste semestre" aria-label={`CH na pós-graduação de ${nome}`} value={v || ''} placeholder="—" onChange={e => mudarSem(s => { s.chPos = { ...s.chPos, [id]: +e.target.value } })} />
  const inpPrev = (id: string, nome: string, v: number) => <input className="inp num" type="number" min={0} step={15} aria-label={`CH prevista de ${nome}`} value={v || ''} placeholder="—" onChange={e => mudarSem(s => { s.chPrevista = { ...s.chPrevista, [id]: +e.target.value } })} />

  return (
    <div className="secao">
      <div className="stats">
        <div><b>{dist.totalGrad}h</b><span>CH na graduação{dist.totalPos ? ` · +${dist.totalPos}h na pós` : ''}</span></div>
        <div><b>{dist.comAulas.length}</b><span>docentes com ensino no semestre</span></div>
        <div><b style={{ color: dist.abaixoMinimo ? 'var(--warn)' : undefined }}>{dist.abaixoMinimo}</b><span><i className="dot" style={{ background: 'var(--warn)' }} />abaixo de {minimoEnsino(c)}h de ensino</span></div>
        <div><b style={{ color: 'var(--ok)' }}>{dist.confere}</b><span><i className="dot" style={{ background: 'var(--ok)' }} />conferem com a prevista</span></div>
        <div><b style={{ color: dist.diverge ? 'var(--warn)' : undefined }}>{dist.diverge}</b><span><i className="dot" style={{ background: 'var(--warn)' }} />divergem</span></div>
        <div><b>{dist.semPrevista}</b><span>com a CH prevista (PAID) em branco</span></div>
      </div>

      <section className="bloco">
        <header>
          <h3>Distribuição da carga horária · {sem.rotulo}</h3>
          <div className="filtros">
            <div className="tema" role="group" aria-label="Filtro" style={{ margin: 0 }}>
              {([['todos', 'Todos'], ['diverge', 'Divergem'], ['sem-prevista', 'Prevista em branco']] as const).map(([k, n]) => <button key={k} aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{n}</button>)}
            </div>
            <button className="btn sm pri" onClick={novo}>+ Docente</button>
          </div>
        </header>
        <div className="scroll-x">
          <table className="lt" style={{ minWidth: 1120 }}>
            <thead><tr><th>Docente</th><th>Graduação (CH · código · turma)</th><th className="r">Pós</th><th className="r">Total ensino</th><th>Função</th><th className="r">Prevista</th><th>Situação</th><th></th></tr></thead>
            <tbody>
              {linhas.length === 0 && <tr><td colSpan={8} className="muted">Nenhum docente neste filtro.</td></tr>}
              {linhas.map(l => [
                <tr key={l.docente.id}>
                  <td style={{ verticalAlign: 'top', minWidth: 190 }}><b style={{ fontWeight: 600 }}>{l.docente.tratamento} {l.docente.nome}</b>{l.docente.obs && <div className="muted" style={{ fontSize: 12 }}>{l.docente.obs}</div>}
                    <label className="check" style={{ fontSize: 12, marginTop: 4 }} title="Redução de carga pela Res. PAID art. 50 §1 — dispensa o mínimo de ensino">
                      <input type="checkbox" checked={l.reducao} onChange={e => mudarSem(s => { s.reducaoPaid = { ...s.reducaoPaid, [l.docente.id]: e.target.checked } })} /> Redução PAID (art. 50 §1)
                    </label></td>
                  <td style={{ width: '38%', minWidth: 340, verticalAlign: 'top' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr)', gap: '6px 10px', fontSize: 13 }}>
                      {l.itens.map(it => [
                        <span key={it.aula.id + 'c'} className="mono num" style={{ textAlign: 'right', color: 'var(--muted)', paddingTop: 1 }}>{it.ch}h</span>,
                        <a key={it.aula.id + 'n'} href="#" onClick={e => { e.preventDefault(); irPara(it.aula.turmas[0], it.aula.id) }} style={{ color: 'inherit', textDecoration: 'none', lineHeight: 1.3 }}>
                          <span className="mono muted">{it.aula.codigo}</span> {it.aula.nome}
                          <span className="muted" style={{ display: 'block', fontSize: 12 }}>{it.aula.turmas.map(x => turmaCurta(c, x)).join(' + ')}</span>
                        </a>,
                      ])}
                    </div>
                  </td>
                  <td className="r" style={{ verticalAlign: 'top' }}>{inpPos(l.docente.id, l.docente.nome, l.pos)}</td>
                  <td className="r num" style={{ verticalAlign: 'top', whiteSpace: 'nowrap' }}><b style={{ fontSize: 16 }}>{l.total}h</b><div className="muted" style={{ fontSize: 12 }}>{l.semanais} h/a por semana</div></td>
                  <td style={{ verticalAlign: 'top' }}>{inpFuncao(l.docente.id, l.docente.nome)}</td>
                  <td className="r" style={{ verticalAlign: 'top' }}>{inpPrev(l.docente.id, l.docente.nome, l.prevista)}</td>
                  <td style={{ verticalAlign: 'top' }}>{l.abaixoMinimo && <div style={{ marginBottom: 4 }}><span className="status warn">Abaixo de {minimoEnsino(c)}h</span></div>}{l.reducao && <div style={{ marginBottom: 4 }}><span className="status" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>Redução PAID</span></div>}<span title={l.status === 'sem-prevista' ? 'A CH prevista no PAID não foi informada — preencha a coluna Prevista para conferir' : undefined} className={`status ${CLS_STATUS[l.status] === 'mute' ? '' : CLS_STATUS[l.status]}`} style={CLS_STATUS[l.status] === 'mute' ? { background: 'var(--surface-2)', color: 'var(--muted)' } : undefined}>{rotuloStatus(l)}</span></td>
                  <td style={{ whiteSpace: 'nowrap', verticalAlign: 'top', textAlign: 'right' }}>
                    {l.itens.some(i => !i.aula.moduloLivre && i.aula.horarios.length) && <button className="btn sm ghost" onClick={() => setAberto(aberto === l.docente.id ? null : l.docente.id)}>{aberto === l.docente.id ? 'Fechar' : 'Horário'}</button>}
                    <button className="btn sm ghost" onClick={() => setEditando(structuredClone(l.docente))}>Editar</button>
                  </td>
                </tr>,
                aberto === l.docente.id && (
                  <tr key={l.docente.id + '-g'}><td colSpan={8} style={{ background: 'var(--surface-2)' }}>
                    <GradeTabela proj={proj} aulas={l.itens.map(i => i.aula)} turnos={c.turnos.filter(tn => l.itens.some(i => i.aula.horarios.some(h => tn.slots.some(s => h.endsWith('-' + s.id))))).map(t => t.id)} mostrarTurma />
                  </td></tr>
                ),
              ])}
            </tbody>
            <tfoot><tr><td colSpan={2} className="r muted">Total do curso</td><td className="r num muted">{dist.totalPos ? dist.totalPos + 'h' : '—'}</td><td className="r num" style={{ fontWeight: 600, fontSize: 16 }}>{dist.total}h</td><td colSpan={4} className="muted">{dist.confere} conferem · {dist.diverge} divergem · {dist.semPrevista} sem prevista</td></tr></tfoot>
          </table>
        </div>
      </section>

      <div className="grid2">
        <section className="bloco">
          <header><h3>Sem ensino em {sem.rotulo}</h3><span className="muted" style={{ fontSize: 12, marginLeft: 'auto', marginRight: 8 }}>função · pós</span><span className="badge">{dist.semAlocacao.length}</span></header>
          {dist.semAlocacao.length === 0 && <p className="muted" style={{ padding: '12px 18px', margin: 0 }}>Todos os docentes ativos têm componentes.</p>}
          <table className="lt"><tbody>
            {dist.semAlocacao.map(l => (
              <tr key={l.docente.id}>
                <td><b style={{ fontWeight: 600 }}>{l.docente.nome}</b>{l.status === 'funcao-sem-componente' && <div><span className="status warn">Função sem componente</span></div>}{l.abaixoMinimo && <div style={{ marginTop: 3 }}><span className="status warn">Abaixo de {minimoEnsino(c)}h</span></div>}</td>
                <td>{inpFuncao(l.docente.id, l.docente.nome)}<label className="check" style={{ fontSize: 12, marginTop: 4, display: 'flex' }}><input type="checkbox" checked={l.reducao} onChange={e => mudarSem(s => { s.reducaoPaid = { ...s.reducaoPaid, [l.docente.id]: e.target.checked } })} /> Redução PAID</label></td>
                <td title="CH na pós-graduação">{inpPos(l.docente.id, l.docente.nome, l.pos)}</td>
                <td className="r"><button className="btn sm ghost" onClick={() => setEditando(structuredClone(l.docente))}>Editar</button></td>
              </tr>
            ))}
          </tbody></table>
        </section>
        <section className="bloco">
          <header><h3>Afastados e dispensados</h3><span className="badge">{dist.indisponiveis.length}</span></header>
          <table className="lt"><tbody>
            {dist.indisponiveis.map(l => (
              <tr key={l.docente.id}>
                <td><b style={{ fontWeight: 600 }}>{l.docente.nome}</b><div className="muted" style={{ fontSize: 12 }}>{l.docente.obs || (l.docente.situacao === 'afastado' ? 'Afastado' : 'Dispensado')}</div></td>
                <td>{l.itens.length ? <span className="status err">Alocado em {l.itens.map(i => i.aula.codigo).join(', ')}</span> : <span className="status" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>{l.docente.situacao}</span>}</td>
                <td className="r"><button className="btn sm ghost" onClick={() => setEditando(structuredClone(l.docente))}>Editar</button></td>
              </tr>
            ))}
          </tbody></table>
        </section>
      </div>

      <section className="bloco">
        <header><h3>Docentes de outros colegiados</h3><span className="badge">{externos.length}</span></header>
        {externos.length === 0 && <p className="muted" style={{ padding: '12px 18px', margin: 0 }}>Nenhum docente externo alocado neste semestre.</p>}
        <table className="lt"><tbody>
          {externos.map(({ d, aulas }) => (
            <tr key={d.id}>
              <td><b style={{ fontWeight: 600 }}>{d.tratamento} {d.nome}</b>{d.obs && <div className="muted" style={{ fontSize: 12 }}>{d.obs}</div>}</td>
              <td style={{ fontSize: 13 }}>{aulas.map(a => <div key={a.id}><span className="mono muted">{a.codigo}</span> {a.nome} <span className="muted">· {a.turmas.map(x => turmaCurta(c, x)).join(' + ')}{a.colegiado ? ' · ' + a.colegiado : ''}</span></div>)}</td>
              <td className="r"><button className="btn sm ghost" onClick={() => setEditando(structuredClone(d))}>Editar</button></td>
            </tr>
          ))}
        </tbody></table>
      </section>

      {editando && <DocenteModal docente={editando} existe={proj.docentes.some(d => d.id === editando.id)} emUso={proj.semestres.some(s => s.aulas.some(a => a.alocacao.some(x => x.docente === editando.id)))}
        onFechar={() => setEditando(null)}
        onSalvar={d => { mudar(p => { const i = p.docentes.findIndex(x => x.id === d.id); if (i >= 0) p.docentes[i] = d; else p.docentes.push(d) }); setEditando(null) }}
        onExcluir={id => { mudar(p => { p.docentes = p.docentes.filter(x => x.id !== id) }); setEditando(null) }} />}
    </div>
  )
}

function DocenteModal({ docente, existe, emUso, onSalvar, onExcluir, onFechar }: { docente: Docente; existe: boolean; emUso: boolean; onSalvar: (d: Docente) => void; onExcluir: (id: string) => void; onFechar: () => void }) {
  const [d, setD] = useState(docente)
  const [conf, setConf] = useState(false)
  return (
    <Modal titulo={existe ? 'Editar docente' : 'Novo docente'} onClose={onFechar} largura={600} rodape={<>
      <div>{existe && (emUso ? <span className="muted" style={{ fontSize: 13 }}>Docente alocado em alguma oferta — não pode ser excluído.</span> : conf ? <span className="confirma">Excluir do cadastro? <button className="btn sm danger" onClick={() => onExcluir(d.id)}>Excluir</button></span> : <button className="btn danger" onClick={() => setConf(true)}>Excluir</button>)}</div>
      <div style={{ display: 'flex', gap: 8 }}><button className="btn" onClick={onFechar}>Cancelar</button><button className="btn pri" disabled={!d.nome.trim()} onClick={() => onSalvar({ ...d, curto: d.curto.trim() || d.nome.split(' ').slice(0, 2).join(' ') })}>Salvar</button></div>
    </>}>
      <Campo rotulo="Nome completo"><input className="inp" id="dc-nome" value={d.nome} onChange={e => setD({ ...d, nome: e.target.value })} /></Campo>
      <div className="linha">
        <Campo rotulo="Nome na grade"><input className="inp" id="dc-curto" value={d.curto} placeholder="Ex.: Raphaelle" onChange={e => setD({ ...d, curto: e.target.value })} /></Campo>
        <Campo rotulo="Tratamento" style={{ flex: '0 0 110px' }}><select className="inp" value={d.tratamento} onChange={e => setD({ ...d, tratamento: e.target.value })}><option>Prof.</option><option>Profa.</option><option value="">—</option></select></Campo>
      </div>
      <div className="linha">
        <Campo rotulo="Vínculo"><select className="inp" value={d.vinculo} onChange={e => setD({ ...d, vinculo: e.target.value as Docente['vinculo'] })}><option value="curso">Docente do curso</option><option value="externo">Externo (outro colegiado)</option></select></Campo>
        <Campo rotulo="Situação"><select className="inp" value={d.situacao} onChange={e => setD({ ...d, situacao: e.target.value as Docente['situacao'] })}><option value="ativo">Ativo</option><option value="afastado">Afastado</option><option value="dispensado">Dispensado do ensino</option></select></Campo>
      </div>
      <Campo rotulo="Observação"><input className="inp" id="dc-obs" value={d.obs} onChange={e => setD({ ...d, obs: e.target.value })} placeholder="Ex.: afastamento até 2027.1" /></Campo>
    </Modal>
  )
}

// =============== MATRIZ ===============
export function MatrizView({ proj, sem, turmaSel, setTurmaSel, abrirEditor }: { proj: Projeto; sem: Semestre; turmaSel: string; setTurmaSel: (id: string) => void; abrirEditor: (id: string | null, preset?: Preset) => void }) {
  const c = proj.config
  const turma = sem.turmas.find(t => t.id === turmaSel) ?? sem.turmas[0]
  const [todos, setTodos] = useState(false)
  if (!turma) return <div className="vazio">Sem turmas neste semestre.</div>
  const m = matrizDaTurma(c, turma)
  const per = periodoDaTurma(sem, turma)
  const ofertas = new Map(sem.aulas.filter(a => a.turmas.includes(turma.id)).map(a => [a.codigo, a]))
  const comps = (m?.componentes ?? []).filter(x => todos || x.nivel === per)
  const niveis = [...new Set(comps.map(x => x.nivel))].sort((a, b) => (a || 99) - (b || 99))
  const foraMatriz = sem.aulas.filter(a => a.turmas.includes(turma.id) && !(m?.componentes ?? []).some(x => x.codigo === a.codigo))
  return (
    <div className="secao">
      <div className="secao-topo">
        <div><h2>Matriz × oferta</h2><p>Confira se cada turma recebe as obrigatórias do seu período. A matriz é escolhida pelo ano de ingresso da turma.</p></div>
        <div className="filtros">
          <select className="inp" value={turma.id} onChange={e => setTurmaSel(e.target.value)} aria-label="Turma">
            {[...sem.turmas].sort((a, b) => b.ingresso - a.ingresso).map(t => <option key={t.id} value={t.id}>{rotuloTurma(c, sem, t)}</option>)}
          </select>
          <label className="check"><input type="checkbox" checked={todos} onChange={e => setTodos(e.target.checked)} /> Mostrar a matriz inteira</label>
        </div>
      </div>
      {!m ? <div className="cartao vazio">Nenhuma matriz cadastrada para {turma.habilitacao} com ingresso em {turma.ingresso}. Cadastre em Configurações → Matrizes.</div> : (
        <div className="cartao scroll-x">
          <div className="cab"><h3>{m.nome}</h3><span className="muted" style={{ fontSize: 13 }}>{m.componentes.length} componentes · turma no {per}º período</span></div>
          <table className="tab" style={{ minWidth: 640 }}>
            <thead><tr><th>Nível</th><th>Código</th><th>Componente</th><th className="r">CH</th><th>Situação nesta oferta</th><th></th></tr></thead>
            <tbody>
              {niveis.map(nv => comps.filter(x => x.nivel === nv).map(x => {
                const of = ofertas.get(x.codigo)
                return (
                  <tr key={x.codigo} style={nv === per ? undefined : { opacity: .75 }}>
                    <td className="muted">{nv ? `${nv}º` : 'Optativa'}</td>
                    <td className="mono">{x.codigo}</td>
                    <td>{x.nome}</td>
                    <td className="r num">{x.ch}h</td>
                    <td>{of ? <Pill tipo="ok">ofertado · {of.alocacao.map(a => nomeDocente(proj.docentes.find(d => d.id === a.docente))).join(', ') || 'docente a definir'}</Pill> : nv === per && x.natureza === 'obrigatoria' ? <Pill tipo="warn">não ofertado</Pill> : <span className="muted">—</span>}</td>
                    <td>{!of && <button className="btn sm" onClick={() => abrirEditor(null, { turmaId: turma.id, codigo: x.codigo, nome: x.nome, ch: x.ch })}>Ofertar</button>}</td>
                  </tr>
                )
              }))}
            </tbody>
          </table>
        </div>
      )}
      {foraMatriz.length > 0 && (
        <div className="cartao">
          <div className="cab"><h3>Ofertados para esta turma, fora da matriz dela</h3></div>
          <div className="pad">{foraMatriz.map(a => <div key={a.id}><span className="mono">{a.codigo || 'sem código'}</span> {a.nome} <span className="muted">— remanescentes, equivalência ou erro de código?</span></div>)}</div>
        </div>
      )}
    </div>
  )
}

// =============== PENDÊNCIAS ===============
export function PendenciasView({ proj, sem, problemas, mudarSem, irPara, irDocentes }: { proj: Projeto; sem: Semestre; problemas: Problema[]; mudarSem: MudarSem; irPara: (turmaId: string, aulaId?: string) => void; irDocentes: () => void }) {
  const [txt, setTxt] = useState('')
  const grupos = useMemo(() => {
    const m = new Map<string, Problema[]>()
    const ordem = { erro: 0, aviso: 1, info: 2 }
    for (const p of [...problemas].sort((a, b) => ordem[a.nivel] - ordem[b.nivel])) m.set(p.tipo, [...(m.get(p.tipo) ?? []), p])
    return [...m]
  }, [problemas])
  const n = (nv: string) => problemas.filter(p => p.nivel === nv).length
  const ign = sem.ignorados?.length ?? 0
  return (
    <div className="secao">
      <div className="secao-topo"><div><h2>Pendências · {sem.rotulo}</h2><p>Conferência automática da oferta. Corrija na grade ou marque como “ciente” o que for intencional (por exemplo, turmas de remanescentes).</p></div></div>
      <div className="resumo">
        <div className="err"><b className="num">{n('erro')}</b><span>conflitos e impedimentos</span></div>
        <div className="warn"><b className="num">{n('aviso')}</b><span>avisos para resolver</span></div>
        <div className="info"><b className="num">{n('info')}</b><span>observações sobre a matriz</span></div>
        <div><b className="num">{sem.pendencias.filter(p => !p.feito).length}</b><span>lembretes abertos</span></div>
      </div>

      <div className="cartao">
        <div className="cab"><h3>Lembretes da coordenação</h3></div>
        <div className="pad">
          {sem.pendencias.map(p => (
            <div key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label className="check" style={{ flex: 1, textDecoration: p.feito ? 'line-through' : undefined, color: p.feito ? 'var(--muted)' : undefined }}>
                <input type="checkbox" checked={p.feito} onChange={e => mudarSem(s => { s.pendencias = s.pendencias.map(x => x.id === p.id ? { ...x, feito: e.target.checked } : x) })} /> {p.texto}
              </label>
              <button className="btn ghost sm" aria-label="Remover lembrete" onClick={() => mudarSem(s => { s.pendencias = s.pendencias.filter(x => x.id !== p.id) })}>✕</button>
            </div>
          ))}
          <form className="linha" onSubmit={e => { e.preventDefault(); if (!txt.trim()) return; mudarSem(s => { s.pendencias.push({ id: uid('p'), texto: txt.trim(), feito: false }) }); setTxt('') }}>
            <input className="inp" id="novo-lembrete" style={{ flex: 1 }} value={txt} onChange={e => setTxt(e.target.value)} placeholder="Novo lembrete, ex.: confirmar sala do laboratório" />
            <button className="btn" type="submit">Adicionar</button>
          </form>
        </div>
      </div>

      {grupos.length === 0 && <div className="cartao vazio">Nenhuma pendência automática. A oferta está consistente.</div>}
      {grupos.map(([tipo, ps]) => (
        <div className="cartao grupo" key={tipo}>
          <h3>{tipo} <span className={`badge ${ps[0].nivel === 'erro' ? 'err' : ps[0].nivel === 'aviso' ? 'warn' : ''}`}>{ps.length}</span></h3>
          {ps.map(p => (
            <div className="prob" key={p.id}>
              <span className={`sev ${p.nivel}`} />
              <div className="tx">{p.texto}{p.detalhe && <small>{p.detalhe}</small>}</div>
              <div className="ac">
                {p.turmaId && <button className="btn sm" onClick={() => irPara(p.turmaId!, p.aulaIds?.[0])}>Ver na grade</button>}
                {!p.turmaId && p.docenteId && <button className="btn sm" onClick={irDocentes}>Ver docentes</button>}
                <button className="btn sm ghost" title="Marcar como ciente e esconder" onClick={() => mudarSem(s => { s.ignorados = [...(s.ignorados ?? []), p.id] })}>Ciente</button>
              </div>
            </div>
          ))}
        </div>
      ))}
      {ign > 0 && <p className="muted" style={{ fontSize: 13 }}>{ign} item(ns) marcado(s) como ciente. <button className="btn sm ghost" onClick={() => mudarSem(s => { s.ignorados = [] })}>Mostrar de novo</button></p>}
      {proj.docentes.length === 0 && <p className="muted">Cadastre docentes na aba Docentes.</p>}
    </div>
  )
}

// =============== VERSÕES ===============
export function VersoesView({ proj, sem, mudarSem, avisar }: { proj: Projeto; sem: Semestre; mudarSem: MudarSem; avisar: (m: string) => void }) {
  const [nome, setNome] = useState(`v${sem.versoes.length + 1}`)
  const [nota, setNota] = useState('')
  const [comparando, setComparando] = useState<Versao | null>(null)
  const [restaurar, setRestaurar] = useState<string | null>(null)
  const dif = comparando ? diferencas(proj, comparando.snapshot, sem) : []
  return (
    <div className="secao">
      <div className="secao-topo"><div><h2>Versões · {sem.rotulo}</h2><p>Guarde uma versão sempre que enviar a oferta (prévia ao colegiado, versão aos discentes, final). Depois compare para saber exatamente o que mudou.</p></div></div>
      <form className="cartao pad" onSubmit={e => {
        e.preventDefault()
        mudarSem(s => { s.versoes.push({ id: uid('v'), nome: nome.trim() || `v${s.versoes.length + 1}`, nota, criadaEm: new Date().toISOString(), snapshot: structuredClone({ turmas: s.turmas, aulas: s.aulas, chPrevista: s.chPrevista }) }) })
        avisar(`Versão “${nome}” guardada`); setNome(`v${sem.versoes.length + 2}`); setNota('')
      }}>
        <div className="linha">
          <Campo rotulo="Nome da versão" style={{ flex: '0 1 200px' }}><input className="inp" id="v-nome" value={nome} onChange={e => setNome(e.target.value)} /></Campo>
          <Campo rotulo="Nota (para quem foi enviada, por exemplo)"><input className="inp" id="v-nota" value={nota} onChange={e => setNota(e.target.value)} placeholder="Enviada aos discentes em 25/02" /></Campo>
          <button className="btn pri" type="submit">Guardar versão atual</button>
        </div>
      </form>
      {sem.versoes.length === 0 ? <div className="cartao vazio">Nenhuma versão guardada ainda.</div> : (
        <div className="cartao scroll-x">
          <table className="tab">
            <thead><tr><th>Versão</th><th>Guardada em</th><th>Nota</th><th className="r">Componentes</th><th></th></tr></thead>
            <tbody>
              {[...sem.versoes].reverse().map(v => (
                <tr key={v.id}>
                  <td style={{ fontWeight: 600 }}>{v.nome}</td>
                  <td className="num">{new Date(v.criadaEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td className="muted">{v.nota}</td>
                  <td className="r num">{v.snapshot.aulas.length}</td>
                  <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <button className="btn sm" onClick={() => setComparando(v)}>Comparar com a atual</button>{' '}
                    {restaurar === v.id ? <span className="confirma" style={{ display: 'inline-flex' }}>Substituir a oferta atual? <button className="btn sm danger" onClick={() => { mudarSem(s => { s.turmas = structuredClone(v.snapshot.turmas); s.aulas = structuredClone(v.snapshot.aulas); s.chPrevista = { ...v.snapshot.chPrevista } }); setRestaurar(null); avisar(`Oferta restaurada para “${v.nome}”. Use Desfazer se precisar voltar.`) }}>Restaurar</button><button className="btn sm" onClick={() => setRestaurar(null)}>Não</button></span>
                      : <button className="btn sm ghost" onClick={() => setRestaurar(v.id)}>Restaurar</button>}
                    <button className="btn sm ghost danger" onClick={() => mudarSem(s => { s.versoes = s.versoes.filter(x => x.id !== v.id) })}>Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {comparando && (
        <Modal titulo={`O que mudou desde “${comparando.nome}”`} onClose={() => setComparando(null)} largura={820}>
          {dif.length === 0 ? <p className="muted">Nenhuma diferença na grade.</p> : (
            <ul className="diff" style={{ margin: 0, paddingLeft: 18 }}>
              {dif.map((d, i) => (
                <li key={i}><b className={d.tipo === 'incluido' ? 'inc' : d.tipo === 'removido' ? 'rem' : ''}>{d.tipo === 'incluido' ? 'Incluído' : d.tipo === 'removido' ? 'Removido' : 'Alterado'}:</b> {d.aula}
                  {d.mudancas.length > 0 && <ul>{d.mudancas.map((m, j) => <li key={j} className="muted">{m}</li>)}</ul>}</li>
              ))}
            </ul>
          )}
          {dif.length > 0 && <button className="btn" style={{ alignSelf: 'start' }} onClick={() => {
            const txt = dif.map(d => `${d.tipo.toUpperCase()}: ${d.aula}${d.mudancas.length ? '\n  - ' + d.mudancas.join('\n  - ') : ''}`).join('\n')
            navigator.clipboard?.writeText(txt).then(() => avisar('Lista de mudanças copiada'), () => avisar('Não foi possível copiar'))
          }}>Copiar lista de mudanças</button>}
        </Modal>
      )}
    </div>
  )
}

// =============== EXPORTAR ===============
export function ExportarView({ proj, sem, avisar, salvarArquivo }: { proj: Projeto; sem: Semestre; avisar: (m: string) => void; salvarArquivo: () => void }) {
  const memo = memorandoExternos(proj, sem)
  const internos = semDocenteInterno(proj, sem)
  const [gerando, setGerando] = useState('')
  const base = `Ofertas_${proj.config.sigla || 'Curso'}_${sem.rotulo.replace('.', '_')}`
  const docx = async (tipo: 'discente' | 'docente') => {
    setGerando(tipo)
    try { baixar(await gerarDocx(proj, sem, tipo), `${base}_${tipo === 'discente' ? 'Discentes' : 'Docentes'}.docx`); avisar('Documento gerado') }
    catch (e) { avisar('Erro ao gerar o documento: ' + (e as Error).message) }
    finally { setGerando('') }
  }
  return (
    <div className="secao">
      <div className="secao-topo"><div><h2>Documentos · {sem.rotulo}</h2><p>Tudo sai da mesma base: mudou na grade, mudou em todos os documentos.</p></div></div>
      <div className="grid2">
        <div className="cartao"><div className="cab"><h3>Oferta para discentes</h3></div><div className="pad">
          <span className="muted">Grades de todas as turmas com componentes, CH e docentes, módulos livres e observações. Word (.docx), paisagem.</span>
          <button className="btn pri" style={{ alignSelf: 'start' }} disabled={!!gerando} onClick={() => docx('discente')}>{gerando === 'discente' ? 'Gerando…' : 'Baixar .docx'}</button>
        </div></div>
        <div className="cartao"><div className="cab"><h3>Quadro de ofertas para o Departamento</h3></div><div className="pad">
          <span className="muted">Uma linha por componente e docente, com a CH de cada docente e o horário no padrão do Sigaa (ex.: T1234), separado por habilitação, com o coordenador e as orientações do DCBS. Word (.docx).</span>
          <button className="btn pri" style={{ alignSelf: 'start' }} disabled={!!gerando} onClick={async () => {
            setGerando('quadro')
            try { baixar(await gerarQuadroDepartamento(proj, sem), `OFERTA_${sem.rotulo.replace('.', '_')}_${proj.config.sigla || 'CURSO'}_${[...proj.config.habilitacoes].sort((x, y) => y.nome.localeCompare(x.nome)).map(h => (h.abrev || h.nome)[0]).join('_')}.docx`); avisar('Quadro do Departamento gerado') }
            catch (e) { avisar('Erro ao gerar o quadro: ' + (e as Error).message) } finally { setGerando('') }
          }}>{gerando === 'quadro' ? 'Gerando…' : 'Baixar .docx'}</button>
          {proj.config.habilitacoes.some(h => !h.coordenador) && <small style={{ color: 'var(--warn)' }}>Informe o coordenador de cada habilitação em Configurações → Curso.</small>}
        </div></div>
        <div className="cartao"><div className="cab"><h3>Oferta para docentes e colegiado</h3></div><div className="pad">
          <span className="muted">As grades, mais a distribuição da carga horária docente, os componentes com docente a definir e o quadro de docentes externos.</span>
          <button className="btn pri" style={{ alignSelf: 'start' }} disabled={!!gerando} onClick={() => docx('docente')}>{gerando === 'docente' ? 'Gerando…' : 'Baixar .docx'}</button>
        </div></div>
        <div className="cartao"><div className="cab"><h3>Planilha de carga horária</h3></div><div className="pad">
          <span className="muted">CSV (abre no Excel) com CH prevista, alocada e componentes de cada docente.</span>
          <button className="btn" style={{ alignSelf: 'start' }} onClick={() => baixar(new Blob([csvCargaHoraria(proj, sem)], { type: 'text/csv' }), `${base}_CH_docente.csv`)}>Baixar .csv</button>
        </div></div>
        <div className="cartao"><div className="cab"><h3>Arquivo do projeto</h3></div><div className="pad">
          <span className="muted">Todos os semestres, docentes e matrizes num único .json. Guarde na pasta da secretaria (OneDrive) — é a cópia de segurança e o que outra pessoa abre para continuar o trabalho.</span>
          <button className="btn" style={{ alignSelf: 'start' }} onClick={salvarArquivo}>Salvar arquivo .json</button>
        </div></div>
      </div>
      <div className="cartao">
        <div className="cab"><h3>Rascunho de memorando – docentes de outros colegiados</h3>
          <button className="btn sm" onClick={() => navigator.clipboard?.writeText(memo).then(() => avisar('Texto copiado'), () => avisar('Não foi possível copiar; selecione o texto manualmente'))}>Copiar texto</button></div>
        <div className="pad">
          <span className="muted" style={{ fontSize: 13 }}>Entram aqui os componentes marcados como “Docente de outro colegiado” ou com docente externo alocado, agrupados pelo colegiado responsável. Atualiza sozinho a cada mudança na oferta.</span>
          <pre className="memo">{memo || 'Nenhum componente de outro colegiado neste semestre.'}</pre>
          {internos.length > 0 && <small className="muted">{internos.length} componente(s) sem docente não estão no memorando por não estarem marcados como de outro colegiado: {internos.map(a => a.codigo || a.nome).join(', ')}. Se algum deles depende de outro colegiado, marque essa opção no componente.</small>}
        </div>
      </div>
      <div className="cartao">
        <div className="cab"><h3>Resumo por componente</h3></div>
        <div className="scroll-x"><table className="tab" style={{ minWidth: 760 }}>
          <thead><tr><th>Código</th><th>Componente</th><th>Turmas</th><th>Horário</th><th>Docentes</th></tr></thead>
          <tbody>{[...sem.aulas].sort((a, b) => a.codigo.localeCompare(b.codigo)).map(a => (
            <tr key={a.id}><td className="mono">{a.codigo}</td><td>{a.nome} <span className="muted num">{a.ch}h</span></td><td>{a.turmas.map(x => turmaCurta(proj.config, x)).join(' + ')}</td>
              <td className="muted" style={{ fontSize: 13 }}>{a.moduloLivre ? 'Módulo livre' : resumoHorarios(proj.config, a.horarios) || '—'}</td>
              <td>{a.alocacao.map(x => `${nomeDocente(proj.docentes.find(d => d.id === x.docente))}${a.alocacao.length > 1 ? ` (${x.ch}h)` : ''}`).join(', ') || <span style={{ color: 'var(--warn)' }}>A definir</span>}</td></tr>
          ))}</tbody>
        </table></div>
      </div>
    </div>
  )
}
