import type { Aula, Config, Docente, Matriz, Problema, Projeto, Semestre, Turma, ComponenteMatriz } from './types'

export const uid = (p = 'x') => p + Math.random().toString(36).slice(2, 9)

export function norm(s: string) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export const periodoDaTurma = (s: Semestre, t: Turma) => (s.ano - t.ingresso) * 2 + s.periodo

export function matrizDaTurma(c: Config, t: Turma): Matriz | undefined {
  return c.matrizes.find(m => m.habilitacao === t.habilitacao && m.ingressoDe <= t.ingresso && t.ingresso <= m.ingressoAte)
}

export function habil(c: Config, id: string) {
  return c.habilitacoes.find(h => h.id === id) ?? { id, nome: id, abrev: id }
}

export function rotuloTurma(c: Config, s: Semestre, t: Turma, curto = false) {
  const h = habil(c, t.habilitacao)
  const p = periodoDaTurma(s, t)
  return curto ? `T${t.ingresso} ${h.abrev}` : `Turma ${t.ingresso} · ${h.nome} · ${p}º sem.`
}

export function turmaCurta(c: Config, id: string) {
  const [ing, hab] = id.split('-')
  return `T${ing} ${habil(c, hab).abrev}`
}

export function nomeDocente(d?: Docente) {
  if (!d) return 'A definir'
  return `${d.tratamento} ${d.curto}`.trim()
}

export function todosSlots(c: Config) {
  return c.turnos.flatMap(t => t.slots.map(s => ({ ...s, turno: t.id })))
}

export function rotuloCelula(c: Config, cel: string) {
  const [d, sl] = cel.split('-')
  const s = todosSlots(c).find(x => x.id === sl)
  const dia = c.dias[+d] ?? d
  return `${dia.replace(' feira', '')} ${s ? s.inicio : sl}`
}

/** Resume horários em blocos legíveis: "2ª 07:30–11:10; 4ª 13:30–15:10" */
export function resumoHorarios(c: Config, horarios: string[]) {
  const slots = todosSlots(c)
  const idx = (id: string) => slots.findIndex(s => s.id === id)
  const porDia = new Map<number, number[]>()
  for (const h of horarios) {
    const [d, sl] = h.split('-')
    const i = idx(sl)
    if (i < 0) continue
    porDia.set(+d, [...(porDia.get(+d) ?? []), i])
  }
  const partes: string[] = []
  ;[...porDia.keys()].sort().forEach(d => {
    const is = porDia.get(d)!.sort((a, b) => a - b)
    let ini = is[0], ant = is[0]
    const blocos: string[] = []
    for (let k = 1; k <= is.length; k++) {
      const cur = is[k]
      if (cur === ant + 1 && slots[cur]?.turno === slots[ant]?.turno) { ant = cur; continue }
      blocos.push(`${slots[ini].inicio}–${slots[ant].fim}`)
      ini = ant = cur
    }
    partes.push(`${(c.dias[d] ?? '').replace(' feira', '')} ${blocos.join(', ')}`)
  })
  return partes.join(' · ')
}

export const aulasEsperadas = (c: Config, a: Aula) => Math.round((a.ch / (c.chPorAulaSemanal || 15)) * 10) / 10

export function chAlocada(s: Semestre, docenteId: string) {
  return s.aulas.reduce((acc, a) => acc + a.alocacao.filter(x => x.docente === docenteId).reduce((x, y) => x + (+y.ch || 0), 0), 0)
}

export function buscarNaMatriz(c: Config, t: Turma | undefined, codigo: string): ComponenteMatriz | undefined {
  const m = t ? matrizDaTurma(c, t) : undefined
  return m?.componentes.find(x => x.codigo === codigo)
}

export function buscarEmTodas(c: Config, codigo: string) {
  for (const m of c.matrizes) {
    const x = m.componentes.find(k => k.codigo === codigo)
    if (x) return { matriz: m, comp: x }
  }
  return undefined
}

// ---------------- validação ----------------
export function validar(p: Projeto, s: Semestre): Problema[] {
  const c = p.config
  const probs: Problema[] = []
  const doc = new Map(p.docentes.map(d => [d.id, d]))
  const nomeA = (a: Aula) => `${a.codigo} ${a.nome}`.trim()
  const turmaIds = new Set(s.turmas.map(t => t.id))

  // conflitos de docente
  const porDocente = new Map<string, Map<string, Aula[]>>()
  for (const a of s.aulas) {
    if (a.moduloLivre) continue
    for (const al of a.alocacao) {
      const m = porDocente.get(al.docente) ?? new Map<string, Aula[]>()
      for (const h of a.horarios) m.set(h, [...(m.get(h) ?? []), a])
      porDocente.set(al.docente, m)
    }
  }
  for (const [did, m] of porDocente) {
    const grupos = new Map<string, { aulas: Aula[]; cels: string[] }>()
    for (const [cel, as] of m) {
      if (as.length < 2) continue
      const k = as.map(a => a.id).sort().join('+')
      const g = grupos.get(k) ?? { aulas: as, cels: [] }
      g.cels.push(cel)
      grupos.set(k, g)
    }
    for (const [k, g] of grupos) {
      probs.push({
        id: `conf-doc:${did}:${k}`, nivel: 'erro', tipo: 'Choque de horário do docente',
        texto: `${nomeDocente(doc.get(did))} está em ${g.aulas.length} componentes ao mesmo tempo`,
        detalhe: `${g.aulas.map(nomeA).join(' × ')} — ${g.cels.map(x => rotuloCelula(c, x)).join(', ')}`,
        aulaIds: g.aulas.map(a => a.id), docenteId: did, celulas: g.cels, turmaId: g.aulas[0].turmas[0],
      })
    }
  }

  // conflitos na turma
  for (const t of s.turmas) {
    const m = new Map<string, Aula[]>()
    for (const a of s.aulas) {
      if (a.moduloLivre || !a.turmas.includes(t.id)) continue
      for (const h of a.horarios) m.set(h, [...(m.get(h) ?? []), a])
    }
    const grupos = new Map<string, { aulas: Aula[]; cels: string[] }>()
    for (const [cel, as] of m) {
      if (as.length < 2) continue
      if (as.filter(a => !a.optativa).length < 2) continue
      const k = as.map(a => a.id).sort().join('+')
      const g = grupos.get(k) ?? { aulas: as, cels: [] }
      g.cels.push(cel)
      grupos.set(k, g)
    }
    for (const [k, g] of grupos) {
      probs.push({
        id: `conf-turma:${t.id}:${k}`, nivel: 'erro', tipo: 'Choque de horário na turma',
        texto: `${rotuloTurma(c, s, t, true)}: ${g.aulas.length} componentes no mesmo horário`,
        detalhe: `${g.aulas.map(nomeA).join(' × ')} — ${g.cels.map(x => rotuloCelula(c, x)).join(', ')}`,
        aulaIds: g.aulas.map(a => a.id), turmaId: t.id, celulas: g.cels,
      })
    }
  }

  for (const a of s.aulas) {
    const t0 = a.turmas[0]
    // carga semanal
    if (!a.moduloLivre && a.ch > 0) {
      const esp = aulasEsperadas(c, a)
      if (a.horarios.length === 0) {
        probs.push({ id: `sem-horario:${a.id}`, nivel: 'aviso', tipo: 'Sem horário', texto: `${nomeA(a)} ainda não tem horário`, aulaIds: [a.id], turmaId: t0 })
      } else if (Math.abs(a.horarios.length - esp) > 0.01) {
        probs.push({
          id: `carga:${a.id}:${a.horarios.length}`, nivel: 'aviso', tipo: 'Aulas por semana ≠ CH',
          texto: `${nomeA(a)}: ${a.horarios.length} aulas/semana para ${a.ch}h (esperado ${esp})`,
          aulaIds: [a.id], turmaId: t0,
        })
      }
    }
    // sem docente
    if (a.alocacao.length === 0) {
      probs.push({
        id: `sem-docente:${a.id}`, nivel: 'aviso', tipo: 'Docente a definir',
        texto: `${nomeA(a)} (${a.turmas.map(x => turmaCurta(c, x)).join(' + ')})`,
        detalhe: a.externo ? `Docente externo${a.colegiado ? ' · ' + a.colegiado : ' · colegiado não informado'}` : undefined,
        aulaIds: [a.id], turmaId: t0,
      })
    }
    // regra do Departamento/Sigaa: CH do docente não pode passar a CH do componente
    for (const al of a.alocacao) {
      if ((+al.ch || 0) > a.ch) {
        const d = doc.get(al.docente)
        probs.push({ id: `ch-maior:${a.id}:${al.docente}:${al.ch}`, nivel: 'erro', tipo: 'CH do docente maior que a do componente',
          texto: `${nomeDocente(d)}: ${al.ch}h em ${nomeA(a)}, que tem ${a.ch}h`, detalhe: 'O Sigaa não aceita vincular ao docente mais horas do que a CH do componente', aulaIds: [a.id], turmaId: t0, docenteId: al.docente })
      }
    }
    // docente indisponível
    for (const al of a.alocacao) {
      const d = doc.get(al.docente)
      if (!d) {
        probs.push({ id: `doc-inexistente:${a.id}:${al.docente}`, nivel: 'erro', tipo: 'Docente não cadastrado', texto: `${nomeA(a)} aponta para um docente que não está no cadastro (${al.docente})`, aulaIds: [a.id], turmaId: t0 })
      } else if (d.situacao !== 'ativo') {
        probs.push({
          id: `indisp:${a.id}:${d.id}`, nivel: 'erro', tipo: 'Docente afastado ou dispensado',
          texto: `${nomeDocente(d)} (${d.situacao}) está alocado em ${nomeA(a)}`, detalhe: d.obs || undefined,
          aulaIds: [a.id], docenteId: d.id, turmaId: t0,
        })
      }
    }
    // matriz
    for (const tid of a.turmas) {
      const t = s.turmas.find(x => x.id === tid)
      if (!t) {
        if (!turmaIds.has(tid)) probs.push({ id: `turma-inexistente:${a.id}:${tid}`, nivel: 'erro', tipo: 'Turma inexistente', texto: `${nomeA(a)} aponta para a turma ${tid}, que não está neste semestre`, aulaIds: [a.id] })
        continue
      }
      const m = matrizDaTurma(c, t)
      if (!m || !a.codigo) continue
      if (!m.componentes.some(x => x.codigo === a.codigo)) {
        const outra = buscarEmTodas(c, a.codigo)
        probs.push({
          id: `fora-matriz:${a.id}:${tid}`, nivel: 'info', tipo: 'Código fora da matriz da turma',
          texto: `${nomeA(a)} não consta em ${m.nome} (${rotuloTurma(c, s, t, true)})`,
          detalhe: outra ? `O código existe em ${outra.matriz.nome}` : 'Código não encontrado em nenhuma matriz cadastrada — confira se há erro de digitação',
          aulaIds: [a.id], turmaId: tid,
        })
      }
    }
  }

  // CH docente
  for (const d of p.docentes) {
    const prev = s.chPrevista?.[d.id]
    const aloc = chAlocada(s, d.id) + (s.chPos?.[d.id] ?? 0)
    const min = minimoEnsino(c)
    if (d.vinculo === 'curso' && d.situacao === 'ativo' && !s.reducaoPaid?.[d.id] && aloc < min) {
      probs.push({
        id: `minimo:${d.id}:${aloc}`, nivel: 'aviso', tipo: `CH de ensino abaixo do mínimo (${min}h)`,
        texto: `${nomeDocente(d)}: ${aloc}h de ensino no semestre (graduação + pós) — faltam ${min - aloc}h`,
        detalhe: 'Informe a CH na pós-graduação na aba Docentes, ou marque a redução da Res. PAID art. 50 §1, se o docente tiver', docenteId: d.id,
      })
    }
    if (prev && prev > 0 && prev !== aloc) {
      probs.push({
        id: `ch:${d.id}:${prev}:${aloc}`, nivel: 'aviso', tipo: 'CH do docente diverge da prevista',
        texto: `${nomeDocente(d)}: ${aloc}h alocadas, ${prev}h previstas (${aloc > prev ? '+' : ''}${aloc - prev}h)`, docenteId: d.id,
      })
    }
  }

  // função registrada para docente sem componente (ex.: função copiada de outro semestre)
  for (const d of p.docentes) {
    const f = s.funcoes?.[d.id]
    if (f && d.situacao === 'ativo' && chAlocada(s, d.id) === 0) {
      probs.push({ id: `funcao-sem-comp:${d.id}:${f}`, nivel: 'info', tipo: 'Função sem componente', texto: `${nomeDocente(d)} tem função “${f}” mas nenhum componente em ${s.rotulo}`, detalhe: 'Pode ter sido copiada de outro semestre — confira na aba Docentes', docenteId: d.id })
    }
  }

  // obrigatórias do nível não ofertadas
  for (const t of s.turmas) {
    const m = matrizDaTurma(c, t)
    if (!m) continue
    const per = periodoDaTurma(s, t)
    const ofertados = new Set(s.aulas.filter(a => a.turmas.includes(t.id)).map(a => a.codigo))
    for (const comp of m.componentes) {
      if (comp.nivel !== per || comp.natureza !== 'obrigatoria') continue
      if (ofertados.has(comp.codigo)) continue
      probs.push({
        id: `nao-ofertado:${t.id}:${comp.codigo}`, nivel: 'aviso', tipo: 'Obrigatória do período não ofertada',
        texto: `${comp.codigo} ${comp.nome} (${comp.ch}h) — ${rotuloTurma(c, s, t, true)}, ${per}º período`, turmaId: t.id,
      })
    }
  }

  const ign = new Set(s.ignorados ?? [])
  return probs.filter(x => !ign.has(x.id))
}

// ---------------- diferença entre versões ----------------
export function diferencas(p: Projeto, antes: { aulas: Aula[] }, depois: { aulas: Aula[] }) {
  const c = p.config
  const doc = new Map(p.docentes.map(d => [d.id, d]))
  const docs = (a: Aula) => a.alocacao.map(x => nomeDocente(doc.get(x.docente))).join(', ') || 'A definir'
  const A = new Map(antes.aulas.map(a => [a.id, a]))
  const B = new Map(depois.aulas.map(a => [a.id, a]))
  const out: { tipo: 'incluido' | 'removido' | 'alterado'; aula: string; mudancas: string[] }[] = []
  for (const [id, b] of B) {
    const a = A.get(id)
    const nome = `${b.codigo} ${b.nome} (${b.turmas.map(x => turmaCurta(c, x)).join(' + ')})`
    if (!a) { out.push({ tipo: 'incluido', aula: nome, mudancas: [resumoHorarios(c, b.horarios) || 'sem horário', docs(b)] }); continue }
    const m: string[] = []
    const hA = [...a.horarios].sort().join(), hB = [...b.horarios].sort().join()
    if (hA !== hB) m.push(`Horário: ${resumoHorarios(c, a.horarios) || '—'} → ${resumoHorarios(c, b.horarios) || '—'}`)
    if (docs(a) !== docs(b)) m.push(`Docente: ${docs(a)} → ${docs(b)}`)
    if (a.ch !== b.ch) m.push(`CH: ${a.ch}h → ${b.ch}h`)
    if (a.nome !== b.nome || a.codigo !== b.codigo) m.push(`Componente: ${a.codigo} ${a.nome} → ${b.codigo} ${b.nome}`)
    if ([...a.turmas].sort().join() !== [...b.turmas].sort().join()) m.push(`Turmas: ${a.turmas.map(x => turmaCurta(c, x)).join(' + ')} → ${b.turmas.map(x => turmaCurta(c, x)).join(' + ')}`)
    if (m.length) out.push({ tipo: 'alterado', aula: nome, mudancas: m })
  }
  for (const [id, a] of A) if (!B.has(id)) out.push({ tipo: 'removido', aula: `${a.codigo} ${a.nome} (${a.turmas.map(x => turmaCurta(c, x)).join(' + ')})`, mudancas: [] })
  return out
}

// ---------------- novo semestre ----------------
export function rotuloParaAnoPeriodo(rotulo: string) {
  const m = rotulo.trim().match(/^(\d{4})[.\-/ ]?([12])$/)
  if (!m) return null
  return { ano: +m[1], periodo: +m[2] }
}

export function criarSemestre(p: Projeto, rotulo: string, baseId: string | null): Semestre {
  const ap = rotuloParaAnoPeriodo(rotulo)!
  const c = p.config
  const id = `${ap.ano}-${ap.periodo}`
  const turmas: Turma[] = []
  for (const h of c.habilitacoes) {
    for (let nivel = ap.periodo; nivel <= c.niveis; nivel += 2) {
      const ingresso = ap.ano - (nivel - ap.periodo) / 2
      turmas.push({ id: `${ingresso}-${h.id}`, ingresso, habilitacao: h.id, nota: '' })
    }
  }
  turmas.sort((a, b) => b.ingresso - a.ingresso || a.habilitacao.localeCompare(b.habilitacao))
  const novo: Semestre = {
    id, rotulo: `${ap.ano}.${ap.periodo}`, ano: ap.ano, periodo: ap.periodo, status: 'Em elaboração',
    turmas, aulas: [], chPrevista: {}, funcoes: {}, pendencias: [], ignorados: [], versoes: [], atualizadoEm: new Date().toISOString(),
  }
  const base = p.semestres.find(s => s.id === baseId)
  if (base) {
    novo.funcoes = { ...base.funcoes }
    if (base.periodo === ap.periodo) {
      const delta = ap.ano - base.ano
      const ids = new Set(turmas.map(t => t.id))
      for (const t of base.turmas) {
        const nid = `${t.ingresso + delta}-${t.habilitacao}`
        const nt = turmas.find(x => x.id === nid)
        if (nt) nt.nota = t.nota
      }
      for (const a of base.aulas) {
        const nts = a.turmas.map(x => { const [ing, h] = x.split('-'); return `${+ing + delta}-${h}` }).filter(x => ids.has(x))
        if (!nts.length) continue
        novo.aulas.push({ ...structuredClone(a), id: uid('a'), turmas: nts })
      }
      novo.chPrevista = {}
    }
  }
  return novo
}

export function corDocente(id: string) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360
  return (h * 137) % 360
}

// ---------------- distribuição de CH (mesma regra para o app e o Word) ----------------
export type StatusCH = 'confere' | 'diverge' | 'sem-prevista' | 'funcao-sem-componente' | 'indisponivel'
export const minimoEnsino = (c: Config) => c.chMinimaEnsino ?? 120
export interface LinhaCH {
  docente: Docente
  itens: { aula: Aula; ch: number }[]
  graduacao: number
  pos: number
  total: number // graduação + pós
  semanais: number // h/a por semana
  abaixoMinimo: boolean
  reducao: boolean
  prevista: number
  funcao: string
  status: StatusCH
}
export function distribuicaoCH(p: Projeto, s: Semestre) {
  const linhas: LinhaCH[] = p.docentes.filter(d => d.vinculo === 'curso').map(d => {
    const itens = s.aulas.filter(a => a.alocacao.some(x => x.docente === d.id))
      .map(a => ({ aula: a, ch: a.alocacao.filter(x => x.docente === d.id).reduce((t, x) => t + (+x.ch || 0), 0) }))
      .sort((a, b) => a.aula.codigo.localeCompare(b.aula.codigo))
    const graduacao = itens.reduce((t, i) => t + i.ch, 0)
    const pos = s.chPos?.[d.id] ?? 0
    const total = graduacao + pos
    const semanais = Math.round((total / (p.config.chPorAulaSemanal || 15)) * 10) / 10
    const prevista = s.chPrevista?.[d.id] ?? 0
    const funcao = s.funcoes?.[d.id] ?? ''
    const reducao = !!s.reducaoPaid?.[d.id]
    const abaixoMinimo = d.situacao === 'ativo' && !reducao && total < minimoEnsino(p.config)
    let status: StatusCH = prevista > 0 ? (prevista === total ? 'confere' : 'diverge') : 'sem-prevista'
    if (d.situacao !== 'ativo') status = 'indisponivel'
    else if (!itens.length && funcao) status = 'funcao-sem-componente'
    return { docente: d, itens, graduacao, pos, total, semanais, abaixoMinimo, reducao, prevista, funcao, status }
  }).sort((a, b) => a.docente.nome.localeCompare(b.docente.nome))
  const comAulas = linhas.filter(l => l.docente.situacao === 'ativo' && (l.itens.length || l.pos > 0))
  const semAlocacao = linhas.filter(l => l.docente.situacao === 'ativo' && !l.itens.length && !l.pos)
  const indisponiveis = linhas.filter(l => l.docente.situacao !== 'ativo')
  const total = comAulas.reduce((t, l) => t + l.total, 0)
  return {
    comAulas, semAlocacao, indisponiveis, total,
    confere: comAulas.filter(l => l.status === 'confere').length,
    diverge: comAulas.filter(l => l.status === 'diverge').length,
    semPrevista: comAulas.filter(l => l.status === 'sem-prevista').length,
    abaixoMinimo: linhas.filter(l => l.abaixoMinimo).length,
    totalGrad: comAulas.reduce((t, l) => t + l.graduacao, 0),
    totalPos: comAulas.reduce((t, l) => t + l.pos, 0),
  }
}
export function rotuloStatus(l: LinhaCH) {
  const dif = l.total - l.prevista
  switch (l.status) {
    case 'confere': return 'Confere'
    case 'diverge': return `${dif > 0 ? '+' : ''}${dif}h`
    case 'sem-prevista': return 'Prevista em branco'
    case 'funcao-sem-componente': return 'Função sem componente'
    case 'indisponivel': return l.itens.length ? 'Alocado, mas indisponível' : l.docente.situacao === 'afastado' ? 'Afastado' : 'Dispensado'
  }
}

// ---------------- módulo livre ----------------
const RE_MODULO_LIVRE = /(est[aá]gio|pr[aá]tica de ensino|atividade (acad[eê]mica|curricular) de extens|trabalho de conclus|\btcc\b|atividades complementares|\bacc\b)/i
export const sugereModuloLivre = (nome: string) => RE_MODULO_LIVRE.test(nome || '')

/** Ajustes em projetos salvos por versões anteriores do app */
export function migrar(p: Projeto): Projeto {
  if (!p.config.quadroDepartamento && /amap/i.test(p.config.instituicao)) {
    p.config.quadroDepartamento = {
      cabecalho: 'MINISTÉRIO DA EDUCAÇÃO\nFUNDAÇÃO UNIVERSIDADE FEDERAL DO AMAPÁ\nPRÓ-REITORIA DE ENSINO DE GRADUAÇÃO\nDEPARTAMENTO DE CIÊNCIAS BIOLÓGICAS E DA SAÚDE\nCOMISSÃO TÉCNICA PEDAGÓGICA DO DCBS',
      orientacoes: ORIENTACOES_DCBS,
    }
  }
  if (p.config.unidade === undefined && /amap/i.test(p.config.instituicao) && /biol/i.test(p.config.curso)) p.config.unidade = 'Departamento de Ciências Biológicas e da Saúde'
  for (const s of p.semestres) {
    if (!s.reducaoPaid) {
      // antes, a função registrada dispensava o mínimo; parte-se dela e o usuário corrige
      s.reducaoPaid = Object.fromEntries(Object.entries(s.funcoes ?? {}).filter(([, v]) => v && v.trim()).map(([k]) => [k, true]))
    }
  }
  return p
}

// ---------------- cores das turmas ----------------
// pares (forte, clara): texto branco sobre a forte tem contraste ≥ 4,5:1
export const PALETA_TURMAS: [string, string][] = [
  ['#1E7F4C', '#D6F2E1'], ['#1F5FA8', '#DCE8F7'], ['#6B3FA0', '#EAE0F5'], ['#A0480F', '#FBE5D3'],
  ['#0F6E78', '#D4EEF0'], ['#B42339', '#F8DCE1'], ['#5E6B12', '#ECF0D2'], ['#3E4C63', '#E2E6EE'],
]
function clarear(hex: string, f = 0.84) {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const mix = (v: number) => Math.round(v + (255 - v) * f).toString(16).padStart(2, '0')
  return `#${mix(r)}${mix(g)}${mix(b)}`.toUpperCase()
}
/** Cor da turma: a escolhida pelo usuário ou uma da paleta, estável pelo ano de ingresso */
export function corTurma(_c: Config, t: Turma): { forte: string; clara: string } {
  if (t.cor) {
    const par = PALETA_TURMAS.find(x => x[0].toLowerCase() === t.cor!.toLowerCase())
    return { forte: t.cor, clara: par ? par[1] : clarear(t.cor) }
  }
  // uma cor por ano de ingresso: Lic. e Bach. da mesma entrada ficam iguais e a cor acompanha a turma nos semestres
  const [forte, clara] = PALETA_TURMAS[((t.ingresso % PALETA_TURMAS.length) + PALETA_TURMAS.length) % PALETA_TURMAS.length]
  return { forte, clara }
}

// ---------------- docentes de outros colegiados (memorando e Word usam a mesma regra) ----------------
export function componentesDeOutrosColegiados(p: Projeto, s: Semestre) {
  const ext = new Set(p.docentes.filter(d => d.vinculo === 'externo').map(d => d.id))
  return s.aulas.filter(a => a.externo || a.alocacao.some(x => ext.has(x.docente)))
}
/** Sem docente e sem marcação de outro colegiado: precisam de docente do próprio curso (não vão no memorando) */
export function semDocenteInterno(p: Projeto, s: Semestre) {
  const fora = new Set(componentesDeOutrosColegiados(p, s).map(a => a.id))
  return s.aulas.filter(a => a.alocacao.length === 0 && !fora.has(a.id))
}

// ---------------- quadro de ofertas para o Departamento ----------------
/** Código de horário no padrão SIGAA por dia: { 1: 'M1234', 3: 'T12 N12' } (índice do dia como em config.dias) */
export function horarioSigaaPorDia(c: Config, a: Aula): Record<number, string> {
  const porDia: Record<number, string[]> = {}
  for (const tn of c.turnos) {
    for (let d = 0; d < c.dias.length; d++) {
      const nums = tn.slots.map((sl, i) => (a.horarios.includes(`${d}-${sl.id}`) ? String(i + 1) : '')).filter(Boolean)
      if (nums.length) (porDia[d] ??= []).push(tn.id + nums.join(''))
    }
  }
  return Object.fromEntries(Object.entries(porDia).map(([d, v]) => [d, v.join(' ')]))
}
/** Em qual habilitação o componente entra no quadro: a da 1ª turma cuja matriz tem o código; senão, a da 1ª turma */
export function habilitacaoDoComponente(c: Config, s: Semestre, a: Aula) {
  const ts = a.turmas.map(id => s.turmas.find(t => t.id === id)).filter(Boolean) as Turma[]
  const comMatriz = ts.find(t => matrizDaTurma(c, t)?.componentes.some(k => k.codigo === a.codigo))
  return (comMatriz ?? ts[0])?.habilitacao ?? a.turmas[0]?.split('-')[1]
}
export const ORIENTACOES_DCBS = [
  'Exemplificamos que o Horário 5T2345, significa: 5 (quinta-feira), T (Tarde) 2,3,4,5 (2º ao 5º horário) e 5N23: 5 (quinta-feira) N (Noite) 2,3 (2º ao 3º horário).',
  'Exemplificamos que o Horário 3M123456, significa: 3 (terça-feira), M (Manhã) 1,2,3,4,5,6 (1º ao 6º horário) e 6N23: 6 (sexta-feira), N (Noite) 2,3 (2º ao 3º horário).',
  'A carga horária do professor não pode ser maior que a carga horária do componente curricular cadastrado no Sigaa.',
  'A vinculação da carga horária total do componente curricular para mais de um/a docente deve ocorrer quando há um trabalho concomitante naquele componente curricular.',
  'Informar somente os códigos, nomes dos componentes curriculares que possam ser localizados na matriz curricular cadastrada no Sigaa, a fim de evitar divergências na homologação da oferta do curso.',
  'Após a homologação da oferta dos componentes curriculares, a comissão pedagógica do DCBS fará a retirada do sistema o quadro dos componentes curriculares homologados e encaminhará à coordenação de curso para a conferência dos dados como: horários, nome dos docentes, carga horária docente, dentro do período hábil para ajustes.',
  'Caso a comissão pedagógica do DCBS não consiga realizar a homologação e/ou a vinculação dos docentes, por conta de divergências de horários/nomes de disciplinas, cargas horárias no Sigaa, iremos informar para que a Coordenação do curso, após confirmação dos dados, solicite diretamente a DICA/DERCA, se for período após a homologação das ofertas.',
  'Atenção: observar cuidadosamente o cadastro dos horários dos componentes curriculares para evitar erros e consequentemente possíveis choques de horários.',
].join('\n')
