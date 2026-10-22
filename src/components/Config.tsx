import { useState } from 'react'
import type { ComponenteMatriz, Matriz, Projeto, Semestre } from '../lib/types'
import { corTurma, criarSemestre, habil, PALETA_TURMAS, periodoDaTurma, rotuloParaAnoPeriodo, rotuloTurma, uid } from '../lib/model'
import { baixar } from '../lib/storage'
import { Campo, Modal } from './ui'

type Mudar = (fn: (p: Projeto) => void) => void
type MudarSem = (fn: (s: Semestre, p: Projeto) => void) => void

const MODELO_CSV = [
  'nivel;codigo;nome;ch;natureza',
  '1;DCBS0309;Biologia Celular;60;obrigatoria',
  '1;DCBS0312;Química Geral e Inorgânica;75;obrigatoria',
  '2;DCBS0323;Bioestatística;60;obrigatoria',
  '3;DCBS0333;Atividade Curricular de Extensão – ACE I;90;obrigatoria',
  '0;DCBS0311;Herpetologia: Introdução aos Anfíbios e Répteis;60;optativa',
].join('\r\n') + '\r\n'
const baixarModelo = () => baixar(new Blob(['\ufeff' + MODELO_CSV], { type: 'text/csv' }), 'modelo-matriz.csv')

/** Lê o arquivo em UTF-8; se vier do Excel em ANSI (Windows-1252), decodifica nesse padrão para não estragar os acentos */
async function lerTexto(f: File) {
  const buf = await f.arrayBuffer()
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf) } catch { return new TextDecoder('windows-1252').decode(buf) }
}

export function lerCSVMatriz(txt: string): ComponenteMatriz[] {
  const linhas = txt.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim())
  if (!linhas.length) return []
  const sep = linhas[0].includes(';') ? ';' : linhas[0].includes('\t') ? '\t' : ','
  const cab = linhas[0].toLowerCase().split(sep).map(x => x.trim())
  const temCab = cab.includes('codigo') || cab.includes('código')
  const idx = (n: string[], def: number) => { const i = cab.findIndex(x => n.includes(x)); return temCab && i >= 0 ? i : def }
  const iN = idx(['nivel', 'nível'], 0), iC = idx(['codigo', 'código'], 1), iNm = idx(['nome', 'componente'], 2), iCh = idx(['ch', 'carga horária', 'carga'], 3), iNat = idx(['natureza', 'tipo'], 4)
  return linhas.slice(temCab ? 1 : 0).map(l => {
    const c = l.split(sep).map(x => x.trim().replace(/^"|"$/g, ''))
    const nivel = parseInt(c[iN]) || 0
    const nat = (c[iNat] || '').toLowerCase()
    return { nivel, codigo: (c[iC] || '').toUpperCase(), nome: c[iNm] || '', ch: parseInt(c[iCh]) || 0, natureza: nat.startsWith('opt') || nivel === 0 ? 'optativa' : 'obrigatoria' } as ComponenteMatriz
  }).filter(x => x.codigo && x.nome)
}

export function ConfigView({ proj, sem, mudar, mudarSem, setSemId, avisar, abrir, salvarComo, sair }: {
  proj: Projeto; sem: Semestre; mudar: Mudar; mudarSem: MudarSem; setSemId: (id: string) => void; avisar: (m: string) => void
  abrir: () => void; salvarComo: () => void; sair: () => void
}) {
  const c = proj.config
  const [novoSem, setNovoSem] = useState(false)
  const [matrizEd, setMatrizEd] = useState<Matriz | null>(null)
  const [confExcluirSem, setConfExcluirSem] = useState(false)
  const [confSair, setConfSair] = useState(false)
  const [novaTurma, setNovaTurma] = useState({ ingresso: sem.ano, habilitacao: c.habilitacoes[0]?.id ?? '' })

  return (
    <div className="secao">
      <div className="secao-topo"><div><h2>Configurações</h2><p>Tudo o que muda de um curso para outro fica aqui: horários, habilitações, matrizes e turmas.</p></div></div>
      <div className="grid2">
        <div className="cartao"><div className="cab"><h3>Curso</h3></div><div className="pad">
          <Campo rotulo="Instituição"><input className="inp" id="cfg-inst" value={c.instituicao} onChange={e => mudar(p => { p.config.instituicao = e.target.value })} /></Campo>
          <Campo rotulo="Departamento / unidade (cabeçalho dos documentos)"><input className="inp" id="cfg-unid" value={c.unidade ?? ''} placeholder="Ex.: Departamento de Ciências Biológicas e da Saúde" onChange={e => mudar(p => { p.config.unidade = e.target.value })} /></Campo>
          <div className="linha">
            <Campo rotulo="Curso"><input className="inp" id="cfg-curso" value={c.curso} onChange={e => mudar(p => { p.config.curso = e.target.value })} /></Campo>
            <Campo rotulo="Sigla" style={{ flex: '0 0 110px' }}><input className="inp" id="cfg-sigla" value={c.sigla} onChange={e => mudar(p => { p.config.sigla = e.target.value })} /></Campo>
          </div>
          <div className="linha">
            <Campo rotulo="Número de semestres (níveis)"><input className="inp num" id="cfg-niveis" type="number" min={1} max={14} value={c.niveis} onChange={e => mudar(p => { p.config.niveis = +e.target.value })} /></Campo>
            <Campo rotulo="Horas de CH por aula semanal"><input className="inp num" id="cfg-chaula" type="number" min={1} value={c.chPorAulaSemanal} onChange={e => mudar(p => { p.config.chPorAulaSemanal = +e.target.value })} /></Campo>
          </div>
          <Campo rotulo="CH mínima de ensino por docente no semestre (graduação + pós)"><input className="inp num" id="cfg-chmin" type="number" min={0} step={15} value={c.chMinimaEnsino ?? 120} onChange={e => mudar(p => { p.config.chMinimaEnsino = +e.target.value })} /></Campo>
          <small className="muted">Com 15 h por aula semanal, 60h = 4 h/a por semana e o mínimo de 120h = 8 h/a por semana. Docentes com função registrada (coordenação etc.) não são cobrados pelo mínimo.</small>
          <div className="campo"><span>Habilitações</span>
            {c.habilitacoes.map((h, i) => (
              <div className="linha" key={i}>
                <input className="inp mono" style={{ width: 90 }} aria-label="Código" value={h.id} disabled />
                <input className="inp" style={{ flex: 1 }} aria-label="Nome" value={h.nome} onChange={e => mudar(p => { p.config.habilitacoes[i].nome = e.target.value })} />
                <input className="inp" style={{ width: 80 }} aria-label="Abreviação" value={h.abrev} onChange={e => mudar(p => { p.config.habilitacoes[i].abrev = e.target.value })} />
                <input className="inp" style={{ flex: '1 1 100%' }} aria-label={`Coordenador(a) de ${h.nome}`} placeholder={`Coordenador(a) de ${h.nome}`} value={h.coordenador ?? ''} onChange={e => mudar(p => { p.config.habilitacoes[i].coordenador = e.target.value })} />
              </div>
            ))}
            <button className="btn sm" style={{ alignSelf: 'start' }} onClick={() => mudar(p => { const n = p.config.habilitacoes.length + 1; p.config.habilitacoes.push({ id: `H${n}`, nome: 'Nova habilitação', abrev: `H${n}` }) })}>+ Habilitação</button>
          </div>
        </div></div>

        <div className="cartao"><div className="cab"><h3>Horários das aulas</h3></div><div className="pad">
          {c.turnos.map((tn, ti) => (
            <div key={tn.id} className="campo"><span>{tn.nome}</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {tn.slots.map((s, si) => (
                  <span key={s.id} style={{ display: 'inline-flex', gap: 2, alignItems: 'center', border: '1px solid var(--line)', borderRadius: 6, padding: 2 }}>
                    <input className="inp mono" style={{ width: 62, padding: '3px 4px' }} aria-label={`Início ${s.id}`} value={s.inicio} onChange={e => mudar(p => { p.config.turnos[ti].slots[si].inicio = e.target.value })} />
                    <input className="inp mono" style={{ width: 62, padding: '3px 4px' }} aria-label={`Fim ${s.id}`} value={s.fim} onChange={e => mudar(p => { p.config.turnos[ti].slots[si].fim = e.target.value })} />
                  </span>
                ))}
                <button className="btn sm ghost" onClick={() => mudar(p => { const t = p.config.turnos[ti]; const last = t.slots[t.slots.length - 1]; t.slots.push({ id: `${t.id}${t.slots.length + 1}`, inicio: last?.fim ?? '00:00', fim: last?.fim ?? '00:00' }) })}>+ aula</button>
                {tn.slots.length > 0 && <button className="btn sm ghost" onClick={() => mudar(p => { p.config.turnos[ti].slots.pop() })}>− aula</button>}
              </div>
            </div>
          ))}
          <small className="muted">Remover uma aula do fim do turno não apaga horários já marcados nela; eles só deixam de aparecer.</small>
        </div></div>
      </div>

      <div className="cartao">
        <div className="cab"><h3>Quadro de ofertas para o Departamento</h3></div>
        <div className="pad">
          <div className="grid2">
            <Campo rotulo="Cabeçalho (uma linha por linha)"><textarea className="inp" id="cfg-qd-cab" rows={5} value={c.quadroDepartamento?.cabecalho ?? ''} onChange={e => mudar(p => { p.config.quadroDepartamento = { cabecalho: e.target.value, orientacoes: p.config.quadroDepartamento?.orientacoes ?? '' } })} /></Campo>
            <Campo rotulo="Orientações impressas no fim (uma por linha; a numeração é automática)"><textarea className="inp" id="cfg-qd-ori" rows={5} value={c.quadroDepartamento?.orientacoes ?? ''} onChange={e => mudar(p => { p.config.quadroDepartamento = { cabecalho: p.config.quadroDepartamento?.cabecalho ?? '', orientacoes: e.target.value } })} /></Campo>
          </div>
          <small className="muted">Componentes de turma conjunta Lic. + Bach. aparecem uma vez, na habilitação cuja matriz tem o código.</small>
        </div>
      </div>

      <div className="cartao">
        <div className="cab"><h3>Matrizes curriculares</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn sm ghost" onClick={baixarModelo}>Baixar modelo .csv</button>
            <button className="btn sm pri" onClick={() => setMatrizEd({ id: uid('m'), habilitacao: c.habilitacoes[0]?.id ?? '', nome: '', ingressoDe: sem.ano, ingressoAte: 9999, componentes: [] })}>+ Matriz</button>
          </div>
        </div>
        <div className="scroll-x"><table className="tab">
          <thead><tr><th>Matriz</th><th>Habilitação</th><th>Turmas que usam</th><th className="r">Componentes</th><th></th></tr></thead>
          <tbody>{c.matrizes.map(m => (
            <tr key={m.id}><td style={{ fontWeight: 600 }}>{m.nome}</td><td>{habil(c, m.habilitacao).nome}</td>
              <td className="num">ingresso {m.ingressoDe}{m.ingressoAte >= 9999 ? ' em diante' : `–${m.ingressoAte}`}</td>
              <td className="r num">{m.componentes.length}</td>
              <td className="r"><button className="btn sm ghost" onClick={() => setMatrizEd(structuredClone(m))}>Editar</button></td></tr>
          ))}</tbody>
        </table></div>
      </div>

      <div className="grid2">
        <div className="cartao"><div className="cab"><h3>Semestre {sem.rotulo}</h3></div><div className="pad">
          <div className="linha">
            <Campo rotulo="Situação"><select className="inp" value={sem.status} onChange={e => mudarSem(s => { s.status = e.target.value })}>
              {['Em elaboração', 'Prévia enviada', 'Aprovada pelo colegiado', 'Em andamento', 'Encerrada'].map(x => <option key={x}>{x}</option>)}
            </select></Campo>
          </div>
          <div className="campo"><span>Turmas do semestre</span>
            {[...sem.turmas].sort((a, b) => b.ingresso - a.ingresso).map(t => (
              <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '150px auto 1fr auto', gap: 6, alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{rotuloTurma(c, sem, t, true)} <span className="muted">· {periodoDaTurma(sem, t)}º</span></span>
                <select className="inp" aria-label={`Cor do quadro da turma ${t.id}`} title="Cor dos quadros das turmas deste ano de ingresso" value={corTurma(c, t).forte.toUpperCase()}
                  style={{ width: 54, padding: '4px', background: corTurma(c, t).forte, color: '#fff' }}
                  onChange={e => mudarSem(s => { s.turmas.filter(x => x.ingresso === t.ingresso).forEach(x => { x.cor = e.target.value }) })}>
                  {PALETA_TURMAS.map(([f]) => <option key={f} value={f} style={{ background: f, color: '#fff' }}>■</option>)}
                </select>
                <input className="inp" aria-label={`Observação da turma ${t.id}`} placeholder="Observação impressa abaixo da grade (módulo livre etc.)" value={t.nota} onChange={e => mudarSem(s => { s.turmas.find(x => x.id === t.id)!.nota = e.target.value })} />
                <button className="btn ghost sm" aria-label="Remover turma" disabled={sem.aulas.some(a => a.turmas.includes(t.id))} title={sem.aulas.some(a => a.turmas.includes(t.id)) ? 'A turma tem componentes' : 'Remover turma'} onClick={() => mudarSem(s => { s.turmas = s.turmas.filter(x => x.id !== t.id) })}>✕</button>
              </div>
            ))}
            <div className="linha">
              <Campo rotulo="Ano de ingresso" style={{ flex: '0 0 120px' }}><input className="inp num" type="number" value={novaTurma.ingresso} onChange={e => setNovaTurma({ ...novaTurma, ingresso: +e.target.value })} /></Campo>
              <Campo rotulo="Habilitação"><select className="inp" value={novaTurma.habilitacao} onChange={e => setNovaTurma({ ...novaTurma, habilitacao: e.target.value })}>{c.habilitacoes.map(h => <option key={h.id} value={h.id}>{h.nome}</option>)}</select></Campo>
              <button className="btn" disabled={sem.turmas.some(t => t.id === `${novaTurma.ingresso}-${novaTurma.habilitacao}`)} onClick={() => mudarSem(s => { s.turmas.push({ id: `${novaTurma.ingresso}-${novaTurma.habilitacao}`, ingresso: novaTurma.ingresso, habilitacao: novaTurma.habilitacao, nota: '' }) })}>Adicionar turma</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
            <button className="btn pri" onClick={() => setNovoSem(true)}>+ Novo semestre</button>
            {proj.semestres.length > 1 && (confExcluirSem
              ? <span className="confirma">Excluir {sem.rotulo} e todas as suas versões? <button className="btn sm danger" onClick={() => { const resto = proj.semestres.filter(s => s.id !== sem.id); mudar(p => { p.semestres = p.semestres.filter(s => s.id !== sem.id) }); setSemId(resto[resto.length - 1].id); setConfExcluirSem(false) }}>Excluir</button><button className="btn sm" onClick={() => setConfExcluirSem(false)}>Não</button></span>
              : <button className="btn danger" onClick={() => setConfExcluirSem(true)}>Excluir semestre</button>)}
          </div>
        </div></div>

        <div className="cartao"><div className="cab"><h3>Dados</h3></div><div className="pad">
          <span className="muted">O app guarda tudo neste navegador automaticamente. Para levar a outro computador ou fazer cópia de segurança, salve o arquivo .json na pasta da secretaria.</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" onClick={abrir}>Abrir outro arquivo…</button>
            <button className="btn" onClick={salvarComo}>Salvar como…</button>
          </div>
          {confSair ? <span className="confirma">Isto apaga os dados deste navegador (o arquivo .json salvo não é afetado). <button className="btn sm danger" onClick={sair}>Apagar</button><button className="btn sm" onClick={() => setConfSair(false)}>Cancelar</button></span>
            : <button className="btn danger" style={{ alignSelf: 'start' }} onClick={() => setConfSair(true)}>Fechar projeto e limpar este navegador</button>}
        </div></div>
      </div>

      {novoSem && <NovoSemestre proj={proj} onFechar={() => setNovoSem(false)} onCriar={s => { mudar(p => { p.semestres.push(s); p.semestres.sort((a, b) => a.ano - b.ano || a.periodo - b.periodo) }); setSemId(s.id); setNovoSem(false); avisar(`Semestre ${s.rotulo} criado com ${s.aulas.length} componentes`) }} />}
      {matrizEd && <MatrizModal proj={proj} matriz={matrizEd} onFechar={() => setMatrizEd(null)} avisar={avisar}
        onSalvar={m => { mudar(p => { const i = p.config.matrizes.findIndex(x => x.id === m.id); if (i >= 0) p.config.matrizes[i] = m; else p.config.matrizes.push(m) }); setMatrizEd(null) }}
        onExcluir={id => { mudar(p => { p.config.matrizes = p.config.matrizes.filter(x => x.id !== id) }); setMatrizEd(null) }} />}
    </div>
  )
}

function NovoSemestre({ proj, onFechar, onCriar }: { proj: Projeto; onFechar: () => void; onCriar: (s: Semestre) => void }) {
  const ult = [...proj.semestres].sort((a, b) => b.ano - a.ano || b.periodo - a.periodo)[0]
  const sug = ult ? (ult.periodo === 1 ? `${ult.ano}.2` : `${ult.ano + 1}.1`) : `${new Date().getFullYear()}.1`
  const [rot, setRot] = useState(sug)
  const ap = rotuloParaAnoPeriodo(rot)
  const mesmoPeriodo = proj.semestres.filter(s => ap && s.periodo === ap.periodo && s.ano < ap.ano).sort((a, b) => b.ano - a.ano)
  const [base, setBase] = useState<string>('')
  const existe = ap && proj.semestres.some(s => s.id === `${ap.ano}-${ap.periodo}`)
  const baseEf = base || (mesmoPeriodo[0]?.id ?? 'vazio')
  return (
    <Modal titulo="Novo semestre" onClose={onFechar} largura={560} rodape={<><span /><div style={{ display: 'flex', gap: 8 }}><button className="btn" onClick={onFechar}>Cancelar</button>
      <button className="btn pri" disabled={!ap || !!existe} onClick={() => onCriar(criarSemestre(proj, rot, baseEf === 'vazio' ? null : baseEf))}>Criar</button></div></>}>
      <Campo rotulo="Semestre (ano.período)"><input className="inp" id="ns-rot" value={rot} onChange={e => setRot(e.target.value)} placeholder="2027.2" /></Campo>
      {!ap && <small style={{ color: 'var(--err)' }}>Use o formato 2027.1 ou 2027.2.</small>}
      {existe && <small style={{ color: 'var(--err)' }}>Esse semestre já existe.</small>}
      <Campo rotulo="Ponto de partida">
        <select className="inp" value={baseEf} onChange={e => setBase(e.target.value)}>
          {mesmoPeriodo.map(s => <option key={s.id} value={s.id}>Reaproveitar {s.rotulo} (mesmos componentes, horários e docentes, avançando as turmas)</option>)}
          <option value="vazio">Começar vazio (só as turmas)</option>
        </select>
      </Campo>
      <small className="muted">As turmas são criadas automaticamente para cada habilitação e período. Reaproveitar um semestre de mesmo período (ex.: 2026.2 → 2027.2) leva cada componente para a turma que estará naquele período.</small>
    </Modal>
  )
}

function MatrizModal({ proj, matriz, onSalvar, onExcluir, onFechar, avisar }: { proj: Projeto; matriz: Matriz; onSalvar: (m: Matriz) => void; onExcluir: (id: string) => void; onFechar: () => void; avisar: (m: string) => void }) {
  const [m, setM] = useState(matriz)
  const [conf, setConf] = useState(false)
  const existe = proj.config.matrizes.some(x => x.id === m.id)
  const importar = () => {
    const inp = document.createElement('input')
    inp.type = 'file'; inp.accept = '.csv,.txt'
    inp.onchange = async () => {
      const f = inp.files?.[0]; if (!f) return
      const txt = await lerTexto(f)
      const comps = lerCSVMatriz(txt)
      if (!comps.length) return avisar('Nenhum componente reconhecido. Confira se o arquivo segue o modelo (baixe o modelo para comparar).')
      const linhas = txt.split(/\r?\n/).filter(l => l.trim()).length - 1
      setM({ ...m, componentes: comps })
      avisar(`${comps.length} componentes importados${linhas > comps.length ? ` · ${linhas - comps.length} linha(s) ignorada(s) por falta de código ou nome` : ''}`)
    }
    inp.click()
  }
  const exportar = () => baixar(new Blob(['﻿nivel;codigo;nome;ch;natureza\n' + m.componentes.map(x => [x.nivel, x.codigo, x.nome, x.ch, x.natureza].join(';')).join('\n')], { type: 'text/csv' }), `matriz-${m.id}.csv`)
  return (
    <Modal titulo={existe ? 'Editar matriz' : 'Nova matriz'} onClose={onFechar} largura={860} rodape={<>
      <div>{existe && (conf ? <span className="confirma">Excluir a matriz? <button className="btn sm danger" onClick={() => onExcluir(m.id)}>Excluir</button></span> : <button className="btn danger" onClick={() => setConf(true)}>Excluir</button>)}</div>
      <div style={{ display: 'flex', gap: 8 }}><button className="btn" onClick={onFechar}>Cancelar</button><button className="btn pri" disabled={!m.nome.trim()} onClick={() => onSalvar(m)}>Salvar</button></div>
    </>}>
      <div className="linha">
        <Campo rotulo="Nome"><input className="inp" id="mz-nome" value={m.nome} onChange={e => setM({ ...m, nome: e.target.value })} placeholder="Licenciatura – currículo 2025" /></Campo>
        <Campo rotulo="Habilitação" style={{ flex: '0 0 170px' }}><select className="inp" value={m.habilitacao} onChange={e => setM({ ...m, habilitacao: e.target.value })}>{proj.config.habilitacoes.map(h => <option key={h.id} value={h.id}>{h.nome}</option>)}</select></Campo>
      </div>
      <div className="linha">
        <Campo rotulo="Vale para turmas com ingresso de" style={{ flex: '0 0 200px' }}><input className="inp num" type="number" value={m.ingressoDe} onChange={e => setM({ ...m, ingressoDe: +e.target.value })} /></Campo>
        <Campo rotulo="até (9999 = em diante)" style={{ flex: '0 0 200px' }}><input className="inp num" type="number" value={m.ingressoAte} onChange={e => setM({ ...m, ingressoAte: +e.target.value })} /></Campo>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><button className="btn" onClick={importar}>Importar .csv</button><button className="btn ghost" onClick={baixarModelo}>Baixar modelo</button>{m.componentes.length > 0 && <button className="btn ghost" onClick={exportar}>Exportar .csv</button>}</div>
      </div>
      <details style={{ fontSize: 13 }}>
        <summary className="muted" style={{ cursor: 'pointer' }}>Como montar o arquivo .csv</summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          <span className="muted">Uma linha por componente, com estas 5 colunas, nesta ordem, separadas por ponto e vírgula. Pode montar no Excel e salvar como “CSV (separado por vírgulas)”.</span>
          <div className="scroll-x"><table className="tab" style={{ fontSize: 13 }}>
            <thead><tr><th>Coluna</th><th>O que vai nela</th><th>Exemplo</th></tr></thead>
            <tbody>
              <tr><td className="mono">nivel</td><td>Semestre/nível na matriz. Use 0 para optativas sem nível.</td><td className="mono">1</td></tr>
              <tr><td className="mono">codigo</td><td>Código do componente no Sigaa.</td><td className="mono">DCBS0309</td></tr>
              <tr><td className="mono">nome</td><td>Nome do componente.</td><td className="mono">Biologia Celular</td></tr>
              <tr><td className="mono">ch</td><td>Carga horária total, só o número (60 ou 60h).</td><td className="mono">60</td></tr>
              <tr><td className="mono">natureza</td><td>obrigatoria ou optativa.</td><td className="mono">obrigatoria</td></tr>
            </tbody>
          </table></div>
          <span className="muted">A primeira linha (cabeçalho) é opcional. Também aceita vírgula ou tabulação como separador e arquivos salvos pelo Excel com acentos. Importar substitui os componentes desta matriz.</span>
        </div>
      </details>
      <div className="scroll-x" style={{ maxHeight: 380, border: '1px solid var(--line)', borderRadius: 6 }}>
        <table className="tab">
          <thead><tr><th>Nível</th><th>Código</th><th>Nome</th><th className="r">CH</th><th>Natureza</th><th></th></tr></thead>
          <tbody>{m.componentes.map((x, i) => (
            <tr key={i}>
              <td><input className="inp num" style={{ width: 56 }} type="number" aria-label="Nível" value={x.nivel} onChange={e => { const l = [...m.componentes]; l[i] = { ...x, nivel: +e.target.value }; setM({ ...m, componentes: l }) }} /></td>
              <td><input className="inp mono" style={{ width: 100 }} aria-label="Código" value={x.codigo} onChange={e => { const l = [...m.componentes]; l[i] = { ...x, codigo: e.target.value.toUpperCase() }; setM({ ...m, componentes: l }) }} /></td>
              <td><input className="inp" aria-label="Nome" value={x.nome} onChange={e => { const l = [...m.componentes]; l[i] = { ...x, nome: e.target.value }; setM({ ...m, componentes: l }) }} /></td>
              <td className="r"><input className="inp num" style={{ width: 64 }} type="number" aria-label="CH" value={x.ch} onChange={e => { const l = [...m.componentes]; l[i] = { ...x, ch: +e.target.value }; setM({ ...m, componentes: l }) }} /></td>
              <td><select className="inp" aria-label="Natureza" value={x.natureza} onChange={e => { const l = [...m.componentes]; l[i] = { ...x, natureza: e.target.value as ComponenteMatriz['natureza'] }; setM({ ...m, componentes: l }) }}><option value="obrigatoria">Obrigatória</option><option value="optativa">Optativa</option></select></td>
              <td><button className="btn ghost sm" aria-label="Remover" onClick={() => setM({ ...m, componentes: m.componentes.filter((_, j) => j !== i) })}>✕</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <button className="btn sm" style={{ alignSelf: 'start' }} onClick={() => setM({ ...m, componentes: [...m.componentes, { nivel: 1, codigo: '', nome: '', ch: 60, natureza: 'obrigatoria' }] })}>+ Componente</button>
    </Modal>
  )
}
