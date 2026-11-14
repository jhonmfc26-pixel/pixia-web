/**
 * Helpers para integración con Wompi.
 * Documentación: https://docs.wompi.co
 */

import { DEFAULT_FORMAT_ID, PAGES_INCLUDED, getFormat, type AlbumFormatId } from '@/lib/formats'
import { wompiApiUrl } from '@/lib/wompiConfig'


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
    // Producción o sandbox según la llave privada (ver wompiApiUrl).
    const response = await fetch(`${wompiApiUrl()}/transactions/${encodeURIComponent(transactionId)}`, {
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

/** Orden de preferencia cuando una referencia tiene varias transacciones. */
const STATUS_RANK: Record<string, number> = { APPROVED: 0, PENDING: 1, VOIDED: 2, DECLINED: 3, ERROR: 4 }

/**
 * Busca en Wompi la transacción de una referencia (cuando no se conoce su id:
 * el cliente cerró el navegador antes de volver de pagar y el aviso de Wompi
 * no llegó). Requiere la llave privada.
 *
 * Devuelve `undefined` si Wompi no tiene ninguna transacción con esa
 * referencia y `null` si no se pudo consultar. Solo se aceptan transacciones
 * cuya referencia coincide exactamente, aunque Wompi devolviera otras.
 */
export async function findTransactionByReference(
  reference: string,
): Promise<WompiTransactionStatus | null | undefined> {
  try {
    const response = await fetch(`${wompiApiUrl()}/transactions?reference=${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${process.env.WOMPI_PRIVATE_KEY}` },
    })
    if (!response.ok) {
      console.error('[Wompi] findTransactionByReference error:', response.status)
      return null
    }
    const json = await response.json() as { data?: unknown }
    const list = (Array.isArray(json.data) ? json.data : []) as WompiTransactionStatus[]
    const mine = list.filter(t => t && t.reference === reference && typeof t.id === 'string')
    if (mine.length === 0) return undefined
    return mine.sort((a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9))[0]
  } catch (err) {
    console.error('[Wompi] findTransactionByReference exception:', err)
    return null
  }
}

/**
 * Modelo de precio oficial — fijo, no configurable por variable de entorno.
 * (Antes leía de NEXT_PUBLIC_BASE_PRICE_COP/NEXT_PUBLIC_SHIPPING_COP con
 * defaults desactualizados — un env var mal seteado en producción bastaba
 * para cobrar mal. Este es el precio real del producto, se cambia en código.)
 *
 * El precio base depende del formato (lib/formats.ts); las páginas incluidas,
 * la página extra y el envío son iguales para los tres.
 */
const EXTRA_PAGE_PRICE_COP = 8_000 // por página adicional a las 20 incluidas
const SHIPPING_COP = 0             // envío gratis, siempre incluido en el precio base

/** Para mostrar en la web (términos, precios) — mismos valores que se cobran. basePriceCop = el del 30×30. */
export const PRICING = {
  basePriceCop: getFormat(DEFAULT_FORMAT_ID).priceCop,
  pagesIncluded: PAGES_INCLUDED,
  extraPagePriceCop: EXTRA_PAGE_PRICE_COP,
  shippingCop: SHIPPING_COP,
} as const

/**
 * Calcula el precio total de un álbum a partir del número REAL de páginas
 * (ver countRealPages en foldModel/validate.ts) — nunca de un número que
 * mande el cliente sin verificar — y del formato del álbum.
 */
export function calculateOrderTotal(pagesTotal: number, formatId: AlbumFormatId = DEFAULT_FORMAT_ID): {
  formatId: AlbumFormatId
  basePriceCop: number
  pagesIncluded: number
  extraPages: number
  extraPagesPriceCop: number
  shippingCop: number
  totalCop: number
} {
  const basePriceCop = getFormat(formatId).priceCop
  const extraPages = Math.max(0, pagesTotal - PAGES_INCLUDED)
  const extraPagesPriceCop = extraPages * EXTRA_PAGE_PRICE_COP
  const totalCop = basePriceCop + extraPagesPriceCop + SHIPPING_COP

  return {
    formatId: getFormat(formatId).id,
    basePriceCop,
    pagesIncluded: PAGES_INCLUDED,
    extraPages,
    extraPagesPriceCop,
    shippingCop: SHIPPING_COP,
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
