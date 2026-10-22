import { useEffect, type ReactNode } from 'react'

export function Modal({ titulo, onClose, children, rodape, largura }: { titulo: string; onClose: () => void; children: ReactNode; rodape?: ReactNode; largura?: number }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="veu" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo} style={largura ? { width: `min(${largura}px, 100%)` } : undefined}>
        <header><h3>{titulo}</h3><button className="btn ghost sm" onClick={onClose} aria-label="Fechar">✕</button></header>
        <div className="corpo">{children}</div>
        {rodape && <footer>{rodape}</footer>}
      </div>
    </div>
  )
}

export function Campo({ rotulo, children, style }: { rotulo: string; children: ReactNode; style?: React.CSSProperties }) {
  return <label className="campo" style={style}><span>{rotulo}</span>{children}</label>
}

export function Pill({ tipo, children }: { tipo: 'ok' | 'warn' | 'err' | 'mute'; children: ReactNode }) {
  return <span className={`pill ${tipo}`}>{children}</span>
}
