'use client'

import { useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { authErrorMessage, cleanCode, isCompleteCode } from '@/lib/authMessages'

/**
 * Entrar con el código que viene en el correo de acceso, sin salir de esta
 * pantalla. Es la alternativa al enlace: el enlace abre el navegador que el
 * celular elija (por ejemplo, el de la app de Gmail), donde el álbum no existe;
 * el código funciona en el navegador donde la persona está.
 *
 * Al validarlo, la sesión queda en este navegador y se sigue el mismo camino
 * que con el enlace (/auth/callback): guarda el álbum y vuelve a donde estaba.
 */
export function EmailCodeForm({ email }: { email: string }) {
  const [code, setCode] = useState('')
  const [state, setState] = useState<'idle' | 'checking' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const verify = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!isCompleteCode(code) || state === 'checking') return
    setState('checking')
    setError(null)
    const { error: otpError } = await supabaseBrowser.auth.verifyOtp({ email: email.trim(), token: code, type: 'email' })
    if (otpError) {
      setState('error')
      setError(authErrorMessage(otpError.message))
      return
    }
    window.location.assign('/auth/callback')
  }

  const ready = isCompleteCode(code)
  return (
    <form onSubmit={verify} style={{ width: '100%', textAlign: 'left' }}>
      <label htmlFor="pixia-email-code" style={{ display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>
        Código del correo
      </label>
      <input
        id="pixia-email-code"
        value={code}
        onChange={e => { setCode(cleanCode(e.target.value)); if (state === 'error') setState('idle') }}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        placeholder="123456"
        aria-invalid={state === 'error'}
        style={{
          width: '100%', boxSizing: 'border-box', padding: '12px 14px', marginBottom: '10px',
          background: 'rgba(255,255,255,0.06)', borderRadius: '8px', color: '#fff', outline: 'none',
          border: `1px solid ${state === 'error' ? 'rgba(255,110,90,0.6)' : 'rgba(255,255,255,0.14)'}`,
          fontSize: '22px', letterSpacing: '0.3em', textAlign: 'center', fontVariantNumeric: 'tabular-nums',
        }}
      />
      {error && (
        <p role="alert" style={{ fontSize: '13px', lineHeight: 1.5, color: '#F08A72', margin: '0 0 10px' }}>{error}</p>
      )}
      <button
        type="submit"
        disabled={!ready || state === 'checking'}
        style={{
          width: '100%', padding: '13px', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 600,
          background: ready && state !== 'checking' ? '#fff' : 'rgba(255,255,255,0.15)',
          color: ready && state !== 'checking' ? '#000' : 'rgba(255,255,255,0.4)',
          cursor: ready && state !== 'checking' ? 'pointer' : 'not-allowed',
        }}
      >
        {state === 'checking' ? 'Verificando…' : 'Entrar con el código'}
      </button>
    </form>
  )
}
