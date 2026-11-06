import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { isAdminRequest } from '@/lib/admin/auth'
import { getOrder } from '@/lib/admin/data'
import { formatCop, formatDateTime, formatDuration, needsAttention, PDF_STATE_LABEL } from '@/lib/admin/model'
import { Badge, ButtonLink, Card, Field, PaymentBadge, PdfBadge } from '../../_components'
import { CARRIERS, isPrintStatus, statusIndex } from '@/lib/orderStatus'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const FLASH: Record<string, { tone: 'ok' | 'bad'; text: string }> = {
  reencolado: { tone: 'ok', text: 'Regenerando el PDF — tarda alrededor de un minuto. Recarga la página para ver el estado.' },
  'reencolado-cola': { tone: 'ok', text: 'PDF encolado de nuevo. El barrido automático lo toma en máximo 5 minutos.' },
  estado: { tone: 'ok', text: 'Estado actualizado (sin correo al cliente).' },
  'estado-correo': { tone: 'ok', text: 'Estado actualizado y correo enviado al cliente.' },
}

function Step({ label, at, done, last }: { label: string; at: string | null; done: boolean; last?: boolean }) {
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!last && <span className={`absolute left-[7px] top-4 h-full w-px ${done ? 'bg-emerald-400/50' : 'bg-white/10'}`} />}
      <span className={`relative mt-1 h-[15px] w-[15px] shrink-0 rounded-full border-2 ${done ? 'border-emerald-400 bg-emerald-400/30' : 'border-white/20'}`} />
      <div>
        <div className={`text-sm ${done ? '' : 'text-[var(--text-tertiary)]'}`}>{label}</div>
        <div className="text-xs tabular-nums text-[var(--text-secondary)]">{at ? formatDateTime(at) : '—'}</div>
      </div>
    </li>
  )
}

const input = 'w-full rounded-lg border border-[var(--border-medium)] bg-[var(--bg-base)] px-3 py-2 text-sm'
const notifyBox = (
  <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
    <input type="checkbox" name="notify" defaultChecked className="h-4 w-4 accent-[var(--brand-coral)]" />
    Avisar al cliente por correo
  </label>
)

/** Botón del siguiente paso. "Enviado" pide transportadora y guía. */
function StatusForm({ reference, current, carrier, tracking, trackingUrl }: {
  reference: string; current: string | null; carrier?: string | null; tracking?: string | null; trackingUrl?: string | null
}) {
  const idx = statusIndex(isPrintStatus(current) ? current : 'paid')
  const action = `/api/admin/orders/${reference}/status`
  const btn = 'rounded-lg bg-[var(--brand-coral)] px-3.5 py-2 text-sm font-medium text-white hover:brightness-110'
  return (
    <div className="mt-5 space-y-4 border-t border-[var(--border-subtle)] pt-5">
      {idx < 1 && (
        <form method="post" action={action} className="space-y-2">
          <input type="hidden" name="status" value="printing" />
          {notifyBox}
          <button className={btn}>Marcar en impresión</button>
        </form>
      )}
      {idx <= 2 && (
        <form method="post" action={action} className="space-y-2">
          <input type="hidden" name="status" value="shipped" />
          <div className="grid gap-2 sm:grid-cols-2">
            <select name="carrier" defaultValue={carrier ?? ''} required className={input}>
              <option value="" disabled>Transportadora</option>
              {CARRIERS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input name="trackingNumber" defaultValue={tracking ?? ''} required placeholder="Número de guía" className={input} />
          </div>
          <input name="trackingUrl" type="url" defaultValue={trackingUrl ?? ''} placeholder="Enlace de rastreo (opcional)" className={input} />
          {notifyBox}
          <button className={idx === 2 ? 'rounded-lg border border-[var(--border-medium)] px-3.5 py-2 text-sm font-medium hover:bg-[var(--bg-hover)]' : btn}>
            {idx === 2 ? 'Corregir guía' : 'Marcar enviado'}
          </button>
        </form>
      )}
      {idx === 2 && (
        <form method="post" action={action} className="space-y-2">
          <input type="hidden" name="status" value="delivered" />
          {notifyBox}
          <button className={btn}>Marcar entregado</button>
        </form>
      )}
      {idx === 3 && <p className="text-sm text-[var(--text-secondary)]">Pedido entregado: no hay más pasos.</p>}
    </div>
  )
}

export default async function AdminOrderPage({
  params, searchParams,
}: {
  params: Promise<{ reference: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (!(await isAdminRequest(await headers()))) notFound()
  const { reference } = await params
  const sp = await searchParams
  const o = await getOrder(decodeURIComponent(reference))
  if (!o) notFound()

  const { order, job } = o
  const flash = typeof sp.ok === 'string' ? FLASH[sp.ok] : typeof sp.error === 'string' ? { tone: 'bad' as const, text: sp.error } : null
  const ref = encodeURIComponent(order.reference)
  const isPaid = order.payment_status === 'approved'
  const generationMs = job?.status === 'pdf_listo' && job.claimed_at
    ? new Date(job.updated_at).getTime() - new Date(job.claimed_at).getTime()
    : null

  return (
    <div className="space-y-6">
      <a href="/admin" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">← Pedidos</a>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-xl sm:text-2xl">{order.reference}</h1>
        <PaymentBadge status={order.payment_status} />
        <PdfBadge state={o.pdf} />
        {needsAttention(o) && <Badge tone="bad">Requiere atención</Badge>}
      </div>
      {o.albumTitle && <p className="-mt-4 text-[var(--text-secondary)]">{o.albumTitle}</p>}

      {flash && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${flash.tone === 'ok' ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-red-400/40 bg-red-500/10 text-red-200'}`}>
          {flash.text}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="PDF de impresión" className="lg:col-span-2">
          {!isPaid ? (
            <p className="text-sm text-[var(--text-secondary)]">El PDF se genera solo cuando el pago queda aprobado.</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              <ol>
                <Step label="Pedido creado" at={order.created_at} done />
                <Step label="Pago aprobado" at={order.paid_at} done={Boolean(order.paid_at)} />
                <Step label="Generación iniciada" at={job?.claimed_at ?? null} done={Boolean(job?.claimed_at)} />
                <Step label="PDF listo" at={job?.status === 'pdf_listo' ? job.updated_at : null} done={o.pdf === 'listo'} last />
              </ol>
              <dl>
                <Field label="Estado">{PDF_STATE_LABEL[o.pdf]}</Field>
                <Field label="Pago → PDF">{formatDuration(o.paidToReadyMs ?? o.waitingMs)}{o.paidToReadyMs === null && o.waitingMs !== null ? (o.pdf === 'fallo' ? ' (sin PDF)' : ' (esperando)') : ''}</Field>
                <Field label="Tiempo de generación">{formatDuration(generationMs)}</Field>
                <Field label="Intentos">{job ? `${job.attempt_count} de 3` : '—'}</Field>
                {o.pdf === 'sin-job' && (
                  <Field label="Nota">El barrido revisa cada 5 min las órdenes pagadas sin job y las encola.</Field>
                )}
                {job?.error_message && (
                  <div className="mt-3 rounded-lg border border-red-400/30 bg-red-500/10 p-3 font-mono text-xs text-red-200">{job.error_message}</div>
                )}
              </dl>
            </div>
          )}
          {isPaid && (
            <div className="mt-6 flex flex-wrap gap-2 border-t border-[var(--border-subtle)] pt-5">
              {o.pdf === 'listo' && (
                <>
                  <ButtonLink href={`/api/admin/pdf?ref=${ref}&which=interior`} variant="primary">Descargar interior</ButtonLink>
                  <ButtonLink href={`/api/admin/pdf?ref=${ref}&which=cover`} variant="primary">Descargar portada</ButtonLink>
                </>
              )}
              {o.pdf !== 'generando' && order.book_id && (
                <form method="post" action={`/api/admin/orders/${ref}/requeue`}>
                  <button className="rounded-lg border border-[var(--border-medium)] px-3.5 py-2 text-sm font-medium hover:bg-[var(--bg-hover)]">
                    {o.pdf === 'listo' ? 'Regenerar PDF' : 'Reintentar PDF'}
                  </button>
                </form>
              )}
              {order.book_id && <ButtonLink href={`/book/${order.book_id}?admin=1`}>Ver álbum</ButtonLink>}
            </div>
          )}
        </Card>

        <Card title="Pago">
          <dl>
            <Field label="Base">{formatCop(order.base_price_cop)}</Field>
            <Field label="Páginas">{order.pages_total ?? '—'}{order.pages_included ? ` (incluye ${order.pages_included})` : ''}</Field>
            <Field label="Páginas extra">{formatCop(order.extra_pages_price_cop)}</Field>
            <Field label="Envío">{formatCop(order.shipping_cop)}</Field>
            <Field label="Total"><span className="font-semibold">{formatCop(order.total_cop)}</span></Field>
            <Field label="Método">{order.wompi_payment_method}</Field>
            <Field label="Transacción Wompi"><span className="font-mono text-xs">{order.wompi_transaction_id}</span></Field>
            <Field label="Pagado">{formatDateTime(order.paid_at)}</Field>
          </dl>
        </Card>

        <Card title="Cliente">
          <dl>
            <Field label="Nombre">{order.customer_name}</Field>
            <Field label="Email">{order.customer_email && <a className="hover:underline" href={`mailto:${order.customer_email}`}>{order.customer_email}</a>}</Field>
            <Field label="Teléfono">{order.customer_phone && <a className="hover:underline" href={`tel:${order.customer_phone}`}>{order.customer_phone}</a>}</Field>
          </dl>
        </Card>

        <Card title="Envío" className="lg:col-span-2">
          <dl>
            <Field label="Dirección">{order.shipping_address}</Field>
            <Field label="Ciudad">{[order.shipping_city, order.shipping_state].filter(Boolean).join(', ') || null}</Field>
            <Field label="Código postal">{order.shipping_postal_code}</Field>
            <Field label="Notas">{order.shipping_notes}</Field>
          </dl>
        </Card>

        {isPaid && (
          <Card title="Estado del pedido">
            <ol>
              <Step label="Pagado" at={order.paid_at} done />
              <Step label="En impresión" at={order.printing_at ?? null} done={statusIndex(order.print_status) >= 1} />
              <Step label="Enviado" at={order.shipped_at ?? null} done={statusIndex(order.print_status) >= 2} />
              <Step label="Entregado" at={order.delivered_at ?? null} done={statusIndex(order.print_status) >= 3} last />
            </ol>
            {order.tracking_number && (
              <dl className="mt-4">
                <Field label="Transportadora">{order.shipping_carrier}</Field>
                <Field label="Guía"><span className="font-mono text-xs">{order.tracking_number}</span></Field>
                {order.tracking_url && <Field label="Rastreo"><a className="hover:underline" href={order.tracking_url} target="_blank" rel="noreferrer">Abrir</a></Field>}
              </dl>
            )}
            <StatusForm reference={ref} current={order.print_status} carrier={order.shipping_carrier} tracking={order.tracking_number} trackingUrl={order.tracking_url} />
          </Card>
        )}
      </div>
    </div>
  )
}
