import { supabaseAdmin } from '@/lib/supabase'
import {
  buildAdminOrder, matchesPdfFilter, rangeStart,
  type AdminOrder, type Filters, type OrderRow, type PdfJobRow,
} from './model'

/**
 * Carga de datos del portal admin. Solo servidor (usa el service role) —
 * siempre detrás de getAdmin() (ver ./auth.ts).
 */

// Columnas explícitas: NUNCA book_snapshot (el álbum entero, pesado).
const ORDER_COLUMNS = [
  'id', 'reference', 'book_id', 'customer_name', 'customer_email', 'customer_phone',
  'shipping_address', 'shipping_city', 'shipping_state', 'shipping_postal_code', 'shipping_notes',
  'base_price_cop', 'pages_included', 'pages_total', 'extra_pages_price_cop', 'shipping_cop', 'total_cop',
  'payment_status', 'print_status', 'wompi_transaction_id', 'wompi_payment_method', 'paid_at', 'created_at',
].join(', ')

const JOB_COLUMNS = 'blueprint_id, order_reference, status, attempt_count, error_message, claimed_at, alerted_at, interior_path, cover_path, created_at, updated_at'

const LIST_LIMIT = 500

async function attach(orders: OrderRow[]): Promise<AdminOrder[]> {
  const bookIds = [...new Set(orders.map(o => o.book_id).filter((id): id is string => Boolean(id)))]
  const jobs = new Map<string, PdfJobRow>()
  const titles = new Map<string, string>()
  if (bookIds.length > 0) {
    const [jobsRes, bpRes] = await Promise.all([
      supabaseAdmin.from('pdf_generation_jobs').select(JOB_COLUMNS).in('blueprint_id', bookIds),
      supabaseAdmin.from('blueprints').select('id, narrative, cover').in('id', bookIds),
    ])
    if (jobsRes.error) throw new Error(`pdf_generation_jobs: ${jobsRes.error.message}`)
    for (const j of (jobsRes.data ?? []) as unknown as PdfJobRow[]) jobs.set(j.blueprint_id, j)
    // Título del álbum es decorativo: si falla, la lista igual se muestra.
    for (const b of (bpRes.data ?? []) as { id: string; narrative?: { title?: string }; cover?: { title?: string } }[]) {
      const t = b.narrative?.title || b.cover?.title
      if (t) titles.set(b.id, t)
    }
  }
  const now = Date.now()
  return orders.map(o => buildAdminOrder(o, o.book_id ? jobs.get(o.book_id) ?? null : null, o.book_id ? titles.get(o.book_id) ?? null : null, now))
}

/** Pedidos del rango (para KPIs) y los que pasan todos los filtros (para la tabla). */
export async function listOrders(filters: Filters): Promise<{ inRange: AdminOrder[]; visible: AdminOrder[]; truncated: boolean }> {
  let query = supabaseAdmin.from('orders').select(ORDER_COLUMNS).order('created_at', { ascending: false }).limit(LIST_LIMIT)
  const from = rangeStart(filters.range)
  if (from) query = query.gte('created_at', from)

  const { data, error } = await query
  if (error) throw new Error(`orders: ${error.message}`)
  const orders = (data ?? []) as unknown as OrderRow[]
  const inRange = await attach(orders)

  const q = filters.q.toLowerCase()
  const visible = inRange.filter(o => {
    if (filters.pago === 'pagados' && o.order.payment_status !== 'approved') return false
    if (filters.pago === 'pendientes' && o.order.payment_status !== 'pending') return false
    if (filters.pago === 'otros' && ['approved', 'pending'].includes(o.order.payment_status)) return false
    if (!matchesPdfFilter(o, filters.pdf)) return false
    if (q) {
      const hay = [o.order.reference, o.order.customer_email, o.order.customer_name, o.albumTitle].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
  return { inRange, visible, truncated: orders.length === LIST_LIMIT }
}

export async function getOrder(reference: string): Promise<AdminOrder | null> {
  const { data, error } = await supabaseAdmin.from('orders').select(ORDER_COLUMNS).eq('reference', reference).maybeSingle()
  if (error) throw new Error(`orders: ${error.message}`)
  if (!data) return null
  const [row] = await attach([data as unknown as OrderRow])
  return row
}

/**
 * Vuelve a encolar el PDF de una orden pagada (p.ej. después de un 'fallo').
 * El barrido lo toma en ≤5 min. Solo actúa si el job es de ESTA orden y no
 * está generándose en este momento.
 */
export async function requeuePdf(reference: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const order = await getOrder(reference)
  if (!order) return { ok: false, error: 'Orden no encontrada' }
  if (order.order.payment_status !== 'approved') return { ok: false, error: 'La orden no está pagada' }
  if (!order.order.book_id) return { ok: false, error: 'La orden no tiene álbum asociado' }
  if (order.pdf === 'generando') return { ok: false, error: 'El PDF se está generando ahora mismo' }

  const { error } = await supabaseAdmin.from('pdf_generation_jobs').upsert({
    blueprint_id: order.order.book_id,
    order_reference: reference,
    status: 'pendiente',
    pdf_engine: 'container',
    attempt_count: 0,
    error_message: null,
    claimed_at: null,
    alerted_at: null,
    interior_path: null,
    cover_path: null,
    cover_done: false,
  }, { onConflict: 'blueprint_id' })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ── Descargas ──────────────────────────────────────────────────────────────

function b64url(bytes: ArrayBuffer): string {
  let bin = ''
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Link de descarga firmado del contenedor (mismo esquema HMAC que
 * services/pdf-render-container/src/r2.ts → signDownloadUrl). El contenedor
 * valida y redirige a R2.
 */
export async function signPdfDownloadUrl(
  key: string,
  opts: { containerUrl?: string; secret?: string; expiresInSeconds?: number; now?: number } = {},
): Promise<string | null> {
  const containerUrl = opts.containerUrl ?? process.env.PDF_CONTAINER_URL
  const secret = opts.secret ?? process.env.PDF_CONTAINER_SECRET
  if (!containerUrl || !secret) return null
  const exp = Math.floor((opts.now ?? Date.now()) / 1000) + (opts.expiresInSeconds ?? 600)
  const hmacKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = b64url(await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(`${key}|${exp}`)))
  const url = new URL('/download', containerUrl)
  url.searchParams.set('key', key)
  url.searchParams.set('exp', String(exp))
  url.searchParams.set('sig', sig)
  return url.toString()
}
