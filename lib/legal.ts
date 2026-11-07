/**
 * Datos legales y condiciones comerciales de Pixia — UNA sola fuente para
 * /terminos, /privacidad, el pie de página y el checkout.
 *
 * ⚠️ Antes de abrir la venta al público hay que reemplazar los valores
 * marcados como PENDIENTE (los exige el art. 50 de la Ley 1480 de 2011 y el
 * art. 13 del Decreto 1377 de 2013, compilado en el Decreto 1074 de 2015).
 *
 * Si cambias las condiciones de fondo (plazos, garantía, cancelación…), sube
 * TERMS_VERSION: cada pedido guarda la versión que el cliente aceptó.
 */

export const TERMS_VERSION = '2026-11-06'
export const TERMS_UPDATED_LABEL = '6 de noviembre de 2026'

export const LEGAL_ENTITY = {
  brand: 'Pixia',
  /** Persona natural o jurídica que vende (como aparece en el RUT). */
  legalName: '[PENDIENTE: razón social o nombre del titular]',
  /** NIT (o cédula si es persona natural). */
  taxId: '[PENDIENTE: NIT]',
  address: '[PENDIENTE: dirección]',
  city: 'Bogotá D.C., Colombia',
  phone: '[PENDIENTE: teléfono / WhatsApp]',
  email: 'soporte@pixiaa.com',
  website: 'https://pixiaa.com',
} as const

/** Condiciones comerciales. Propuestas de Claude — Jhon las confirma. */
export const COMMERCIAL = {
  /** Plazo de entrega (máx. legal sin pacto: 30 días calendario — art. 50 lit. h). */
  deliveryLabel: 'hasta 15 días hábiles',
  deliveryMaxBusinessDays: 15,
  /** Garantía por defectos de impresión, encuadernación o materiales. */
  warrantyMonths: 6,
  /** Para reportar daños visibles del transporte, desde la entrega. */
  transportDamageBusinessDays: 5,
  /** Plazo para devolver dinero cuando proceda (Ley 2439 de 2024). */
  refundCalendarDays: 15,
  /** Respuesta a peticiones, quejas y reclamos. */
  pqrResponseBusinessDays: 15,
  coverage: 'todo el territorio colombiano',
} as const

export const SIC_URL = 'https://www.sic.gov.co'

export function isPlaceholder(value: string): boolean {
  return value.startsWith('[PENDIENTE')
}
