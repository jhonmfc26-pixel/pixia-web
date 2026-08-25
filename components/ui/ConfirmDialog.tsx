'use client'

import { useEffect } from 'react'

export interface ConfirmDialogProps {
  open: boolean
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  /** También se dispara con Escape o clic en el overlay — "cancelar" en sentido amplio. */
  onCancel: () => void
  /** 'default' = acción normal (coral). 'danger' = irreversible/destructivo (rojo de alerta). */
  variant?: 'default' | 'danger'
}

const CONFIRM_COLOR: Record<NonNullable<ConfirmDialogProps['variant']>, string> = {
  default: '#E8553A',
  danger: '#dc3c32',
}

const KEYFRAMES = `
  @keyframes pixia-confirm-overlay-in { from { opacity: 0 } to { opacity: 1 } }
  @keyframes pixia-confirm-card-in { from { opacity: 0; transform: scale(0.96) } to { opacity: 1; transform: scale(1) } }
`

/**
 * Reemplazo Pixia de window.confirm() — mismo overlay/tarjeta/coral que el
 * resto del editor (ver CHROM en edit-v2/page.tsx), reusable en cualquier
 * flujo (editor, checkout, etc). Escape y clic fuera cuentan como "cancelar".
 */
export default function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar',
  onConfirm, onCancel, variant = 'default',
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
        animation: 'pixia-confirm-overlay-in 0.15s ease both',
      }}
    >
      <style>{KEYFRAMES}</style>
      <div
        onClick={e => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        style={{
          width: '100%', maxWidth: '380px',
          background: '#161616',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '14px',
          boxShadow: '0 24px 70px rgba(0,0,0,0.55)',
          padding: '24px',
          animation: 'pixia-confirm-card-in 0.16s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        {title && (
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', color: '#fff', marginBottom: '10px' }}>
            {title}
          </div>
        )}
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, margin: 0 }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: '10px', marginTop: '22px' }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '11px',
              border: '1px solid rgba(255,255,255,0.14)', borderRadius: '8px',
              background: 'transparent', color: 'rgba(255,255,255,0.6)',
              fontSize: '13px', cursor: 'pointer', transition: 'background 0.12s, color 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: '11px',
              border: 'none', borderRadius: '8px',
              background: CONFIRM_COLOR[variant], color: '#fff',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
