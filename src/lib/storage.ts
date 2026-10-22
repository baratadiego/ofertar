import type { Projeto } from './types'

const KEY = 'ofertas-curso:projeto'

export function carregarLocal(): Projeto | null {
  try {
    const s = localStorage.getItem(KEY)
    return s ? (JSON.parse(s) as Projeto) : null
  } catch { return null }
}

export function salvarLocal(p: Projeto) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); return true } catch { return false }
}

export function limparLocal() {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}

export function validarProjeto(x: unknown): x is Projeto {
  const p = x as Projeto
  return !!p && typeof p === 'object' && !!p.config && Array.isArray(p.docentes) && Array.isArray(p.semestres)
}

// ---- arquivo (.json) ----
type FileHandle = { name: string; createWritable: () => Promise<{ write: (d: Blob | string) => Promise<void>; close: () => Promise<void> }>; getFile: () => Promise<File> }
type W = Window & { showOpenFilePicker?: (o?: unknown) => Promise<FileHandle[]>; showSaveFilePicker?: (o?: unknown) => Promise<FileHandle> }
const w = window as W
const tipos = [{ description: 'Projeto de ofertas', accept: { 'application/json': ['.json'] } }]

export const suportaArquivoDireto = () => typeof w.showSaveFilePicker === 'function' && window.self === window.top

let handle: FileHandle | null = null
export const arquivoAtual = () => handle?.name ?? null

export async function abrirArquivo(): Promise<Projeto | null> {
  if (suportaArquivoDireto() && w.showOpenFilePicker) {
    const [h] = await w.showOpenFilePicker({ types: tipos, multiple: false })
    const txt = await (await h.getFile()).text()
    const p = JSON.parse(txt)
    if (!validarProjeto(p)) throw new Error('O arquivo não é um projeto de ofertas válido.')
    handle = h
    return p
  }
  return new Promise((resolve, reject) => {
    const inp = document.createElement('input')
    inp.type = 'file'
    inp.accept = '.json,application/json'
    inp.onchange = async () => {
      const f = inp.files?.[0]
      if (!f) return resolve(null)
      try {
        const p = JSON.parse(await f.text())
        if (!validarProjeto(p)) throw new Error('O arquivo não é um projeto de ofertas válido.')
        resolve(p)
      } catch (e) { reject(e) }
    }
    inp.click()
  })
}

export async function salvarArquivo(p: Projeto, comoNovo = false): Promise<string> {
  const blob = new Blob([JSON.stringify(p, null, 1)], { type: 'application/json' })
  if (suportaArquivoDireto()) {
    if (!handle || comoNovo) handle = await w.showSaveFilePicker!({ suggestedName: nomeSugerido(p), types: tipos })
    const wr = await handle.createWritable()
    await wr.write(blob)
    await wr.close()
    return handle.name
  }
  baixar(blob, nomeSugerido(p))
  return nomeSugerido(p)
}

export function nomeSugerido(p: Projeto) {
  const s = (p.config.sigla || 'curso').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `ofertas-${s}.json`
}

export function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
