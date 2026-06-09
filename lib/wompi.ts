/**
 * Helpers para integración con Wompi.
 * Documentación: https://docs.wompi.co
 */

const WOMPI_API_URL = process.env.WOMPI_API_URL || 'https://sandbox.wompi.co/v1'

export interface WompiTransactionStatus {
  id: string
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR'
  amount_in_cents: number
  reference: string
  payment_method_type?: string
  customer_email?: string
}

/**
 * Genera el hash de integridad requerido por el Widget de Wompi.
 * Fórmula: SHA-256(reference + amountInCents + currency + integritySecret)
 * Ver: https://docs.wompi.co/docs/colombia/widget-checkout-web/
 */
export async function generateIntegrityHash(
  reference: string,
  amountInCents: number,
  currency: string = 'COP'
): Promise<string> {
  const integritySecret = process.env.WOMPI_INTEGRITY_SECRET
  if (!integritySecret) throw new Error('WOMPI_INTEGRITY_SECRET no configurado')

  const message = `${reference}${amountInCents}${currency}${integritySecret}`
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Valida la firma HMAC de un webhook de Wompi.
 * Wompi envía un campo signature.checksum que es:
 *   SHA-256(concat(properties_values) + timestamp + eventsSecret)
 */
export async function validateWebhookSignature(
  payload: {
    signature?: { checksum?: string; properties?: string[] }
    timestamp?: number
    data?: Record<string, unknown>
  }
): Promise<boolean> {
  const eventsSecret = process.env.WOMPI_EVENTS_SECRET
  if (!eventsSecret) {
    console.error('[Wompi] WOMPI_EVENTS_SECRET no configurado')
    return false
  }

  const checksum = payload?.signature?.checksum
  const properties = payload?.signature?.properties
  const timestamp = payload?.timestamp

  if (!checksum || !properties || !timestamp || !payload.data) return false

  // Concatenar los valores de las properties referenciadas (rutas tipo "transaction.id")
  const data = payload.data as Record<string, unknown>
  const concatenated = properties
    .map(prop => {
      const parts = prop.split('.')
      let value: unknown = data
      for (const part of parts) {
        if (typeof value === 'object' && value !== null) {
          value = (value as Record<string, unknown>)[part]
        } else {
          value = undefined
        }
      }
      return String(value ?? '')
    })
    .join('')

  const message = `${concatenated}${timestamp}${eventsSecret}`
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(message))
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const expectedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

  return expectedHash === checksum
}

/**
 * Consulta el estado de una transacción en Wompi (defensa contra webhooks falsos).
 */
export async function fetchTransactionStatus(
  transactionId: string
): Promise<WompiTransactionStatus | null> {
  try {
    const response = await fetch(`${WOMPI_API_URL}/transactions/${transactionId}`, {
      headers: {
        Authorization: `Bearer ${process.env.WOMPI_PRIVATE_KEY}`,
      },
    })
    if (!response.ok) {
      console.error('[Wompi] fetchTransactionStatus error:', response.status)
      return null
    }
    const json = await response.json()
    return json.data as WompiTransactionStatus
  } catch (err) {
    console.error('[Wompi] fetchTransactionStatus exception:', err)
    return null
  }
}

/**
 * Calcula el precio total de un álbum.
 */
export function calculateOrderTotal(pagesTotal: number): {
  basePriceCop: number
  pagesIncluded: number
  extraPages: number
  extraPagesPriceCop: number
  shippingCop: number
  totalCop: number
} {
  const basePriceCop = parseInt(process.env.NEXT_PUBLIC_BASE_PRICE_COP || '250000')
  const pagesIncluded = parseInt(process.env.NEXT_PUBLIC_PAGES_INCLUDED || '20')
  const extraPagePriceCop = parseInt(process.env.NEXT_PUBLIC_EXTRA_PAGE_PRICE_COP || '8000')
  const shippingCop = parseInt(process.env.NEXT_PUBLIC_SHIPPING_COP || '15000')

  const extraPages = Math.max(0, pagesTotal - pagesIncluded)
  const extraPagesPriceCop = extraPages * extraPagePriceCop
  const totalCop = basePriceCop + extraPagesPriceCop + shippingCop

  return {
    basePriceCop,
    pagesIncluded,
    extraPages,
    extraPagesPriceCop,
    shippingCop,
    totalCop,
  }
}

/**
 * Genera una referencia única para una orden.
 * Formato: PIXIA-{bookId8}-{timestamp}
 */
export function generateOrderReference(bookId: string): string {
  const shortBookId = bookId.replace(/-/g, '').slice(0, 8).toUpperCase()
  const timestamp = Date.now()
  return `PIXIA-${shortBookId}-${timestamp}`
}
