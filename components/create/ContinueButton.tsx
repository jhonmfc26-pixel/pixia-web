'use client'

import { ReactNode } from 'react'
import { useWizard } from './WizardProvider'
import { useRouter } from 'next/navigation'

type Props = {
  disabled?: boolean
  children?: ReactNode
  isFinalStep?: boolean
}

export default function ContinueButton({ disabled = false, children, isFinalStep = false }: Props) {
  const { state, dispatch } = useWizard()
  const router = useRouter()

  return (
    <div style={{
      position: 'fixed',
      bottom: 0, left: 0, right: 0,
      height: '72px',
      background: 'var(--bg-base)',
      borderTop: '1px solid var(--border-subtle)',
      padding: '0 48px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      zIndex: 50,
    }}>
      {/* Volver */}
      {state.step > 1 ? (
        <button
          onClick={() => dispatch({ type: 'PREV_STEP' })}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: '14px',
            fontWeight: 400,
            cursor: 'pointer',
            padding: '8px 0',
            transition: 'color 0.2s',
            fontFamily: 'var(--font-body)',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          ← Volver
        </button>
      ) : (
        <div />
      )}

      {/* Continuar */}
      <button
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          if (isFinalStep) {
            router.push('/create/loading')
          } else {
            dispatch({ type: 'NEXT_STEP' })
          }
        }}
        style={{
          padding: '12px 32px',
          borderRadius: '8px',
          background: disabled ? 'var(--bg-elevated)' : 'var(--brand-coral)',
          color: disabled ? 'var(--text-tertiary)' : '#ffffff',
          fontSize: '15px',
          fontWeight: 500,
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.35 : 1,
          transition: 'opacity 0.2s',
          fontFamily: 'var(--font-body)',
          letterSpacing: '0.01em',
        }}
        onMouseEnter={e => { if (!disabled) e.currentTarget.style.opacity = '0.88' }}
        onMouseLeave={e => { if (!disabled) e.currentTarget.style.opacity = '1' }}
      >
        {children || 'Continuar'}
      </button>
    </div>
  )
}
