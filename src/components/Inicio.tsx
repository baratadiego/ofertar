import type { Problema, Projeto, Semestre } from '../lib/types'
import { aulasEsperadas, chAlocada, habil, matrizDaTurma, nomeDocente, periodoDaTurma, sugereModuloLivre, turmaCurta } from '../lib/model'

interface Props {
  proj: Projeto
  sem: Semestre
  mudarSem: (fn: (s: Semestre, p: Projeto) => void) => void
  problemas: Problema[]
  irTurma: (turmaId: string, aulaId?: string) => void
  irAba: (aba: 'grade' | 'docentes' | 'matriz' | 'pendencias' | 'versoes' | 'exportar' | 'config') => void
}

export function Inicio({ proj, sem, mudarSem, problemas, irTurma, irAba }: Props) {
  const c = proj.config
  const aulas = sem.aulas
  const semDoc = aulas.filter(a => a.alocacao.length === 0).length
  const comHorario = aulas.filter(a => a.moduloLivre || a.horarios.length > 0).length
  const conflitos = problemas.filter(p => p.nivel === 'erro').length
  const docentesCurso = proj.docentes.filter(d => d.vinculo === 'curso' && d.situacao === 'ativo')
  const chTotal = docentesCurso.reduce((x, d) => x + chAlocada(sem, d.id), 0)
  const turmas = [...sem.turmas].sort((a, b) => b.ingresso - a.ingresso || a.habilitacao.localeCompare(b.habilitacao))
  const destaques = [...problemas].sort((a, b) => (a.nivel === 'erro' ? 0 : 1) - (b.nivel === 'erro' ? 0 : 1)).filter(p => p.nivel !== 'info').slice(0, 4)
  const ultimaVersao = sem.versoes[sem.versoes.length - 1]
  const livres = aulas.filter(a => a.moduloLivre)
  const candidatos = aulas.filter(a => !a.moduloLivre && sugereModuloLivre(a.nome))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="stats">
        <div><b>{aulas.length}</b><span>componentes ofertados</span></div>
        <div><b>{comHorario}<span style={{ fontSize: 16, color: 'var(--muted)', display: 'inline' }}> / {aulas.length}</span></b><span>com horário definido</span></div>
        <div><b style={{ color: semDoc ? 'var(--warn)' : undefined }}>{semDoc}</b><span><i className="dot" style={{ background: 'var(--warn)' }} />com docente a definir</span></div>
        <div><b style={{ color: conflitos ? 'var(--err)' : undefined }}>{conflitos}</b><span><i className="dot" style={{ background: 'var(--err)' }} />conflitos e impedimentos</span></div>
        <div><b>{chTotal}h</b><span>CH alocada aos {docentesCurso.length} docentes ativos</span></div>
      </div>

      <div className="painel2">
        <section className="bloco">
          <header><h3>Turmas do semestre</h3><button className="vermais" onClick={() => irAba('grade')}>Abrir a grade ›</button></header>
          <div className="scroll-x">
            <table className="lt" style={{ minWidth: 560 }}>
              <thead><tr><th>Turma</th><th>Matriz</th><th>Montagem</th><th>Situação</th></tr></thead>
              <tbody>
                {turmas.map(t => {
                  const as = aulas.filter(a => a.turmas.includes(t.id))
                  const prontas = as.filter(a => a.alocacao.length > 0 && (a.moduloLivre || Math.abs(a.horarios.length - aulasEsperadas(c, a)) < 0.01)).length
                  const pct = as.length ? Math.round((prontas / as.length) * 100) : 0
                  const ps = problemas.filter(p => p.turmaId === t.id)
                  const err = ps.filter(p => p.nivel === 'erro').length
                  const warn = ps.filter(p => p.nivel === 'aviso').length
                  const m = matrizDaTurma(c, t)
                  return (
                    <tr key={t.id} className="click" onClick={() => irTurma(t.id)}>
                      <td><div className="nm"><span className="ic">{periodoDaTurma(sem, t)}º</span><div><b>Turma {t.ingresso} · {habil(c, t.habilitacao).nome}</b><small>{as.length} componentes</small></div></div></td>
                      <td className="muted" style={{ fontSize: 13 }}>{m?.nome.replace(/^.*–\s*/, '') ?? '—'}</td>
                      <td><div className="prog"><span className="tr"><i style={{ width: pct + '%' }} /></span><span className="num muted" style={{ fontSize: 12 }}>{prontas}/{as.length}</span></div></td>
                      <td>{err ? <span className="status err">{err} conflito{err > 1 ? 's' : ''}</span> : warn ? <span className="status warn">{warn} pendência{warn > 1 ? 's' : ''}</span> : <span className="status ok">pronta</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <section className="bloco">
            <header><h3>Precisa de atenção</h3><button className="vermais" onClick={() => irAba('pendencias')}>Ver todas ›</button></header>
            {destaques.length === 0 && <p className="muted" style={{ padding: '14px 18px', margin: 0 }}>Nenhuma pendência. A oferta está consistente.</p>}
            {destaques.map(p => (
              <div key={p.id} className={`alerta ${p.nivel === 'erro' ? '' : 'warn'}`}>
                <span className="ico">!</span>
                <b>{p.tipo}</b>
                <small>{p.texto}</small>
                <div className="acts">
                  {p.turmaId ? <button className="btn sm" onClick={() => irTurma(p.turmaId!, p.aulaIds?.[0])}>Ver na grade</button>
                    : <button className="btn sm" onClick={() => irAba('docentes')}>Ver docentes</button>}
                </div>
              </div>
            ))}
          </section>

          <section className="bloco">
            <header><h3>Módulo livre em {sem.rotulo}</h3><span className="badge">{livres.length}</span></header>
            <table className="lt"><tbody>
              {livres.map(a => (
                <tr key={a.id} className="click" onClick={() => irTurma(a.turmas[0], a.id)}>
                  <td><span className="mono muted" style={{ fontSize: 12 }}>{a.codigo}</span> {a.nome}<div className="muted" style={{ fontSize: 12 }}>{a.turmas.map(x => turmaCurta(c, x)).join(' + ')} · {a.alocacao.map(x => nomeDocente(proj.docentes.find(d => d.id === x.docente))).join(', ') || 'docente a definir'}</div></td>
                  <td className="r num muted">{a.ch}h</td>
                </tr>
              ))}
              {candidatos.map(a => (
                <tr key={a.id}>
                  <td><span className="mono muted" style={{ fontSize: 12 }}>{a.codigo}</span> {a.nome}<div className="muted" style={{ fontSize: 12 }}>{a.turmas.map(x => turmaCurta(c, x)).join(' + ')} · hoje com horário fixo</div></td>
                  <td className="r"><button className="btn sm" onClick={() => mudarSem(s => { s.aulas.find(x => x.id === a.id)!.moduloLivre = true })}>Módulo livre</button></td>
                </tr>
              ))}
            </tbody></table>
            {livres.length === 0 && candidatos.length === 0 && <p className="muted" style={{ padding: '12px 18px', margin: 0 }}>Nenhum componente em módulo livre.</p>}
            {candidatos.length > 0 && <p className="muted" style={{ padding: '4px 18px 12px', margin: 0, fontSize: 12 }}>Os itens com botão são estágios, práticas, ACE ou TCC que estão com horário fixo. Marque os que serão ofertados em módulo livre.</p>}
          </section>

          <section className="bloco">
            <header><h3>Próximos passos</h3></header>
            <div className="atalhos">
              <button className="atalho" onClick={() => irAba('docentes')}><b>Conferir CH docente</b><span>Prevista × alocada</span></button>
              <button className="atalho" onClick={() => irAba('matriz')}><b>Matriz × oferta</b><span>Obrigatórias de cada período</span></button>
              <button className="atalho" onClick={() => irAba('versoes')}><b>Guardar versão</b><span>{ultimaVersao ? `Última: ${ultimaVersao.nome}` : 'Nenhuma guardada ainda'}</span></button>
              <button className="atalho" onClick={() => irAba('exportar')}><b>Gerar documentos</b><span>Word para discentes e docentes</span></button>
            </div>
          </section>
        </div>
      </div>
          </div>
  )
}
