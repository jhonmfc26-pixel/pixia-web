'use client'

export const runtime = 'edge'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Script from 'next/script'
import { normalizeBook } from '@/core/modules/album/normalizeBook'
import type { AlbumBlueprint } from '@/core/contracts/AlbumBlueprint'
import { calculateOrderTotal } from '@/lib/wompi'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { getLocalBook } from '@/core/engine/localBookStorage'
import { isOrdered } from '@/core/modules/album/orderLock'
import { COMMERCIAL, TERMS_VERSION } from '@/lib/legal'
import { foldsFromBlueprint } from '@/core/modules/foldModel/fromBlueprint'
import { validateAlbumStructure } from '@/core/modules/foldModel/validateStructure'
import { countRealPages, countEmptyFaces } from '@/core/modules/foldModel/validate'
import type { AlbumStructure } from '@/core/modules/foldModel/types'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

declare global {
  interface Window {
    WidgetCheckout?: new (options: {
      currency: string
      amountInCents: number
      reference: string
      publicKey: string
      signature: { integrity: string }
      redirectUrl?: string
      customerData?: { email?: string; fullName?: string; phoneNumber?: string; phoneNumberPrefix?: string }
    }) => {
      open: (cb: (result: { transaction?: { id: string; status: string; reference: string } }) => void) => void
    }
  }
}

const WOMPI_WIDGET_SRC = 'https://checkout.wompi.co/widget.js'
let wompiLoading: Promise<void> | null = null

/**
 * Asegura que el widget de Wompi esté cargado. El <Script> lo carga al abrir
 * la página, pero en iPhone, después de cerrar el widget (o volver atrás),
 * window.WidgetCheckout podía no estar al reintentar y el cliente veía
 * "Wompi Widget no está cargado". Si falta, se inyecta el script de nuevo y
 * se espera a que cargue.
 */
function ensureWompiWidget(timeoutMs = 15000): Promise<void> {
  if (window.WidgetCheckout) return Promise.resolve()
  if (wompiLoading) return wompiLoading
  wompiLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = WOMPI_WIDGET_SRC
    script.async = true
    const timer = window.setTimeout(() => reject(new Error('timeout')), timeoutMs)
    script.onload = () => {
      window.clearTimeout(timer)
      if (window.WidgetCheckout) resolve()
      else reject(new Error('widget sin WidgetCheckout'))
    }
    script.onerror = () => { window.clearTimeout(timer); reject(new Error('error de red')) }
    document.head.appendChild(script)
  }).finally(() => { wompiLoading = null })
  return wompiLoading
}

/** Orden creada en este intento: si el cliente cierra el widget y vuelve a pagar, se reutiliza. */
interface PendingOrder {
  key: string
  createdAt: number
  data: { currency: string; amountInCents: number; reference: string; publicKey: string; integrityHash: string }
}
const ORDER_REUSE_MS = 30 * 60 * 1000

interface FormData {
  name: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  postalCode: string
  notes: string
}

const COLOMBIA_STATES = [
  'Bogotá D.C.', 'Antioquia', 'Valle del Cauca', 'Cundinamarca', 'Atlántico',
  'Santander', 'Bolívar', 'Norte de Santander', 'Risaralda', 'Caldas',
  'Tolima', 'Magdalena', 'Cauca', 'Huila', 'Meta', 'Boyacá', 'Nariño',
  'Quindío', 'Cesar', 'Córdoba', 'Otros',
]

export default function CheckoutPage() {
  const params = useParams<{ bookId: string }>()
  const router = useRouter()
  const bookId = params?.bookId

  const [book, setBook] = useState<AlbumBlueprint | null>(null)
  const [loadingBook, setLoadingBook] = useState(true)
  const [bookError, setBookError] = useState<string | null>(null)

  const [form, setForm] = useState<FormData>({
    name: '', email: '', phone: '',
    address: '', city: '', state: 'Bogotá D.C.', postalCode: '', notes: '',
  })
  const [submitting, setSubmitting] = useState(false)
  // Un álbum pagado queda congelado (es lo que se imprime): el cliente debe
  // confirmar que lo revisó antes de pagar.
  const [reviewed, setReviewed] = useState(false)
  // Aceptación expresa de términos + autorización de datos (Ley 1480 / Ley 1581).
  // Se guarda con la orden (versión, fecha, IP) como constancia.
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const pendingOrder = useRef<PendingOrder | null>(null)

  // iPhone restaura la página desde caché al volver atrás (bfcache): el botón
  // quedaba en "Procesando…" para siempre.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) setSubmitting(false) }
    window.addEventListener('pageshow', onShow)
    return () => window.removeEventListener('pageshow', onShow)
  }, [])

  const [showLoginModal, setShowLoginModal] = useState(false)
  const [otpSending, setOtpSending] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otpError, setOtpError] = useState<string | null>(null)
  const [sessionBanner, setSessionBanner] = useState(false)

  // Aviso de páginas vacías (#6 de la auditoría) — advierte, no bloquea: el
  // usuario puede confirmar y seguir. Una vez confirmado no se vuelve a
  // preguntar en este mismo intento de pago.
  const [showEmptyPagesModal, setShowEmptyPagesModal] = useState(false)
  const [emptyPagesAck, setEmptyPagesAck] = useState(false)

  // Restaurar formulario guardado (sobrevive la redirección del magic link)
  useEffect(() => {
    const saved = localStorage.getItem('pixia_checkout_form')
    if (saved) {
      try { setForm(JSON.parse(saved)) } catch { /* ignorar */ }
    }
  }, [])

  // Carga del blueprint — mismo camino que edit-v2/viewer: Supabase primero
  // (así checkout ve las ediciones guardadas ahí, páginas agregadas
  // incluidas), localStorage solo como red de EMERGENCIA si Supabase falla.
  // Antes leía SOLO de localStorage, que puede no tener nada si el álbum se
  // editó en otra sesión/dispositivo, o tener una copia vieja sin los
  // cambios de edit-v2 (ver auditoría, hallazgo #4).
  useEffect(() => {
    if (!bookId) return

    async function loadBook() {
      try {
        const { data: { session } } = await supabaseBrowser.auth.getSession()
        if (session) {
          const { data, error } = await supabaseBrowser
            .from('blueprints')
            .select('*')
            .eq('id', bookId)
            .single()
          if (!error && data) {
            // Ya pagado: no se vuelve a cobrar, se manda a verlo.
            if (isOrdered(data.status)) { router.replace(`/book/${bookId}`); return }
            setBook(normalizeBook(data, bookId) as AlbumBlueprint)
            setLoadingBook(false)
            return
          }
          if (error) console.warn('[checkout] Supabase load:', error.message)
        }
      } catch (e) {
        console.warn('[checkout] No se pudo cargar desde Supabase:', e)
      }

      try {
        const raw = await getLocalBook(bookId)
        if (!raw) {
          setBookError('No se encontró el álbum. ¿Lo creaste en este navegador?')
          setLoadingBook(false)
          return
        }
        const normalized = normalizeBook(raw, bookId)
        setBook(normalized as AlbumBlueprint)
        setLoadingBook(false)
      } catch (err) {
        console.error('[checkout] Error cargando book:', err)
        setBookError('Error al cargar el álbum')
        setLoadingBook(false)
      }
    }
    loadBook()

    // Si el usuario acaba de volver del magic link, mostrar banner de confirmación
    supabaseBrowser.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionBanner(true)
        setTimeout(() => setSessionBanner(false), 3000)
      }
    })
  }, [bookId])

  // ── Structure — misma derivación que edit-v2/viewer: preferir la guardada
  // por el editor, caer a foldsFromBlueprint si no existe o es inválida. Es
  // la fuente real del número de páginas (ver countRealPages) — pageCount
  // del blueprint queda congelado desde que se generó el álbum y no se
  // actualiza al agregar/quitar pliegos en edit-v2 (auditoría, hallazgo #2).
  const structureInitialized = useRef(false)
  const [structure, setStructure] = useState<AlbumStructure | null>(null)

  useEffect(() => {
    if (!book || structureInitialized.current) return
    structureInitialized.current = true

    if (book.structure) {
      const knownIds = new Set<string>()
      for (const s of book.spreads) for (const p of s.photos) knownIds.add(p.id)
      const v = validateAlbumStructure(book.structure, knownIds)
      if (v.ok) { setStructure(book.structure); return }
      console.warn('[checkout] structure descartada:', v.reason)
    }

    const { structure: derived } = foldsFromBlueprint(book)
    setStructure(derived)
  }, [book])

  const realPageCount = useMemo(
    () => (structure ? countRealPages(structure) : null),
    [structure],
  )
  const emptyFacesCount = useMemo(
    () => (structure ? countEmptyFaces(structure) : 0),
    [structure],
  )

  const pricing = useMemo(() => {
    if (realPageCount === null) return null
    return { pagesTotal: realPageCount, ...calculateOrderTotal(realPageCount) }
  }, [realPageCount])

  const handleChange = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm(prev => {
      const next = { ...prev, [field]: e.target.value }
      localStorage.setItem('pixia_checkout_form', JSON.stringify(next))
      return next
    })
  }

  const isFormValid = () => {
    if (!form.name.trim() || form.name.length < 3) return false
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return false
    if (!/^\d{10}$/.test(form.phone.replace(/\D/g, ''))) return false
    if (!form.address.trim()) return false
    if (!form.city.trim()) return false
    if (!form.state.trim()) return false
    return true
  }

  const sendMagicLink = async () => {
    setOtpSending(true)
    setOtpError(null)
    const { error } = await supabaseBrowser.auth.signInWithOtp({
      email: form.email,
      options: {
        // TODO: integrar Resend como SMTP custom de Supabase para emails de marca
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: true,
      },
    })
    setOtpSending(false)
    if (error) {
      setOtpError(error.message)
    } else {
      setOtpSent(true)
      localStorage.setItem('pixia_pending_checkout', JSON.stringify({
        bookId,
        returnTo: window.location.pathname,
      }))
    }
  }

  // Punto de entrada del botón "Pagar" — filtra el aviso de páginas vacías
  // antes de dejar pasar a proceedToCheckout. Si el usuario ya confirmó una
  // vez en este intento, no se le vuelve a preguntar.
  const handleCheckout = () => {
    if (!book || !structure || !pricing || !isFormValid() || !reviewed || !acceptedTerms) return
    if (emptyFacesCount > 0 && !emptyPagesAck) {
      setShowEmptyPagesModal(true)
      return
    }
    proceedToCheckout()
  }

  const confirmEmptyPagesAndContinue = () => {
    setEmptyPagesAck(true)
    setShowEmptyPagesModal(false)
    proceedToCheckout()
  }

  const proceedToCheckout = async () => {
    if (!book || !pricing || !isFormValid()) return

    // Verificar sesión activa. Si no hay, interceptar con magic link.
    const { data: { session } } = await supabaseBrowser.auth.getSession()
    if (!session) {
      setShowLoginModal(true)
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      // Primero el widget: si no carga, no se crea una orden que nunca se va a pagar.
      try {
        await ensureWompiWidget()
      } catch (e) {
        console.error('[checkout] Wompi no cargó:', e)
        throw new Error('No pudimos abrir la pasarela de pago. Revisa tu conexión e inténtalo de nuevo.')
      }

      // Misma orden si el cliente cerró el widget y vuelve a pagar sin cambiar nada
      // (antes cada intento creaba otra orden pendiente).
      const orderKey = JSON.stringify({ bookId, pages: pricing.pagesTotal, total: pricing.totalCop, form })
      const reusable = pendingOrder.current
        && pendingOrder.current.key === orderKey
        && Date.now() - pendingOrder.current.createdAt < ORDER_REUSE_MS
      let data: PendingOrder['data']
      if (reusable) {
        data = pendingOrder.current!.data
      } else {
        const { data: { session: activeSession } } = await supabaseBrowser.auth.getSession()
        const orderHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
        if (activeSession?.access_token) {
          orderHeaders['Authorization'] = `Bearer ${activeSession.access_token}`
        }

        const res = await fetch('/api/orders/create', {
          method: 'POST',
          headers: orderHeaders,
          body: JSON.stringify({
            bookId,
            bookSnapshot: book,
            sessionId: localStorage.getItem('pixia_session_id') ?? '',
            pagesTotal: pricing.pagesTotal,
            termsVersion: TERMS_VERSION,
            customer: { name: form.name, email: form.email, phone: form.phone },
            shipping: {
              address: form.address,
              city: form.city,
              state: form.state,
              postalCode: form.postalCode || undefined,
              notes: form.notes || undefined,
            },
          }),
        })

        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Error al crear la orden')
        data = json
        pendingOrder.current = { key: orderKey, createdAt: Date.now(), data }
      }

      if (!window.WidgetCheckout) {
        throw new Error('No pudimos abrir la pasarela de pago. Recarga la página e inténtalo de nuevo.')
      }

      const checkout = new window.WidgetCheckout({
        currency: data.currency,
        amountInCents: data.amountInCents,
        reference: data.reference,
        publicKey: data.publicKey,
        signature: { integrity: data.integrityHash },
        redirectUrl: `${window.location.origin}/checkout/success?ref=${data.reference}`,
        customerData: {
          email: form.email,
          fullName: form.name,
          phoneNumber: form.phone.replace(/\D/g, ''),
          phoneNumberPrefix: '+57',
        },
      })

      checkout.open((result) => {
        if (result?.transaction) {
          // La referencia ya tiene una transacción: no se puede reutilizar.
          pendingOrder.current = null
          router.push(`/checkout/success?ref=${data.reference}`)
        } else {
          console.log('[checkout] Widget cerrado sin transacción')
          setSubmitting(false)
        }
      })
    } catch (err: unknown) {
      console.error('[checkout] Error:', err)
      const msg = err instanceof Error ? err.message : 'Error inesperado'
      setSubmitError(msg)
      setSubmitting(false)
    }
  }

  if (loadingBook || (book && !structure)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f0f', color: '#fff' }}>
        Cargando tu álbum...
      </div>
    )
  }

  if (bookError || !book || !structure) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f0f0f', color: '#fff', padding: 20 }}>
        <p style={{ marginBottom: 20 }}>{bookError || 'Error al cargar el álbum'}</p>
        <button onClick={() => router.push('/')} style={{ padding: '10px 20px', background: '#fff', color: '#000', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
          Volver al inicio
        </button>
      </div>
    )
  }

  const formValid = isFormValid() && reviewed && acceptedTerms

  return (
    <>
      <Script src="https://checkout.wompi.co/widget.js" strategy="afterInteractive" />

      {sessionBanner && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 400,
          background: 'rgba(34,197,94,0.12)',
          borderBottom: '1px solid rgba(34,197,94,0.25)',
          padding: '12px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          fontSize: '14px', color: 'rgba(134,239,172,0.95)',
        }}>
          <span>✓</span>
          <span>Sesión confirmada — puedes continuar con tu pedido</span>
        </div>
      )}

      {showLoginModal && (
        <div
          onClick={() => setShowLoginModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 500,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '40px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#161616',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '420px',
              boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '20px 24px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Acceso seguro
                </div>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '20px', color: 'white', marginTop: '2px' }}>
                  Guarda tu álbum para continuar
                </div>
              </div>
              <button
                onClick={() => setShowLoginModal(false)}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '22px', cursor: 'pointer', lineHeight: 1, padding: '4px 8px' }}
              >×</button>
            </div>

            {/* Cuerpo */}
            <div style={{ padding: '28px 24px' }}>
              {!otpSent ? (
                <>
                  <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', lineHeight: 1.6, marginBottom: '24px' }}>
                    Te enviamos un enlace de acceso a <strong style={{ color: '#fff' }}>{form.email}</strong>.
                    Haz clic en él para confirmar y continuar con tu pedido.
                  </p>

                  {otpError && (
                    <div style={{ padding: '10px 14px', background: 'rgba(255,80,80,0.12)', border: '1px solid rgba(255,80,80,0.25)', borderRadius: '6px', color: '#ff8080', fontSize: '13px', marginBottom: '16px' }}>
                      {otpError}
                    </div>
                  )}

                  <button
                    onClick={sendMagicLink}
                    disabled={otpSending}
                    style={{
                      width: '100%', padding: '13px',
                      background: otpSending ? 'rgba(255,255,255,0.15)' : '#fff',
                      color: otpSending ? 'rgba(255,255,255,0.4)' : '#000',
                      border: 'none', borderRadius: '8px',
                      fontSize: '15px', fontWeight: 600,
                      cursor: otpSending ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {otpSending ? 'Enviando...' : 'Enviar enlace'}
                  </button>
                  <p style={{ marginTop: 12, fontSize: 11, lineHeight: 1.5, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
                    Usamos tu correo para tu cuenta y tu pedido, según nuestra{' '}
                    <a href="/privacidad" target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>Política de datos personales</a>.
                  </p>
                </>
              ) : (
                <>
                  <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <div style={{ fontSize: '36px', marginBottom: '12px' }}>📬</div>
                    <p style={{ color: '#fff', fontSize: '15px', fontWeight: 500, marginBottom: '8px' }}>
                      Revisa tu correo
                    </p>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', lineHeight: 1.6 }}>
                      Te enviamos el enlace a <strong style={{ color: 'rgba(255,255,255,0.85)' }}>{form.email}</strong>.
                      Haz clic en él para continuar con tu pedido.
                    </p>
                  </div>

                  <button
                    onClick={() => { setOtpSent(false); setOtpError(null) }}
                    style={{
                      width: '100%', padding: '10px',
                      background: 'transparent',
                      color: 'rgba(255,255,255,0.5)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px', fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    ¿No llegó? Reenviar enlace
                  </button>
                  <p style={{ textAlign: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '10px' }}>
                    Revisa también la carpeta de spam
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showEmptyPagesModal}
        title={`Tienes ${emptyFacesCount} página${emptyFacesCount !== 1 ? 's' : ''} sin fotos`}
        message="Se imprimirán en blanco tal como están. Puedes volver a editar tu álbum y completarlas, o continuar así."
        confirmLabel="Comprar de todas formas"
        cancelLabel="Volver a editar"
        onConfirm={confirmEmptyPagesAndContinue}
        onCancel={() => { setShowEmptyPagesModal(false); router.push(`/book/${bookId}/edit-v2`) }}
      />

      <div style={{ minHeight: '100vh', background: '#0f0f0f', color: '#fff', padding: '40px 20px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>

          <button
            onClick={() => router.push(`/book/${bookId}`)}
            style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', marginBottom: 24, fontSize: 14 }}
          >
            ← Volver al álbum
          </button>

          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 36, marginBottom: 8 }}>
            Confirmar pedido
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 32 }}>
            Estás a un paso de tener tu álbum impreso
          </p>

          <div className="grid items-start gap-8 md:grid-cols-[1fr_360px]">

            {/* FORMULARIO */}
            <div>
              <h2 style={{ fontSize: 18, marginBottom: 16, color: 'rgba(255,255,255,0.85)' }}>
                Datos de contacto
              </h2>

              <input
                type="text" placeholder="Nombre completo *" value={form.name} onChange={handleChange('name')}
                style={inputStyle}
              />
              <input
                type="email" placeholder="Email *" value={form.email} onChange={handleChange('email')}
                style={inputStyle}
              />
              <input
                type="tel" placeholder="Teléfono (10 dígitos) *" value={form.phone} onChange={handleChange('phone')}
                style={inputStyle}
              />

              <h2 style={{ fontSize: 18, marginBottom: 16, marginTop: 32, color: 'rgba(255,255,255,0.85)' }}>
                Dirección de envío
              </h2>

              <input
                type="text" placeholder="Dirección completa *" value={form.address} onChange={handleChange('address')}
                style={inputStyle}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <input type="text" placeholder="Ciudad *" value={form.city} onChange={handleChange('city')} style={inputStyle} />
                <select value={form.state} onChange={handleChange('state')} style={inputStyle}>
                  {COLOMBIA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <input
                type="text" placeholder="Código postal (opcional)" value={form.postalCode} onChange={handleChange('postalCode')}
                style={inputStyle}
              />
              <textarea
                placeholder="Observaciones (apartamento, indicaciones especiales...)"
                value={form.notes} onChange={handleChange('notes')}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
              />

              {submitError && (
                <div style={{ padding: 12, background: 'rgba(255,80,80,0.15)', border: '1px solid rgba(255,80,80,0.3)', borderRadius: 6, color: '#ff8080', marginTop: 16, fontSize: 14 }}>
                  {submitError}
                </div>
              )}
            </div>

            {/* RESUMEN */}
            <div className="md:sticky md:top-5" style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 24 }}>
              <h2 style={{ fontSize: 16, marginBottom: 16, color: 'rgba(255,255,255,0.85)' }}>
                Resumen del pedido
              </h2>

              <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>Álbum</p>
                <p style={{ fontSize: 16, fontWeight: 500 }}>{book.cover?.title || 'Mi álbum'}</p>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                  {pricing?.pagesTotal || 0} páginas · Cuadrado 30×30 cm
                </p>
                {emptyFacesCount > 0 && (
                  <p style={{ fontSize: 12, color: '#fbbf24', marginTop: 8 }}>
                    ⚠ {emptyFacesCount} página{emptyFacesCount !== 1 ? 's' : ''} sin fotos
                  </p>
                )}
              </div>

              {pricing && (
                <>
                  <Row label="Precio base (20 páginas)" value={pricing.basePriceCop} />
                  {pricing.extraPages > 0 && (
                    <Row label={`Páginas extra (${pricing.extraPages})`} value={pricing.extraPagesPriceCop} />
                  )}
                  <Row label="Envío" value={pricing.shippingCop} valueLabel="Gratis" />
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '16px 0' }} />
                  <Row label="Total" value={pricing.totalCop} bold />
                </>
              )}

              <div style={{
                marginTop: 24, padding: '14px 16px', borderRadius: 10,
                background: 'rgba(232,85,58,0.08)', border: '1px solid rgba(232,85,58,0.25)',
              }}>
                <p style={{ fontSize: 13, lineHeight: 1.55, color: 'rgba(255,255,255,0.85)' }}>
                  <strong style={{ color: '#fff' }}>Revisa tu álbum antes de pagar.</strong>{' '}
                  Una vez pagado entra a producción tal como está y ya no se puede editar.
                  Podrás seguir viéndolo y compartiéndolo desde Mis álbumes.
                </p>
                <a href={`/book/${bookId}`} style={{ display: 'inline-block', marginTop: 8, fontSize: 13, color: '#F08A72', textDecoration: 'underline' }}>
                  Revisar mi álbum
                </a>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 12, fontSize: 13, color: 'rgba(255,255,255,0.85)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)}
                    style={{ marginTop: 2, width: 16, height: 16, accentColor: '#E8553A', flexShrink: 0 }} />
                  Revisé mi álbum y entiendo que después de pagar no se puede modificar.
                </label>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 10, fontSize: 13, color: 'rgba(255,255,255,0.85)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)}
                    style={{ marginTop: 2, width: 16, height: 16, accentColor: '#E8553A', flexShrink: 0 }} />
                  <span>
                    Acepto los{' '}
                    <a href="/terminos" target="_blank" rel="noreferrer" style={{ color: '#F08A72', textDecoration: 'underline' }}>Términos y condiciones</a>{' '}
                    y autorizo el tratamiento de mis datos según la{' '}
                    <a href="/privacidad" target="_blank" rel="noreferrer" style={{ color: '#F08A72', textDecoration: 'underline' }}>Política de datos personales</a>.
                  </span>
                </label>
              </div>

              <button
                onClick={handleCheckout}
                disabled={submitting || !formValid}
                style={{
                  width: '100%', padding: '14px', marginTop: 16,
                  background: formValid && !submitting ? '#fff' : 'rgba(255,255,255,0.15)',
                  color: formValid && !submitting ? '#000' : 'rgba(255,255,255,0.4)',
                  border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600,
                  cursor: formValid && !submitting ? 'pointer' : 'not-allowed',
                }}
              >
                {submitting ? 'Procesando...' : `Pagar ${pricing ? formatCop(pricing.totalCop) : ''}`}
              </button>

              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 12, textAlign: 'center', lineHeight: 1.5 }}>
                Pago seguro con Wompi · Tarjeta, PSE, Nequi
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 6, textAlign: 'center', lineHeight: 1.6 }}>
                Entrega en {COMMERCIAL.deliveryLabel} · Cancelación con devolución total antes de que entre a impresión ·{' '}
                <a href="/terminos#garantia" target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>Garantía de {COMMERCIAL.warrantyMonths} meses</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', marginBottom: 12,
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
  // 16px: con menos, Safari en iPhone hace zoom al tocar el campo.
  borderRadius: 6, color: '#fff', fontSize: 16, boxSizing: 'border-box',
}

function Row({ label, value, bold = false, valueLabel }: { label: string; value: number; bold?: boolean; valueLabel?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: bold ? 16 : 14, fontWeight: bold ? 600 : 400 }}>
      <span style={{ color: bold ? '#fff' : 'rgba(255,255,255,0.7)' }}>{label}</span>
      <span style={{ color: bold ? '#fff' : 'rgba(255,255,255,0.85)' }}>{valueLabel ?? formatCop(value)}</span>
    </div>
  )
}

function formatCop(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount)
}
