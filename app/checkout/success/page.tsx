'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

interface Order {
  reference: string
  customer_name: string
  customer_email: string
  total_cop: number
  pages_total: number
  payment_status: string
  print_status: string
  created_at: string
  paid_at: string | null
}

const containerStyle: React.CSSProperties = {
  minHeight: '100vh', background: '#0f0f0f', color: '#fff',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
}

const primaryButton: React.CSSProperties = {
  padding: '12px 28px', background: '#fff', color: '#000',
  border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div style={containerStyle}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, marginBottom: 8 }}>Cargando...</div>
        </div>
      </div>
    }>
      <CheckoutSuccessContent />
    </Suspense>
  )
}

function CheckoutSuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const reference = searchParams.get('ref') || searchParams.get('reference')

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!reference) {
      setError('Referencia de orden no encontrada')
      setLoading(false)
      return
    }

    let attempts = 0
    let cancelled = false

    const poll = async () => {
      while (attempts < 10 && !cancelled) {
        try {
          const res = await fetch(`/api/orders/${reference}`)
          if (res.ok) {
            const data = await res.json()
            if (cancelled) return
            setOrder(data.order)
            if (data.order.payment_status === 'approved') {
              setLoading(false)
              return
            }
          }
        } catch (err) {
          console.error('[success] poll error:', err)
        }
        attempts++
        await new Promise(r => setTimeout(r, 2000))
      }
      if (!cancelled) setLoading(false)
    }

    poll()
    return () => { cancelled = true }
  }, [reference])

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, marginBottom: 8 }}>Confirmando tu pago...</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Esto puede tardar unos segundos</div>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <p style={{ fontSize: 16, marginBottom: 20 }}>
            {error || 'No pudimos encontrar tu orden'}
          </p>
          <button onClick={() => router.push('/')} style={primaryButton}>
            Volver al inicio
          </button>
        </div>
      </div>
    )
  }

  const isPaid = order.payment_status === 'approved'
  const isPending = order.payment_status === 'pending'

  return (
    <div style={containerStyle}>
      <div style={{ maxWidth: 500, textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>
          {isPaid ? '✓' : isPending ? '⏳' : '✕'}
        </div>

        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 32, marginBottom: 12 }}>
          {isPaid ? '¡Pedido confirmado!' : isPending ? 'Pago en proceso' : 'Pago no completado'}
        </h1>

        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', marginBottom: 32, lineHeight: 1.5 }}>
          {isPaid && `Hola ${order.customer_name}, recibimos tu pago correctamente. Tu álbum entrará en producción en las próximas 24 horas.`}
          {isPending && 'Tu pago está siendo procesado. Recibirás un email cuando se confirme.'}
          {!isPaid && !isPending && 'El pago no se completó. Si crees que es un error, contáctanos.'}
        </p>

        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 24, marginBottom: 24, textAlign: 'left' }}>
          <Detail label="Número de orden" value={order.reference} />
          <Detail label="Álbum" value={`${order.pages_total} páginas`} />
          <Detail label="Total" value={formatCop(order.total_cop)} />
          <Detail label="Email" value={order.customer_email} />
        </div>

        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 24, lineHeight: 1.6 }}>
          Te enviamos un email con la confirmación. Si tienes dudas, escríbenos a soporte@pixiaa.com con tu número de orden.
        </p>

        <button onClick={() => router.push('/')} style={primaryButton}>
          Volver al inicio
        </button>
      </div>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14 }}>
      <span style={{ color: 'rgba(255,255,255,0.6)' }}>{label}</span>
      <span style={{ color: '#fff', fontFamily: 'monospace' }}>{value}</span>
    </div>
  )
}

function formatCop(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount)
}
