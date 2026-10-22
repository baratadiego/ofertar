export type Situacao = 'ativo' | 'afastado' | 'dispensado'
export type Vinculo = 'curso' | 'externo'

export interface Slot { id: string; inicio: string; fim: string }
export interface Turno { id: string; nome: string; slots: Slot[] }
export interface Habilitacao { id: string; nome: string; abrev: string; coordenador?: string }

export interface ComponenteMatriz {
  codigo: string
  nome: string
  ch: number
  nivel: number // 0 = sem nível (optativa)
  natureza: 'obrigatoria' | 'optativa'
}

export interface Matriz {
  id: string
  habilitacao: string
  nome: string
  ingressoDe: number
  ingressoAte: number
  componentes: ComponenteMatriz[]
}

export interface Config {
  instituicao: string
  unidade?: string // departamento/colegiado impresso no cabeçalho dos documentos
  quadroDepartamento?: { cabecalho: string; orientacoes: string } // quadro de ofertas enviado ao Departamento
  curso: string
  sigla: string
  habilitacoes: Habilitacao[]
  niveis: number
  chPorAulaSemanal: number // CH semestral ÷ este valor = aulas por semana
  chMinimaEnsino?: number // CH mínima de ensino por docente no semestre (graduação + pós), ex.: 120
  dias: string[]
  turnos: Turno[]
  matrizes: Matriz[]
}

export interface Docente {
  id: string
  nome: string
  curto: string
  tratamento: string
  vinculo: Vinculo
  situacao: Situacao
  obs: string
}

export interface Turma {
  id: string
  ingresso: number
  habilitacao: string
  nota: string
  cor?: string // cor do quadro da turma (hex, ex.: #1E7F4C)
}

export interface Alocacao { docente: string; ch: number }

export interface Aula {
  id: string
  codigo: string
  nome: string
  ch: number
  turmas: string[]
  alocacao: Alocacao[]
  horarios: string[] // "dia-slot", ex.: "0-M1"
  moduloLivre: boolean
  externo: boolean
  colegiado: string
  optativa: boolean
  obs: string
}

export interface Pendencia { id: string; texto: string; feito: boolean }

export interface Versao {
  id: string
  nome: string
  nota: string
  criadaEm: string
  snapshot: { turmas: Turma[]; aulas: Aula[]; chPrevista: Record<string, number> }
}

export interface Semestre {
  id: string
  rotulo: string
  ano: number
  periodo: number // 1 ou 2
  status: string
  turmas: Turma[]
  aulas: Aula[]
  chPrevista: Record<string, number>
  chPos?: Record<string, number> // CH de ensino na pós-graduação, por docente
  funcoes: Record<string, string>
  reducaoPaid?: Record<string, boolean> // docente com redução da Res. PAID art. 50 §1 no semestre
  pendencias: Pendencia[]
  ignorados?: string[]
  versoes: Versao[]
  atualizadoEm: string
}

export interface Projeto {
  formato: string
  config: Config
  docentes: Docente[]
  semestres: Semestre[]
}

export type Nivel = 'erro' | 'aviso' | 'info'
export interface Problema {
  id: string
  nivel: Nivel
  tipo: string
  texto: string
  detalhe?: string
  turmaId?: string
  aulaIds?: string[]
  docenteId?: string
  celulas?: string[]
}
