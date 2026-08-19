'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { normalizeBook } from '@/core/modules/album/normalizeBook'

type SpinnerMsg = 'session' | 'saving'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [expired, setExpired] = useState(false)
  const [spinnerMsg, setSpinnerMsg] = useState<SpinnerMsg>('session')

  useEffect(() => {
    // detectSessionInUrl:true ya procesó el fragmento #access_token — solo leemos.
    supabaseBrowser.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        setExpired(true)
        return
      }

      const raw = localStorage.getItem('pixia_pending_checkout')
      const pending = raw ? (JSON.parse(raw) as { bookId: string; returnTo: string }) : null

      if (pending?.bookId) {
        // Mostrar "Guardando tu álbum..." al menos 500ms para valor percibido
        setSpinnerMsg('saving')
        const saveStart = Date.now()

        try {
          const allBooks = JSON.parse(localStorage.getItem('pixia_books') || '{}')
          const rawBook = allBooks[pending.bookId]
          if (rawBook) {
            const blueprint = normalizeBook(rawBook, pending.bookId)
            const sessionId = localStorage.getItem('pixia_session_id') ?? ''

            await fetch('/api/blueprints/persist', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ blueprint, sessionId }),
            })
          }
        } catch (err) {
          // No bloquear la redirección — Wompi es lo importante
          console.warn('[auth/callback] No se pudo persistir el blueprint:', err)
        }

        // Garantizar al menos 500ms en "Guardando..."
        const elapsed = Date.now() - saveStart
        if (elapsed < 500) {
          await new Promise(r => setTimeout(r, 500 - elapsed))
        }

        localStorage.removeItem('pixia_pending_checkout')
        router.replace(pending.returnTo)
      } else {
        router.replace('/')
      }
    })
  }, [router])

  if (expired) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0f0f0f', color: '#fff',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px', textAlign: 'center',
      }}>
        <div style={{ fontSize: '36px', marginBottom: '16px' }}>⏱️</div>
        <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.85)', marginBottom: '8px' }}>
          Este enlace ya expiró o fue usado
        </p>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', marginBottom: '28px' }}>
          Vuelve al checkout e intenta de nuevo.
        </p>
        <button
          onClick={() => router.back()}
          style={{
            padding: '10px 24px',
            background: '#fff', color: '#000',
            border: 'none', borderRadius: '8px',
            fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          Volver
        </button>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0f0f0f', color: '#fff',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '16px',
    }}>
      <div style={{
        width: '32px', height: '32px',
        border: '2px solid rgba(255,255,255,0.15)',
        borderTopColor: '#fff',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
      <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>
        {spinnerMsg === 'session' ? 'Confirmando tu sesión...' : 'Guardando tu álbum...'}
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
