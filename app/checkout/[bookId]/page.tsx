'use client'

export const runtime = 'edge'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Script from 'next/script'
import { normalizeBook } from '@/core/modules/album/normalizeBook'
import type { AlbumBlueprint } from '@/core/contracts/AlbumBlueprint'
import { calculateOrderTotal } from '@/lib/wompi'

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
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!bookId) return
    try {
      const allBooks = JSON.parse(localStorage.getItem('pixia_books') || '{}')
      const raw = allBooks[bookId]
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
  }, [bookId])

  const pricing = useMemo(() => {
    if (!book) return null
    const pagesTotal = (book as { pageCount?: number }).pageCount || 20
    return { pagesTotal, ...calculateOrderTotal(pagesTotal) }
  }, [book])

  const handleChange = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
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

  const handleCheckout = async () => {
    if (!book || !pricing || !isFormValid()) return
    setSubmitting(true)
    setSubmitError(null)

    try {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId,
          bookSnapshot: book,
          pagesTotal: pricing.pagesTotal,
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

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al crear la orden')

      if (!window.WidgetCheckout) {
        throw new Error('Wompi Widget no está cargado. Recarga la página.')
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
        if (!result?.transaction) {
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

  if (loadingBook) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f0f', color: '#fff' }}>
        Cargando tu álbum...
      </div>
    )
  }

  if (bookError || !book) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f0f0f', color: '#fff', padding: 20 }}>
        <p style={{ marginBottom: 20 }}>{bookError || 'Error al cargar el álbum'}</p>
        <button onClick={() => router.push('/')} style={{ padding: '10px 20px', background: '#fff', color: '#000', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
          Volver al inicio
        </button>
      </div>
    )
  }

  const formValid = isFormValid()

  return (
    <>
      <Script src="https://checkout.wompi.co/widget.js" strategy="afterInteractive" />

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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 32, alignItems: 'start' }}>

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
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 24, position: 'sticky', top: 20 }}>
              <h2 style={{ fontSize: 16, marginBottom: 16, color: 'rgba(255,255,255,0.85)' }}>
                Resumen del pedido
              </h2>

              <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>Álbum</p>
                <p style={{ fontSize: 16, fontWeight: 500 }}>{book.cover?.title || 'Mi álbum'}</p>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                  {pricing?.pagesTotal || 0} páginas · Cuadrado 30×30 cm
                </p>
              </div>

              {pricing && (
                <>
                  <Row label="Precio base" value={pricing.basePriceCop} />
                  {pricing.extraPages > 0 && (
                    <Row label={`Páginas extra (${pricing.extraPages})`} value={pricing.extraPagesPriceCop} />
                  )}
                  <Row label="Envío" value={pricing.shippingCop} />
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '16px 0' }} />
                  <Row label="Total" value={pricing.totalCop} bold />
                </>
              )}

              <button
                onClick={handleCheckout}
                disabled={submitting || !formValid}
                style={{
                  width: '100%', padding: '14px', marginTop: 24,
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
  borderRadius: 6, color: '#fff', fontSize: 14, boxSizing: 'border-box',
}

function Row({ label, value, bold = false }: { label: string; value: number; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: bold ? 16 : 14, fontWeight: bold ? 600 : 400 }}>
      <span style={{ color: bold ? '#fff' : 'rgba(255,255,255,0.7)' }}>{label}</span>
      <span style={{ color: bold ? '#fff' : 'rgba(255,255,255,0.85)' }}>{formatCop(value)}</span>
    </div>
  )
}

function formatCop(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount)
}
