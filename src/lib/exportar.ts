import {
  AlignmentType, Header, BorderStyle, Document, Packer, PageOrientation, Paragraph, ShadingType, Table, TableCell, TableRow,
  TextRun, VerticalAlign, VerticalMergeType, WidthType,
} from 'docx'
import type { Aula, Projeto, Semestre } from './types'
import { chAlocada, componentesDeOutrosColegiados, corTurma, distribuicaoCH, habilitacaoDoComponente, horarioSigaaPorDia, norm, minimoEnsino, habil, nomeDocente, periodoDaTurma, resumoHorarios, rotuloStatus, turmaCurta, type StatusCH } from './model'

const FONT = 'Arial'
const t = (text: string, o: { bold?: boolean; size?: number; color?: string; italics?: boolean } = {}) =>
  new TextRun({ text, font: FONT, size: o.size ?? 16, bold: o.bold, color: o.color, italics: o.italics })
const p = (runs: TextRun[] | string, o: { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; after?: number; before?: number } = {}) =>
  new Paragraph({ children: typeof runs === 'string' ? [t(runs)] : runs, alignment: o.align, spacing: { after: o.after ?? 0, before: o.before ?? 0 } })
const borda = { style: BorderStyle.SINGLE, size: 4, color: '808080' }
const bordas = { top: borda, bottom: borda, left: borda, right: borda }

function cel(children: Paragraph[], o: { span?: number; fill?: string; vmerge?: (typeof VerticalMergeType)[keyof typeof VerticalMergeType]; width?: number } = {}) {
  return new TableCell({
    children, columnSpan: o.span, verticalMerge: o.vmerge, borders: bordas, verticalAlign: VerticalAlign.CENTER,
    shading: o.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: o.fill } : undefined,
    width: o.width ? { size: o.width, type: WidthType.PERCENTAGE } : undefined,
    margins: { top: 30, bottom: 30, left: 60, right: 60 },
  })
}

export function textoAula(proj: Projeto, a: Aula) {
  const docs = a.alocacao.map(x => nomeDocente(proj.docentes.find(d => d.id === x.docente))).join(' + ')
  return `${a.codigo} ${a.nome.toUpperCase()} ${a.ch}h – ${docs || 'A definir'}`
}

function gradeTurma(proj: Projeto, s: Semestre, turmaId: string): Table | null {
  const c = proj.config
  const turma = s.turmas.find(x => x.id === turmaId)!
  const aulas = s.aulas.filter(a => a.turmas.includes(turmaId) && !a.moduloLivre)
  if (!aulas.length) return null
  const usados = c.turnos.filter(tn => aulas.some(a => a.horarios.some(h => tn.slots.some(sl => h.endsWith('-' + sl.id)))))
  const h = habil(c, turma.habilitacao)
  const cr = corTurma(c, turma)
  const cor = { forte: cr.forte.replace('#', ''), clara: cr.clara.replace('#', '') }
  const titulo = `${c.curso.toUpperCase()}   TURMA ${turma.ingresso} ${h.nome.toUpperCase()}   ${periodoDaTurma(s, turma)}º SEM. ${s.rotulo}`
  const rows: TableRow[] = [
    new TableRow({ children: [cel([p([t(titulo, { bold: true, size: 20 })], { align: AlignmentType.CENTER })], { span: c.dias.length + 1, fill: cor.clara })] }),
    new TableRow({ tableHeader: true, children: [cel([p([t('HORÁRIO', { bold: true, color: 'FFFFFF' })], { align: AlignmentType.CENTER })], { fill: cor.forte, width: 9 }),
      ...c.dias.map(d => cel([p([t(d.toUpperCase(), { bold: true, color: 'FFFFFF' })], { align: AlignmentType.CENTER })], { fill: cor.forte, width: 91 / c.dias.length }))] }),
  ]
  for (const tn of usados) {
    if (usados.length > 1 || tn.id === 'N') rows.push(new TableRow({ children: [cel([p([t(`TURNO DA ${tn.nome.toUpperCase()}`, { bold: true, size: 14 })], { align: AlignmentType.CENTER })], { span: c.dias.length + 1, fill: cor.clara })] }))
    const grade = tn.slots.map(sl => c.dias.map((_, d) => aulas.filter(a => a.horarios.includes(`${d}-${sl.id}`))))
    tn.slots.forEach((sl, i) => {
      rows.push(new TableRow({ children: [
        cel([p([t(sl.inicio, { bold: true })], { align: AlignmentType.CENTER }), p([t(sl.fim, { bold: true })], { align: AlignmentType.CENTER })], { fill: cor.clara }),
        ...c.dias.map((_, d) => {
          const as = grade[i][d]
          const key = as.map(a => a.id).join('+')
          const prev = i > 0 ? grade[i - 1][d].map(a => a.id).join('+') : null
          const next = i < tn.slots.length - 1 ? grade[i + 1][d].map(a => a.id).join('+') : null
          const vmerge = key && key === prev ? VerticalMergeType.CONTINUE : key && key === next ? VerticalMergeType.RESTART : undefined
          if (vmerge === VerticalMergeType.CONTINUE) return cel([p('')], { vmerge })
          return cel(as.length ? as.map(a => p([t(textoAula(proj, a), { color: as.length > 1 ? 'B42318' : undefined })], { align: AlignmentType.CENTER })) : [p('')], { vmerge })
        }),
      ] }))
    })
  }
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } })
}

function tabela(cab: string[], linhas: string[][], larguras: number[]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: cab.map((x, i) => cel([p([t(x, { bold: true })])], { fill: 'D9E7E0', width: larguras[i] })) }),
      ...linhas.map(l => new TableRow({ children: l.map((x, i) => cel(x.split('\n').map(y => p(y)), { width: larguras[i] })) })),
    ],
  })
}

export async function gerarDocx(proj: Projeto, s: Semestre, tipo: 'discente' | 'docente'): Promise<Blob> {
  const c = proj.config
  const blocos: (Paragraph | Table)[] = [
    p([t(`Colegiado de ${c.curso} · Oferta de componentes curriculares ${s.rotulo}`, { size: 18 })], { align: AlignmentType.CENTER, after: 80 }),
    p([t(tipo === 'discente' ? 'Versão para discentes' : 'Versão para docentes', { italics: true, size: 16, color: '555555' }), t(`   ·   gerado em ${new Date().toLocaleDateString('pt-BR')}`, { size: 16, color: '555555' })], { align: AlignmentType.CENTER, after: 200 }),
  ]
  const turmas = [...s.turmas].sort((a, b) => b.ingresso - a.ingresso || a.habilitacao.localeCompare(b.habilitacao))
  for (const tu of turmas) {
    const g = gradeTurma(proj, s, tu.id)
    const livres = s.aulas.filter(a => a.moduloLivre && a.turmas.includes(tu.id))
    if (!g && !livres.length && !tu.nota) continue
    if (g) blocos.push(g)
    else blocos.push(p([t(`TURMA ${tu.ingresso} ${habil(c, tu.habilitacao).nome.toUpperCase()} – ${periodoDaTurma(s, tu)}º SEM.`, { bold: true })], { before: 120 }))
    for (const a of livres) blocos.push(p([t('Módulo livre: ', { bold: true }), t(textoAula(proj, a))], { before: 60 }))
    if (tu.nota) blocos.push(p([t(tu.nota, { italics: true })], { before: 60 }))
    blocos.push(p('', { after: 240 }))
  }

  if (tipo === 'docente') {
    blocos.push(...tabelaCH(proj, s))

    const indef = s.aulas.filter(a => a.alocacao.length === 0)
    blocos.push(p([t('COMPONENTES CURRICULARES COM DOCENTE A DEFINIR', { bold: true, size: 18 })], { before: 240, after: 80 }))
    blocos.push(indef.length ? tabela(['TURMA', 'COMPONENTE CURRICULAR', 'COLEGIADO RESPONSÁVEL'], indef.map(a => [a.turmas.map(x => turmaCurta(c, x)).join(' + '), `${a.codigo} ${a.nome} ${a.ch}h`, a.colegiado]), [22, 50, 28]) : p('Nenhum.'))

    const ext = componentesDeOutrosColegiados(proj, s)
    blocos.push(p([t('DOCENTES EXTERNOS', { bold: true, size: 18 })], { before: 240, after: 80 }))
    blocos.push(ext.length ? tabela(['COMPONENTE / TURMA', 'DOCENTE', 'COLEGIADO'], ext.map(a => [`${a.codigo} ${a.nome} ${a.ch}h – ${a.turmas.map(x => turmaCurta(c, x)).join(' + ')}`, a.alocacao.map(x => nomeDocente(proj.docentes.find(d => d.id === x.docente))).join(', ') || 'A definir', a.colegiado]), [50, 25, 25]) : p('Nenhum.'))
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: 16 } } } },
    sections: [{
      properties: { page: { size: { orientation: PageOrientation.LANDSCAPE }, margin: { top: 720, bottom: 720, left: 720, right: 720, header: 360 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
        t(c.instituicao.toUpperCase(), { bold: true, size: 17, color: '777777' }),
        ...(c.unidade ? [t('   |   ', { size: 17, color: 'AAAAAA' }), t(c.unidade.toUpperCase(), { size: 17, color: '777777' })] : []),
        t('   |   ', { size: 17, color: 'AAAAAA' }), t(`OFERTA DE DISCIPLINAS ${s.rotulo}`, { bold: true, size: 17, color: '777777' }),
      ] })] }) },
      children: blocos,
    }],
  })
  return Packer.toBlob(doc)
}

export function memorandoExternos(proj: Projeto, s: Semestre) {
  const c = proj.config
  const ext = componentesDeOutrosColegiados(proj, s)
  const grupos = new Map<string, { rotulo: string; aulas: Aula[] }>()
  for (const a of ext) {
    const rot = a.colegiado.trim() || 'Colegiado a identificar'
    const k = norm(rot)
    const g = grupos.get(k) ?? { rotulo: rot, aulas: [] }
    g.aulas.push(a)
    grupos.set(k, g)
  }
  const doc = (id: string) => proj.docentes.find(d => d.id === id)
  const linha = (a: Aula) => `• ${a.codigo} ${a.nome} (${a.ch}h) – ${a.turmas.map(x => turmaCurta(c, x)).join(' + ')} – ${a.moduloLivre ? 'módulo livre' : resumoHorarios(c, a.horarios) || 'horário a definir'}`
  const partes: string[] = []
  for (const { rotulo, aulas } of grupos.values()) {
    const sem = aulas.filter(a => a.alocacao.length === 0)
    const com = aulas.filter(a => a.alocacao.length > 0)
    let txt = `Para: ${rotulo}\n\nAssunto: Docentes para componentes curriculares – ${c.curso} ${s.rotulo}\n\nPrezados(as),\n\n`
    if (sem.length) txt += `O Colegiado de ${c.curso} solicita a indicação de docente para o(s) componente(s) abaixo no semestre ${s.rotulo}:\n\n${sem.map(linha).join('\n')}\n\n`
    if (com.length) txt += `${sem.length ? 'Solicitamos também' : 'O Colegiado de ' + c.curso + ' solicita'} a confirmação do(s) docente(s) indicado(s) para:\n\n${com.map(a => `${linha(a)} – docente: ${a.alocacao.map(x => `${doc(x.docente)?.tratamento ?? ''} ${doc(x.docente)?.nome ?? 'não cadastrado'}`.trim()).join(', ')}`).join('\n')}\n\n`
    txt += `Atenciosamente,\nCoordenação do Curso de ${c.curso}`
    partes.push(txt)
  }
  return partes.join('\n\n────────────────────────\n\n')
}

// ---------- quadro de ofertas para o Departamento (uma linha por componente × docente, horário no padrão Sigaa) ----------
export async function gerarQuadroDepartamento(proj: Projeto, s: Semestre): Promise<Blob> {
  const c = proj.config
  const qd = c.quadroDepartamento ?? { cabecalho: `${c.instituicao.toUpperCase()}${c.unidade ? '\n' + c.unidade.toUpperCase() : ''}`, orientacoes: '' }
  const b = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
  const W = [4300, 2900, 1700, 1080, 1080, 1080, 1080, 1080, 1080] // 15380 twips (A4 paisagem, margens 0,5")
  const tc = (txt: string, i: number, o: { bold?: boolean; span?: number; vm?: (typeof VerticalMergeType)[keyof typeof VerticalMergeType]; fill?: string; center?: boolean; size?: number } = {}) => new TableCell({
    columnSpan: o.span, verticalMerge: o.vm, verticalAlign: VerticalAlign.CENTER,
    width: { size: o.span ? W.slice(i, i + o.span).reduce((x, y) => x + y, 0) : W[i], type: WidthType.DXA },
    borders: { top: b, bottom: b, left: b, right: b },
    shading: o.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: o.fill } : undefined,
    margins: { top: 30, bottom: 30, left: 60, right: 60 },
    children: [new Paragraph({ alignment: o.center ? AlignmentType.CENTER : undefined, children: [t(txt, { bold: o.bold, size: o.size ?? 17 })] })],
  })
  const blocos: (Paragraph | Table)[] = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [t(`QUADRO DE OFERTAS DE COMPONENTES CURRICULARES DO CURSO – SEMESTRE LETIVO ${s.rotulo}`, { bold: true, size: 20 })] }),
  ]
  const dias = c.dias.map(d => d.replace(/ª feira/i, '').trim())
  const NOMES = ['SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO', 'DOMINGO']
  // mesma ordem do quadro do DCBS (Licenciatura antes de Bacharelado)
  for (const h of [...c.habilitacoes].sort((x, y) => y.nome.localeCompare(x.nome))) {
    const aulas = s.aulas.filter(a => habilitacaoDoComponente(c, s, a) === h.id)
    if (!aulas.length) continue
    const ordem = (a: Aula) => {
      const ing = Math.max(...a.turmas.map(x => +x.split('-')[0] || 0))
      return [-ing, a.moduloLivre ? 1 : 0, a.horarios.slice().sort()[0] ?? 'z'] as const
    }
    aulas.sort((x, y) => { const a = ordem(x), bb = ordem(y); return a[0] - bb[0] || a[1] - bb[1] || String(a[2]).localeCompare(String(bb[2])) })
    const nDias = c.dias.length
    const rows: TableRow[] = [
      new TableRow({ tableHeader: true, children: [tc(`ANO-PERÍODO: ${s.rotulo}   |   CURSO: ${h.nome} em ${c.curso}   |   COORDENADOR(A): ${h.coordenador ?? ''}`, 0, { span: 3 + nDias, bold: true, fill: 'E7E6E6' })] }),
      new TableRow({ tableHeader: true, children: [
        tc('CÓDIGO / CARGA HORÁRIA / NOME DA DISCIPLINA', 0, { bold: true, vm: VerticalMergeType.RESTART, center: true, fill: 'F2F2F2' }),
        tc('NOME DO(S) PROFESSOR(ES)', 1, { bold: true, vm: VerticalMergeType.RESTART, center: true, fill: 'F2F2F2' }),
        tc('CARGA HORÁRIA DO(S) DOCENTE(S) NO COMPONENTE CURRICULAR', 2, { bold: true, vm: VerticalMergeType.RESTART, center: true, fill: 'F2F2F2', size: 15 }),
        tc('HORÁRIO DAS AULAS DO(S) DOCENTE(S) NO PERÍODO', 3, { bold: true, span: nDias, center: true, fill: 'F2F2F2' }),
      ] }),
      new TableRow({ tableHeader: true, children: [
        tc('', 0, { vm: VerticalMergeType.CONTINUE, fill: 'F2F2F2' }), tc('', 1, { vm: VerticalMergeType.CONTINUE, fill: 'F2F2F2' }), tc('', 2, { vm: VerticalMergeType.CONTINUE, fill: 'F2F2F2' }),
        ...dias.map((_, i) => tc(NOMES[i] ?? dias[i].toUpperCase(), 3 + i, { bold: true, center: true, fill: 'F2F2F2' })),
      ] }),
    ]
    for (const a of aulas) {
      const hor = horarioSigaaPorDia(c, a)
      const nome = `${a.codigo} ${a.nome.toUpperCase()} – ${a.ch}h`
      const docs = a.alocacao.length ? a.alocacao : [{ docente: '', ch: a.ch }]
      for (const al of docs) {
        const d = proj.docentes.find(x => x.id === al.docente)
        const prof = d ? `${d.tratamento} ${d.nome}`.trim() : 'A definir'
        const cels = [tc(nome, 0), tc(prof, 1), tc(`${al.ch}h`, 2, { center: true })]
        if (a.moduloLivre) cels.push(tc('MÓDULO LIVRE', 3, { span: nDias, center: true, bold: true }))
        else for (let i = 0; i < nDias; i++) cels.push(tc(hor[i] ?? '', 3 + i, { center: true }))
        rows.push(new TableRow({ cantSplit: true, children: cels }))
      }
    }
    blocos.push(new Table({ rows, columnWidths: W.slice(0, 3 + nDias), width: { size: W.slice(0, 3 + nDias).reduce((x, y) => x + y, 0), type: WidthType.DXA } }))
    blocos.push(new Paragraph({ spacing: { after: 280 }, children: [] }))
  }
  const ori = qd.orientacoes.split('\n').map(x => x.trim()).filter(Boolean)
  if (ori.length) {
    blocos.push(new Paragraph({ spacing: { before: 120, after: 60 }, keepNext: true, children: [t('ORIENTAÇÕES:', { bold: true, size: 18 })] }))
    ori.forEach((o, i) => blocos.push(new Paragraph({ spacing: { after: 40 }, children: [t(`${i + 1}. ${o}`, { size: 17 })] })))
  }
  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: 17 } } } },
    sections: [{
      properties: { page: { size: { orientation: PageOrientation.LANDSCAPE }, margin: { top: 720, bottom: 720, left: 720, right: 720, header: 300 } } },
      headers: { default: new Header({ children: qd.cabecalho.split('\n').map(l => new Paragraph({ alignment: AlignmentType.CENTER, children: [t(l.trim(), { bold: true, size: 18 })] })) }) },
      children: blocos,
    }],
  })
  return Packer.toBlob(doc)
}

export function csvCargaHoraria(proj: Projeto, s: Semestre) {
  const c = proj.config
  const esc = (x: string | number) => `"${String(x).replace(/"/g, '""')}"`
  const linhas = [['Docente', 'Vínculo', 'Situação', 'CH prevista', 'CH alocada', 'Componentes'].map(esc).join(';')]
  for (const d of proj.docentes) {
    const as = s.aulas.filter(a => a.alocacao.some(x => x.docente === d.id))
    if (!as.length && d.vinculo === 'externo') continue
    linhas.push([d.nome, d.vinculo, d.situacao, s.chPrevista?.[d.id] ?? '', chAlocada(s, d.id),
      as.map(a => `${a.codigo} ${a.nome} (${a.turmas.map(x => turmaCurta(c, x)).join('+')})`).join(' | ')].map(esc).join(';'))
  }
  return '﻿' + linhas.join('\n')
}

// ---------- distribuição da CH docente: uma linha por componente, docente mesclado ----------
const COR_STATUS: Record<StatusCH, string> = { confere: 'D7EDE0', diverge: 'FBE8C4', 'sem-prevista': 'EEEEEE', 'funcao-sem-componente': 'FBE8C4', indisponivel: 'F8D7D3' }

function tabelaCH(proj: Projeto, s: Semestre): (Paragraph | Table)[] {
  const c = proj.config
  const dist = distribuicaoCH(proj, s)
  // largura útil A4 paisagem com margens de 0,5" = 15398 twips
  const W = [2650, 3900, 1850, 650, 750, 1250, 1500, 850, 1998]
  const cab = ['Docente', 'Componente (graduação)', 'Turma', 'CH', 'Pós', 'Total ensino', 'Função', 'Prevista', 'Situação']
  const centro = [false, false, false, true, true, true, false, true, true]
  type Borda = { style: (typeof BorderStyle)[keyof typeof BorderStyle]; size: number; color: string }
  const nada: Borda = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  const linha: Borda = { style: BorderStyle.SINGLE, size: 4, color: '9E9E9E' }
  const fina: Borda = { style: BorderStyle.SINGLE, size: 2, color: 'D0D0D0' }
  const cx = (txt: string, i: number, o: { bold?: boolean; fill?: string; top?: Borda; bottom?: Borda; keep?: boolean } = {}) => new TableCell({
    width: { size: W[i], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
    shading: o.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: o.fill } : undefined,
    borders: { left: linha, right: linha, top: o.top ?? linha, bottom: o.bottom ?? linha },
    margins: { top: 30, bottom: 30, left: 70, right: 70 },
    children: [new Paragraph({ keepNext: o.keep, alignment: centro[i] ? AlignmentType.CENTER : undefined, children: [t(txt, { bold: o.bold, size: 15 })] })],
  })
  const rows: TableRow[] = [new TableRow({ tableHeader: true, cantSplit: true, children: cab.map((x, i) => cx(x, i, { bold: true, fill: 'D9E7E0' })) })]
  // colunas do docente (0, 4..7) aparecem só na primeira linha do grupo; as demais ficam vazias e sem borda interna
  const doGrupo = new Set([0, 4, 5, 6, 7, 8])
  for (const l of dist.comAulas) {
    const n = l.itens.length
    const cor = COR_STATUS[l.status]
    l.itens.forEach((it, i) => {
      const prim = i === 0, ult = i === n - 1
      const vals = [`${l.docente.tratamento} ${l.docente.nome}`.trim(), `${it.aula.codigo} ${it.aula.nome}`, it.aula.turmas.map(x => turmaCurta(c, x)).join(' + '), `${it.ch}h`,
        l.pos ? `${l.pos}h` : '—', `${l.total}h (${l.semanais} h/a sem.)`, l.funcao || '—', l.prevista ? `${l.prevista}h` : '—',
        rotuloStatus(l) + (l.abaixoMinimo ? ` · abaixo de ${minimoEnsino(c)}h` : '') + (l.reducao ? ' · Res. PAID art. 50 §1' : '')]
      rows.push(new TableRow({ cantSplit: true, children: vals.map((v, k) => {
        if (doGrupo.has(k)) return cx(prim ? v : '', k, { bold: k === 0 || k === 5 || (k === 8 && l.status !== 'sem-prevista'), fill: k === 8 ? (l.abaixoMinimo && l.status !== 'indisponivel' ? COR_STATUS.diverge : cor) : undefined, top: prim ? linha : nada, bottom: ult ? linha : nada, keep: !ult })
        return cx(v, k, { top: prim ? linha : fina, bottom: ult ? linha : fina, keep: !ult })
      }) }))
    })
  }
  const tot = (txt: string, i: number, bold = false) => cx(txt, i, { bold, fill: 'F2F2F2' })
  rows.push(new TableRow({ cantSplit: true, children: [tot('Total do curso', 0, true), tot('', 1), tot('', 2), tot(`${dist.totalGrad}h`, 3, true), tot(dist.totalPos ? `${dist.totalPos}h` : '—', 4),
    tot(`${dist.total}h`, 5, true), tot(`${dist.comAulas.length} docentes`, 6), tot('', 7), tot(`${dist.confere} conferem · ${dist.diverge} divergem${dist.abaixoMinimo ? ` · ${dist.abaixoMinimo} abaixo do mínimo` : ''}`, 8)] }))

  const out: (Paragraph | Table)[] = [
    new Paragraph({ children: [t('DISTRIBUIÇÃO DA CARGA HORÁRIA DOCENTE', { bold: true, size: 18 })], spacing: { before: 240, after: 80 }, keepNext: true, pageBreakBefore: true }),
    new Table({ rows, columnWidths: W, width: { size: W.reduce((a, b) => a + b, 0), type: WidthType.DXA } }),
  ]
  if (dist.semAlocacao.length) {
    out.push(new Paragraph({ spacing: { before: 160 }, children: [t(`Sem ensino em ${s.rotulo}: `, { bold: true }),
      t(dist.semAlocacao.map(l => `${l.docente.nome}${l.funcao ? ` (${l.funcao} – função sem componente)` : ''}`).join('; ') + '.')] }))
  }
  if (dist.indisponiveis.length) {
    out.push(new Paragraph({ spacing: { before: 120 }, children: [t('Afastados e dispensados: ', { bold: true }),
      t(dist.indisponiveis.map(l => `${l.docente.nome} – ${l.docente.situacao === 'afastado' ? 'afastamento' : 'dispensado'}${l.docente.obs ? ` (${l.docente.obs})` : ''}${l.itens.length ? ` – ATENÇÃO: alocado(a) em ${l.itens.map(i => i.aula.codigo).join(', ')}` : ''}`).join('; ') + '.')] }))
  }
  return out
}
