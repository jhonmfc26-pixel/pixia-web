'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface Order {
  reference: string
  customer_email_masked: string
  total_cop: number
  pages_total: number
  payment_status: string
  print_status: string
  created_at: string
  paid_at: string | null
  book_id: string | null
  /** "Pequeño 20 × 20 cm" */
  format_label?: string
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<Shell><p className="text-lg text-white/80">Cargando…</p></Shell>}>
      <CheckoutSuccessContent />
    </Suspense>
  )
}

function CheckoutSuccessContent() {
  const searchParams = useSearchParams()
  const reference = searchParams.get('ref') || searchParams.get('reference')

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    localStorage.removeItem('pixia_checkout_form')
    localStorage.removeItem('pixia_pending_checkout')
  }, [])

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
      <Shell>
        <div aria-hidden className="mx-auto mb-6 h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-white" />
        <p className="text-lg text-white/85">Confirmando tu pago…</p>
        <p className="mt-2 text-sm text-white/45">Esto puede tardar unos segundos</p>
      </Shell>
    )
  }

  if (error || !order) {
    return (
      <Shell>
        <p className="mb-6 text-base text-white/80">{error || 'No pudimos encontrar tu orden'}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/mis-albumes" className={primary}>Ir a mis álbumes</Link>
          <Link href="/" className={secondary}>Volver al inicio</Link>
        </div>
      </Shell>
    )
  }

  const isPaid = order.payment_status === 'approved'
  const isPending = order.payment_status === 'pending'

  return (
    <Shell>
      <div className={`mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full text-2xl ${isPaid ? 'bg-[var(--brand-coral)] text-white' : 'bg-white/10 text-white/80'}`}>
        {isPaid ? '✓' : isPending ? '⏳' : '✕'}
      </div>

      <h1 className="font-[family-name:var(--font-display)] text-4xl font-normal text-white">
        {isPaid ? '¡Pedido confirmado!' : isPending ? 'Pago en proceso' : 'Pago no completado'}
      </h1>

      <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-white/65">
        {isPaid && 'Recibimos tu pago. Tu álbum entra a producción en las próximas 24 horas y te avisamos por correo cuando salga hacia tu casa.'}
        {isPending && 'Tu pago se está procesando. Te escribimos por correo apenas se confirme.'}
        {!isPaid && !isPending && 'El pago no se completó. Si crees que es un error, escríbenos.'}
      </p>

      <dl className="mt-8 space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 text-left text-sm">
        <Detail label="Número de orden" value={order.reference} mono />
        <Detail label="Álbum" value={`${order.format_label ?? 'Grande 30 × 30 cm'} · ${order.pages_total} páginas · Tapa dura`} />
        <Detail label="Total" value={formatCop(order.total_cop)} />
        <Detail label="Correo" value={order.customer_email_masked} />
      </dl>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        {order.book_id && (isPaid || isPending) && (
          <Link href={`/book/${order.book_id}`} className={primary}>Ver mi álbum</Link>
        )}
        {!isPaid && !isPending && order.book_id && (
          <Link href={`/checkout/${order.book_id}`} className={primary}>Intentar el pago de nuevo</Link>
        )}
        <Link href="/mis-albumes" className={secondary}>Mis álbumes</Link>
      </div>

      <p className="mt-8 text-xs leading-relaxed text-white/40">
        Puedes volver a ver tu álbum cuando quieras desde <span className="text-white/60">Mis álbumes</span>.
        ¿Dudas? Escríbenos a soporte@pixiaa.com con tu número de orden.
      </p>
    </Shell>
  )
}

const primary = 'inline-flex items-center justify-center rounded-xl bg-[var(--brand-coral)] px-7 py-3.5 text-[15px] font-medium text-white transition hover:brightness-110'
const secondary = 'inline-flex items-center justify-center rounded-xl border border-white/15 px-7 py-3.5 text-[15px] text-white transition hover:bg-white/5'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg-base)] px-4 py-16 text-white">
      <div className="w-full max-w-lg text-center">{children}</div>
    </main>
  )
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-white/55">{label}</dt>
      <dd className={`text-right text-white ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  )
}

function formatCop(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount)
}
