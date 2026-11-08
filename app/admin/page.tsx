import { headers } from 'next/headers'
import { formatOfBook, shortSize } from '@/lib/formats'
import { notFound } from 'next/navigation'
import { isAdminRequest } from '@/lib/admin/auth'
import { listOrders } from '@/lib/admin/data'
import {
  computeKpis, formatCop, formatDuration, formatShortDateTime, needsAttention, parseFilters, STALE_MS,
  type AdminOrder, type Filters,
} from '@/lib/admin/model'
import { PaymentBadge, PdfBadge, ShipBadge } from './_components'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const RANGES: [Filters['range'], string][] = [['hoy', 'Hoy'], ['7d', 'Últimos 7 días'], ['30d', 'Últimos 30 días'], ['todo', 'Todo']]
const PAGOS: [Filters['pago'], string][] = [['todos', 'Todos los pagos'], ['pagados', 'Pagados'], ['pendientes', 'Pendientes'], ['otros', 'Rechazados / anulados']]
const PDFS: [Filters['pdf'], string][] = [['todos', 'Todos los PDF'], ['listos', 'PDF listo'], ['en-proceso', 'PDF en proceso'], ['atencion', 'Requieren atención']]

function Kpi({ label, value, hint, alert }: { label: string; value: string; hint?: string; alert?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${alert ? 'border-red-400/40 bg-red-500/10' : 'border-[var(--border-subtle)] bg-[var(--bg-surface)]'}`}>
      <div className="text-xs text-[var(--text-secondary)]">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${alert ? 'text-red-300' : ''}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-[var(--text-tertiary)]">{hint}</div>}
    </div>
  )
}

function Select<T extends string>({ name, value, options }: { name: string; value: T; options: [T, string][] }) {
  return (
    <select name={name} defaultValue={value}
      className="rounded-lg border border-[var(--border-medium)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  )
}

function PdfTime({ o }: { o: AdminOrder }) {
  if (o.paidToReadyMs !== null) return <span className="tabular-nums">{formatDuration(o.paidToReadyMs)}</span>
  if (o.pdf === 'fallo' && o.waitingMs !== null) {
    return <span className="tabular-nums text-red-300">sin PDF · {formatDuration(o.waitingMs)}</span>
  }
  if (o.waitingMs !== null) {
    const stale = o.waitingMs > STALE_MS
    return <span className={`tabular-nums ${stale ? 'text-red-300' : 'text-[var(--text-secondary)]'}`}>esperando {formatDuration(o.waitingMs)}</span>
  }
  return <span className="text-[var(--text-tertiary)]">—</span>
}

function Downloads({ o }: { o: AdminOrder }) {
  const ref = encodeURIComponent(o.order.reference)
  if (o.pdf === 'listo') {
    return (
      <span className="inline-flex gap-1.5">
        <a href={`/api/admin/pdf?ref=${ref}&which=interior`} className="rounded-md border border-[var(--border-medium)] px-2 py-0.5 text-xs hover:bg-[var(--bg-elevated)]">↓ Interior</a>
        <a href={`/api/admin/pdf?ref=${ref}&which=cover`} className="rounded-md border border-[var(--border-medium)] px-2 py-0.5 text-xs hover:bg-[var(--bg-elevated)]">↓ Portada</a>
      </span>
    )
  }
  if (o.pdf === 'fallo') return <a href={`/admin/pedidos/${ref}`} className="text-xs text-red-300 underline underline-offset-2">Revisar y reintentar</a>
  return null
}

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!(await isAdminRequest(await headers()))) notFound()
  const filters = parseFilters(await searchParams)

  let data: Awaited<ReturnType<typeof listOrders>>
  try {
    data = await listOrders(filters)
  } catch (err) {
    return (
      <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-5 text-sm text-red-200">
        No se pudieron cargar los pedidos: {err instanceof Error ? err.message : String(err)}
      </div>
    )
  }
  const { inRange, visible, truncated } = data
  const k = computeKpis(inRange)
  const rangeLabel = RANGES.find(([v]) => v === filters.range)?.[1] ?? ''

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">Pedidos</h1>
          <p className="text-sm text-[var(--text-secondary)]">{rangeLabel} · hora de Colombia</p>
        </div>
        <a href="" className="text-sm text-[var(--text-secondary)] underline-offset-4 hover:underline">Actualizar</a>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Pedidos creados" value={String(k.orders)} />
        <Kpi label="Pagados" value={String(k.paid)} hint={k.conversion !== null ? `${Math.round(k.conversion * 100)}% conversión` : undefined} />
        <Kpi label="Ingresos" value={formatCop(k.revenueCop)} />
        <Kpi label="PDF listos" value={`${k.pdfReady}/${k.paid}`} />
        <Kpi label="Pago → PDF (prom.)" value={formatDuration(k.avgPaidToReadyMs)} />
        <Kpi label="Requieren atención" value={String(k.attention)} alert={k.attention > 0}
          hint={k.attention > 0 ? 'PDF falló o lleva >15 min' : 'Todo en orden'} />
      </div>

      <form method="get" className="flex flex-wrap gap-2">
        <Select name="rango" value={filters.range} options={RANGES} />
        <Select name="pago" value={filters.pago} options={PAGOS} />
        <Select name="pdf" value={filters.pdf} options={PDFS} />
        <input type="search" name="q" defaultValue={filters.q} placeholder="Referencia, cliente, email o álbum"
          className="order-first min-w-0 basis-full rounded-lg border border-[var(--border-medium)] bg-[var(--bg-elevated)] px-3 py-2 text-sm placeholder:text-[var(--text-tertiary)] sm:order-none sm:min-w-64 sm:flex-1 sm:basis-auto" />
        <button className="rounded-lg bg-[var(--brand-coral)] px-4 py-2 text-sm font-medium text-white hover:brightness-110">Filtrar</button>
      </form>

      {/* Celular: una tarjeta por pedido */}
      <ul className="space-y-3 md:hidden">
        {visible.length === 0 && <li className="rounded-xl border border-[var(--border-subtle)] p-6 text-center text-sm text-[var(--text-secondary)]">No hay pedidos con estos filtros.</li>}
        {visible.map(o => (
          <li key={o.order.id} className={`rounded-xl border p-4 ${needsAttention(o) ? 'border-red-400/40 bg-red-500/5' : 'border-[var(--border-subtle)] bg-[var(--bg-surface)]'}`}>
            <a href={`/admin/pedidos/${encodeURIComponent(o.order.reference)}`} className="block">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{o.order.customer_name || o.order.customer_email || '—'}</div>
                  <div className="truncate text-xs text-[var(--text-tertiary)]">{shortSize(formatOfBook(o.order.album_format))} · {o.albumTitle ?? o.order.reference}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-medium tabular-nums">{formatCop(o.order.total_cop)}</div>
                  <div className="text-xs text-[var(--text-tertiary)]">{formatShortDateTime(o.order.created_at)}</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <PaymentBadge status={o.order.payment_status} />
                {o.pdf !== 'no-aplica' && <><PdfBadge state={o.pdf} /><PdfTime o={o} /></>}
                {o.order.payment_status === 'approved' && <ShipBadge status={o.order.print_status} />}
              </div>
            </a>
            {(o.pdf === 'listo' || o.pdf === 'fallo') && <div className="mt-3"><Downloads o={o} /></div>}
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] text-left text-xs uppercase tracking-wider text-[var(--text-secondary)]">
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Pedido</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 text-right font-medium">Formato · págs.</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Pago</th>
              <th className="px-4 py-3 font-medium">PDF</th>
              <th className="px-4 py-3 font-medium">Pago → PDF</th>
              <th className="px-4 py-3 font-medium">Envío</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-[var(--text-secondary)]">No hay pedidos con estos filtros.</td></tr>
            )}
            {visible.map(o => {
              const ref = o.order.reference
              const href = `/admin/pedidos/${encodeURIComponent(ref)}`
              return (
                <tr key={o.order.id} className={`border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-hover)] ${needsAttention(o) ? 'bg-red-500/5' : ''}`}>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-[var(--text-secondary)]">{formatShortDateTime(o.order.created_at)}</td>
                  <td className="px-4 py-3">
                    <a href={href} className="whitespace-nowrap font-mono text-[11px] hover:text-[var(--brand-warm)] hover:underline">{ref}</a>
                    {o.albumTitle && <div className="max-w-[14rem] truncate text-xs text-[var(--text-tertiary)]">{o.albumTitle}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="max-w-[12rem] truncate">{o.order.customer_name || '—'}</div>
                    <div className="max-w-[12rem] truncate text-xs text-[var(--text-tertiary)]">{o.order.customer_email}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{shortSize(formatOfBook(o.order.album_format))} · {o.order.pages_total ?? '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatCop(o.order.total_cop)}</td>
                  <td className="px-4 py-3"><PaymentBadge status={o.order.payment_status} /></td>
                  <td className="px-4 py-3"><PdfBadge state={o.pdf} /></td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div><PdfTime o={o} /></div>
                    <div className="mt-1"><Downloads o={o} /></div>
                  </td>
                  <td className="px-4 py-3">{o.order.payment_status === 'approved' ? <ShipBadge status={o.order.print_status ?? 'paid'} /> : <span className="text-[var(--text-tertiary)]">—</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[var(--text-tertiary)]">
        {visible.length} de {inRange.length} pedidos{truncated ? ' · mostrando los 500 más recientes del rango' : ''}
      </p>
    </div>
  )
}
