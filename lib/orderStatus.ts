/**
 * Estados post-venta del pedido (orders.print_status) — compartido entre el
 * portal admin, la API, los correos y la vista del cliente. Lógica pura.
 *
 *   paid → printing → shipped → delivered
 *
 * El álbum (blueprints.status) se mueve en paralelo: 'ordered' (pagado),
 * 'printing', 'shipped', 'delivered' — ver core/modules/album/orderLock.ts.
 */

export const PRINT_STATUSES = ['paid', 'printing', 'shipped', 'delivered'] as const
export type PrintStatus = typeof PRINT_STATUSES[number]

export function isPrintStatus(s: unknown): s is PrintStatus {
  return typeof s === 'string' && (PRINT_STATUSES as readonly string[]).includes(s)
}

/** Texto para el admin. */
export const PRINT_STATUS_ADMIN_LABEL: Record<PrintStatus, string> = {
  paid: 'Pagado — por enviar a imprenta',
  printing: 'En impresión',
  shipped: 'Enviado',
  delivered: 'Entregado',
}

/** Texto para el cliente. */
export const PRINT_STATUS_CUSTOMER_LABEL: Record<PrintStatus, string> = {
  paid: 'Preparando tu álbum',
  printing: 'En impresión',
  shipped: 'En camino',
  delivered: 'Entregado',
}

/** Estado del álbum (blueprints.status) que corresponde a cada estado del pedido. */
export const BLUEPRINT_STATUS_FOR: Record<PrintStatus, string> = {
  paid: 'ordered',
  printing: 'printing',
  shipped: 'shipped',
  delivered: 'delivered',
}

/** Columna de fecha que se estampa al llegar a cada estado. */
export const TIMESTAMP_COLUMN_FOR: Partial<Record<PrintStatus, 'printing_at' | 'shipped_at' | 'delivered_at'>> = {
  printing: 'printing_at',
  shipped: 'shipped_at',
  delivered: 'delivered_at',
}

export function statusIndex(s: string | null | undefined): number {
  return isPrintStatus(s) ? PRINT_STATUSES.indexOf(s) : -1
}

/**
 * Transiciones permitidas: solo hacia adelante, de a un paso o saltando
 * (p.ej. si se olvidó marcar "en impresión"). 'shipped' → 'shipped' se permite
 * para corregir la guía. Retroceder no: el cliente ya recibió el correo.
 */
export function canTransition(from: string | null | undefined, to: PrintStatus): boolean {
  const a = statusIndex(from)
  const b = statusIndex(to)
  if (a < 0 || b < 0) return false
  if (to === 'shipped' && from === 'shipped') return true
  return b > a
}

export const CARRIERS = [
  'Servientrega', 'Interrapidísimo', 'Coordinadora', 'Envía', 'TCC', 'Deprisa', '4-72', 'Otra',
] as const

export interface ShipmentInput {
  carrier: string
  trackingNumber: string
  trackingUrl: string | null
}

/** Valida los datos del envío. Devuelve el error para mostrar, o los datos limpios. */
export function parseShipment(raw: { carrier?: unknown; trackingNumber?: unknown; trackingUrl?: unknown }):
  { ok: true; value: ShipmentInput } | { ok: false; error: string } {
  const carrier = String(raw.carrier ?? '').trim()
  const trackingNumber = String(raw.trackingNumber ?? '').trim()
  const urlRaw = String(raw.trackingUrl ?? '').trim()
  if (!carrier) return { ok: false, error: 'Falta la transportadora.' }
  if (carrier.length > 60) return { ok: false, error: 'La transportadora es demasiado larga.' }
  if (!trackingNumber) return { ok: false, error: 'Falta el número de guía.' }
  if (trackingNumber.length > 80) return { ok: false, error: 'El número de guía es demasiado largo.' }
  let trackingUrl: string | null = null
  if (urlRaw) {
    try {
      const u = new URL(urlRaw)
      if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('protocolo')
      trackingUrl = u.toString()
    } catch {
      return { ok: false, error: 'El enlace de rastreo no es una URL válida (debe empezar por https://).' }
    }
  }
  return { ok: true, value: { carrier, trackingNumber, trackingUrl } }
}
