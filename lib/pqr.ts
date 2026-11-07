/**
 * Peticiones, quejas y reclamos (PQR). La Ley 2439 de 2024 exige que cada
 * reclamación quede radicada con número, fecha y hora, y que el consumidor
 * pueda hacerle seguimiento. Lógica pura (tipos, validación, radicado).
 */
import { addBusinessDays, bogotaDate } from './businessDays'

export const PQR_TYPES = {
  peticion: { label: 'Pregunta o petición', days: 15 },
  queja: { label: 'Queja', days: 15 },
  reclamo: { label: 'Reclamo', days: 15 },
  garantia: { label: 'Garantía (defecto o daño del álbum)', days: 15 },
  cancelacion: { label: 'Cancelar mi pedido', days: 15 },
  reversion: { label: 'Reversión del pago', days: 15 },
  datos_consulta: { label: 'Mis datos personales: consulta', days: 10 },
  datos_reclamo: { label: 'Mis datos personales: corregir, eliminar o revocar', days: 15 },
} as const satisfies Record<string, { label: string; days: number }>

export type PqrType = keyof typeof PQR_TYPES

export const PQR_STATUSES = ['recibido', 'en_tramite', 'respondido'] as const
export type PqrStatus = typeof PQR_STATUSES[number]

export const PQR_STATUS_LABEL: Record<PqrStatus, string> = {
  recibido: 'Recibido',
  en_tramite: 'En trámite',
  respondido: 'Respondido',
}

export function isPqrType(t: unknown): t is PqrType {
  return typeof t === 'string' && Object.prototype.hasOwnProperty.call(PQR_TYPES, t)
}
export function isPqrStatus(s: unknown): s is PqrStatus {
  return typeof s === 'string' && (PQR_STATUSES as readonly string[]).includes(s)
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sin 0/O ni 1/I

/** PQR-20261106-7KQ2MX. La fecha es la de Bogotá. */
export function generateRadicado(at: Date = new Date(), rand: (n: number) => Uint8Array = n => crypto.getRandomValues(new Uint8Array(n))): string {
  const d = bogotaDate(at).toISOString().slice(0, 10).replace(/-/g, '')
  const code = Array.from(rand(6), b => ALPHABET[b % ALPHABET.length]).join('')
  return `PQR-${d}-${code}`
}

export function normalizeRadicado(r: string): string {
  return r.trim().toUpperCase().replace(/\s+/g, '')
}

/** Fecha límite legal de respuesta (último día hábil del plazo). */
export function pqrDeadline(type: PqrType, createdAt: Date): Date {
  return addBusinessDays(bogotaDate(createdAt), PQR_TYPES[type].days)
}

export interface PqrInput {
  type: PqrType
  name: string
  email: string
  phone: string | null
  orderReference: string | null
  message: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function parsePqrInput(raw: Record<string, unknown>): { ok: true; value: PqrInput } | { ok: false; error: string } {
  const str = (k: string) => String(raw[k] ?? '').trim()
  const type = str('type')
  const name = str('name')
  const email = str('email').toLowerCase()
  const phone = str('phone')
  const order = str('orderReference').toUpperCase()
  const message = str('message')

  if (!isPqrType(type)) return { ok: false, error: 'Elige el tipo de solicitud.' }
  if (name.length < 2 || name.length > 120) return { ok: false, error: 'Escribe tu nombre.' }
  if (!EMAIL_RE.test(email) || email.length > 200) return { ok: false, error: 'Escribe un correo válido.' }
  if (phone.length > 30) return { ok: false, error: 'El teléfono es demasiado largo.' }
  if (order.length > 60) return { ok: false, error: 'El número de orden es demasiado largo.' }
  if (message.length < 10) return { ok: false, error: 'Cuéntanos un poco más (al menos 10 caracteres).' }
  if (message.length > 5000) return { ok: false, error: 'El mensaje es demasiado largo (máximo 5.000 caracteres).' }

  return { ok: true, value: { type, name, email, phone: phone || null, orderReference: order || null, message } }
}

/** Fecha y hora de radicación legible, en hora de Colombia. */
export function formatBogotaDateTime(iso: string | Date): string {
  return new Date(iso).toLocaleString('es-CO', {
    timeZone: 'America/Bogota', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}
