/**
 * Pagos que se quedaron «pendientes»: el cliente pagó pero el aviso de Wompi
 * nunca llegó y el cliente tampoco volvió a la página de confirmación (cerró
 * el navegador, se quedó sin batería…). Cada barrido le pide a la web que le
 * pregunte a Wompi por esos pedidos: POST https://pixiaa.com/api/orders/<ref>.
 *
 * La lógica de pagos vive en un solo lugar (lib/paymentSync.ts, en la web):
 * el contenedor no tiene las llaves de Wompi ni manda correos de pedidos.
 */

/** Antes de esto todavía puede llegar el aviso normal de Wompi. */
export const PENDING_MIN_MINUTES = 10
/** Un pago por PSE o en efectivo puede tardar; pasados 3 días ya no se revisa. */
export const PENDING_MAX_HOURS = 72
export const MAX_PER_SWEEP = 20

export interface PaymentCheck {
  reference: string
  /** Estado del pedido después de preguntar, o el motivo por el que no se pudo. */
  result: string
}

export async function checkPendingPayments(deps: {
  listPending: (minMinutes: number, maxHours: number, limit: number) => Promise<string[]>
  siteUrl: string
  fetchImpl?: typeof fetch
}): Promise<PaymentCheck[]> {
  const fetchImpl = deps.fetchImpl ?? fetch
  const site = deps.siteUrl.replace(/\/+$/, '')
  const refs = await deps.listPending(PENDING_MIN_MINUTES, PENDING_MAX_HOURS, MAX_PER_SWEEP)
  const out: PaymentCheck[] = []
  for (const reference of refs) {
    try {
      const res = await fetchImpl(`${site}/api/orders/${encodeURIComponent(reference)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        // Una redirección aquí casi siempre es Cloudflare Access pidiendo
        // inicio de sesión: se reporta en vez de seguirla.
        redirect: 'manual',
      })
      if (!res.ok) {
        const hint = res.status >= 300 && res.status < 400 ? ' (¿Cloudflare Access protege /api/orders?)' : ''
        out.push({ reference, result: `HTTP ${res.status}${hint}` })
        continue
      }
      const body = await res.json() as { order?: { payment_status?: string } }
      out.push({ reference, result: body.order?.payment_status ?? 'sin estado' })
    } catch (err) {
      out.push({ reference, result: `error: ${err instanceof Error ? err.message : String(err)}` })
    }
  }
  return out
}
