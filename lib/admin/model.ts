/**
 * Modelo del portal admin — lógica PURA (sin Supabase), para poder testearla.
 * La carga de datos vive en ./data.ts.
 */

export interface OrderRow {
  id: string
  reference: string
  book_id: string | null
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  shipping_address: string | null
  shipping_city: string | null
  shipping_state: string | null
  shipping_postal_code: string | null
  shipping_notes: string | null
  base_price_cop: number | null
  pages_included: number | null
  pages_total: number | null
  extra_pages_price_cop: number | null
  shipping_cop: number | null
  total_cop: number
  payment_status: string
  print_status: string | null
  wompi_transaction_id: string | null
  wompi_payment_method: string | null
  paid_at: string | null
  created_at: string
  // Post-venta (supabase/orders_postventa.sql)
  printing_at?: string | null
  shipped_at?: string | null
  delivered_at?: string | null
  shipping_carrier?: string | null
  tracking_number?: string | null
  tracking_url?: string | null
}

export interface PdfJobRow {
  blueprint_id: string
  order_reference: string | null
  status: string
  attempt_count: number
  error_message: string | null
  claimed_at: string | null
  alerted_at: string | null
  interior_path: string | null
  cover_path: string | null
  created_at: string
  updated_at: string
}

/** Estado del PDF desde el punto de vista del negocio. */
export type PdfState =
  | 'no-aplica'   // orden no pagada
  | 'sin-job'     // pagada pero sin job de ESTA orden — el barrido la reconcilia (≤5 min); si persiste, problema
  | 'en-cola'
  | 'generando'
  | 'reintentando'
  | 'listo'
  | 'fallo'

export const PDF_STATE_LABEL: Record<PdfState, string> = {
  'no-aplica': '—',
  'sin-job': 'Sin encolar',
  'en-cola': 'En cola',
  generando: 'Generando',
  reintentando: 'Reintentando',
  listo: 'Listo',
  fallo: 'Falló',
}

export const PAYMENT_LABEL: Record<string, string> = {
  approved: 'Pagado',
  pending: 'Pendiente',
  declined: 'Rechazado',
  voided: 'Anulado',
  error: 'Error',
}

export interface AdminOrder {
  order: OrderRow
  job: PdfJobRow | null
  albumTitle: string | null
  pdf: PdfState
  /** Pago → PDF listo, en ms. */
  paidToReadyMs: number | null
  /** Pago → ahora, en ms, mientras el PDF no está listo (para detectar demoras). */
  waitingMs: number | null
}

export function pdfStateOf(order: OrderRow, job: PdfJobRow | null): PdfState {
  if (order.payment_status !== 'approved') return 'no-aplica'
  if (!job || job.order_reference !== order.reference) return 'sin-job'
  switch (job.status) {
    case 'pendiente': return 'en-cola'
    case 'generando_pdf': return 'generando'
    case 'error_generacion': return 'reintentando'
    case 'pdf_listo': return 'listo'
    case 'fallo': return 'fallo'
    default: return 'en-cola'
  }
}

function ms(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? t : null
}

export function buildAdminOrder(order: OrderRow, job: PdfJobRow | null, albumTitle: string | null, now = Date.now()): AdminOrder {
  const pdf = pdfStateOf(order, job)
  const paid = ms(order.paid_at)
  const ready = pdf === 'listo' ? ms(job?.updated_at) : null
  return {
    order,
    job: job && job.order_reference === order.reference ? job : null,
    albumTitle,
    pdf,
    paidToReadyMs: paid !== null && ready !== null ? Math.max(0, ready - paid) : null,
    waitingMs: paid !== null && pdf !== 'listo' && pdf !== 'no-aplica' ? Math.max(0, now - paid) : null,
  }
}

/** Pagada hace más de 15 min y sin PDF: algo está trabado (el barrido corre cada 5). */
export const STALE_MS = 15 * 60 * 1000

export function needsAttention(o: AdminOrder): boolean {
  if (o.pdf === 'fallo') return true
  return o.waitingMs !== null && o.waitingMs > STALE_MS
}

export interface Kpis {
  orders: number
  paid: number
  revenueCop: number
  pdfReady: number
  pdfFailed: number
  attention: number
  avgPaidToReadyMs: number | null
  conversion: number | null
}

export function computeKpis(rows: AdminOrder[]): Kpis {
  const paid = rows.filter(r => r.order.payment_status === 'approved')
  const times = paid.map(r => r.paidToReadyMs).filter((t): t is number => t !== null)
  return {
    orders: rows.length,
    paid: paid.length,
    revenueCop: paid.reduce((s, r) => s + (r.order.total_cop ?? 0), 0),
    pdfReady: paid.filter(r => r.pdf === 'listo').length,
    pdfFailed: paid.filter(r => r.pdf === 'fallo').length,
    attention: rows.filter(needsAttention).length,
    avgPaidToReadyMs: times.length ? times.reduce((a, b) => a + b, 0) / times.length : null,
    conversion: rows.length ? paid.length / rows.length : null,
  }
}

// ── Filtros (vienen de la URL) ─────────────────────────────────────────────

export type RangeKey = 'hoy' | '7d' | '30d' | 'todo'
export type PaymentFilter = 'todos' | 'pagados' | 'pendientes' | 'otros'
export type PdfFilter = 'todos' | 'listos' | 'en-proceso' | 'atencion'

export interface Filters {
  range: RangeKey
  pago: PaymentFilter
  pdf: PdfFilter
  q: string
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
}

export function parseFilters(sp: Record<string, string | string[] | undefined>): Filters {
  const first = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) as string | undefined
  return {
    range: oneOf(first('rango'), ['hoy', '7d', '30d', 'todo'] as const, '30d'),
    pago: oneOf(first('pago'), ['todos', 'pagados', 'pendientes', 'otros'] as const, 'todos'),
    pdf: oneOf(first('pdf'), ['todos', 'listos', 'en-proceso', 'atencion'] as const, 'todos'),
    q: (first('q') ?? '').trim().slice(0, 100),
  }
}

/** Inicio del rango en hora de Colombia (UTC-5, sin horario de verano). */
export function rangeStart(range: RangeKey, now = Date.now()): string | null {
  if (range === 'todo') return null
  const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000
  const local = new Date(now - BOGOTA_OFFSET_MS)
  const midnightLocalUtc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + BOGOTA_OFFSET_MS
  const days = range === 'hoy' ? 0 : range === '7d' ? 6 : 29
  return new Date(midnightLocalUtc - days * 86_400_000).toISOString()
}

export function matchesPdfFilter(o: AdminOrder, f: PdfFilter): boolean {
  switch (f) {
    case 'todos': return true
    case 'listos': return o.pdf === 'listo'
    case 'en-proceso': return ['sin-job', 'en-cola', 'generando', 'reintentando'].includes(o.pdf)
    case 'atencion': return needsAttention(o)
  }
}

// ── Formato ────────────────────────────────────────────────────────────────

export function formatCop(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CO', {
    timeZone: 'America/Bogota', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/** Fecha compacta para la tabla: "05 nov, 5:28 p. m." (año solo si no es el actual). */
export function formatShortDateTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const sameYear = d.toLocaleString('es-CO', { timeZone: 'America/Bogota', year: 'numeric' }) ===
    new Date(now).toLocaleString('es-CO', { timeZone: 'America/Bogota', year: 'numeric' })
  return d.toLocaleString('es-CO', {
    timeZone: 'America/Bogota', day: '2-digit', month: 'short', ...(sameYear ? {} : { year: 'numeric' }), hour: 'numeric', minute: '2-digit',
  })
}

export { PRINT_STATUS_ADMIN_LABEL as PRINT_STATUS_LABEL } from '@/lib/orderStatus'

export function formatDuration(msValue: number | null | undefined): string {
  if (msValue === null || msValue === undefined) return '—'
  const s = Math.round(msValue / 1000)
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ${s % 60 ? `${s % 60} s` : ''}`.trim()
  const h = Math.floor(m / 60)
  if (h < 48) return `${h} h ${m % 60} min`
  return `${Math.floor(h / 24)} d ${h % 24} h`
}
