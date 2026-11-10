/**
 * Política de conservación de Pixia (decisión de Jhon, 2026-11-09) — qué se
 * borra del almacenamiento y cuándo. Puro y testeable (lib/retention.test.ts);
 * el contenedor de PDF (services/pdf-render-container/src/storage.ts) hace la
 * I/O: lista R2, lee Supabase, llama a planCleanup y ejecuta el plan.
 *
 *  - Álbum SIN pedido pagado: se guarda (y se puede editar) 30 días desde que
 *    se creó. Después se borran sus fotos y su fila.
 *  - Álbum CON pedido pagado: se guarda mientras el pedido está en curso y
 *    hasta 30 días después de la entrega (garantía). Después se borran sus
 *    fotos y su PDF; la fila del pedido se conserva (normas contables).
 *
 * Seguridad — borrar fotos no tiene vuelta atrás:
 *  - Solo se tocan fotos bajo `users/` del bucket público (nunca logos ni
 *    fotos de la home) y, en el bucket privado, PDFs.
 *  - Ninguna foto ni PDF de menos de 30 días se borra, aunque nada la
 *    referencie (cubre los borradores anónimos, que solo viven en el
 *    navegador del cliente y no tienen fila en Supabase).
 *  - Una foto se protege si su clave aparece en un álbum vigente, Y también
 *    si su CARPETA de sesión (users/<sesión>/) tiene alguna foto de un álbum
 *    vigente: si una referencia viniera en un formato que la extracción no
 *    reconoce, igual queda protegida por su carpeta.
 */

export const DAY_MS = 24 * 60 * 60 * 1000

export interface RetentionConfig {
  /** Días que se guarda un álbum sin comprar, desde su creación. */
  draftDays: number
  /** Días después de la entrega que se guarda un álbum comprado. */
  warrantyDays: number
}

export interface StoredObject {
  key: string
  size: number
  lastModified: Date
}

export interface BlueprintInfo {
  id: string
  createdAt: Date
  /** Claves de fotos referenciadas (ver extractPhotoKeys). */
  photoKeys: string[]
}

export interface OrderInfo {
  id: string
  bookId: string | null
  paymentStatus: string | null
  deliveredAt: Date | null
  assetsPurgedAt: Date | null
  /** Claves de fotos del snapshot que se cobró. */
  photoKeys: string[]
}

export interface CleanupPlan {
  deletePhotos: StoredObject[]
  deletePdfs: StoredObject[]
  /** Borradores vencidos (sin pedido pagado): se borra la fila. */
  deleteBlueprintIds: string[]
  /** Pedidos entregados hace más de la garantía cuyos archivos se borran ahora. */
  purgeOrderIds: string[]
  keptPhotos: { objects: number; bytes: number }
  keptPdfs: { objects: number; bytes: number }
  /** Álbumes vigentes por tipo, para el reporte. */
  counts: { draftsActive: number; draftsExpired: number; ordersActive: number; ordersExpired: number }
}

/** Claves `users/<sesión>/original/<foto>` dentro de cualquier JSON (URLs o claves sueltas). */
const KEY_RE = /users\/[0-9a-fA-F-]{36}\/original\/[^"'\s?#\\)]+/g

export function extractPhotoKeys(value: unknown): string[] {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '')
  return [...new Set(text.match(KEY_RE) ?? [])]
}

export const sessionOf = (key: string) => key.split('/').slice(0, 2).join('/') // "users/<sesión>"
const isPaid = (o: OrderInfo) => o.paymentStatus === 'approved'

export function planCleanup(
  input: { blueprints: BlueprintInfo[]; orders: OrderInfo[]; photos: StoredObject[]; pdfs: StoredObject[] },
  now: Date,
  config: RetentionConfig,
): CleanupPlan {
  const ageDays = (d: Date) => (now.getTime() - d.getTime()) / DAY_MS

  // Pedidos pagados: vigentes hasta `warrantyDays` después de la entrega.
  const paidByBook = new Map<string, OrderInfo[]>()
  for (const o of input.orders) {
    if (!isPaid(o) || !o.bookId) continue
    paidByBook.set(o.bookId, [...(paidByBook.get(o.bookId) ?? []), o])
  }
  const orderActive = (o: OrderInfo) => !o.deliveredAt || ageDays(o.deliveredAt) < config.warrantyDays

  const protectedKeys = new Set<string>()
  const protectedBooks = new Set<string>() // álbumes cuyos PDFs se guardan
  const counts = { draftsActive: 0, draftsExpired: 0, ordersActive: 0, ordersExpired: 0 }
  const purgeOrderIds: string[] = []

  for (const o of input.orders) {
    if (!isPaid(o)) continue
    if (orderActive(o)) {
      counts.ordersActive++
      o.photoKeys.forEach(k => protectedKeys.add(k))
      if (o.bookId) protectedBooks.add(o.bookId)
    } else {
      counts.ordersExpired++
      if (!o.assetsPurgedAt) purgeOrderIds.push(o.id)
    }
  }

  const deleteBlueprintIds: string[] = []
  for (const b of input.blueprints) {
    const orders = paidByBook.get(b.id)
    if (orders) {
      // Con pedido pagado: vigente si alguno de sus pedidos lo está.
      if (orders.some(orderActive)) b.photoKeys.forEach(k => protectedKeys.add(k))
      continue // la fila de un álbum comprado nunca se borra (el admin la usa)
    }
    if (ageDays(b.createdAt) < config.draftDays) {
      counts.draftsActive++
      b.photoKeys.forEach(k => protectedKeys.add(k))
    } else {
      counts.draftsExpired++
      deleteBlueprintIds.push(b.id)
    }
  }

  const protectedSessions = new Set([...protectedKeys].map(sessionOf))
  const minAge = Math.min(config.draftDays, config.warrantyDays)

  const deletePhotos: StoredObject[] = []
  const keptPhotos = { objects: 0, bytes: 0 }
  for (const obj of input.photos) {
    const deletable =
      obj.key.startsWith('users/') &&
      ageDays(obj.lastModified) >= minAge &&
      !protectedKeys.has(obj.key) &&
      !protectedSessions.has(sessionOf(obj.key))
    if (deletable) deletePhotos.push(obj)
    else { keptPhotos.objects++; keptPhotos.bytes += obj.size }
  }

  // PDFs: `<albumId>/interior/final.pdf`, `<albumId>/cover/final.pdf` (y
  // restos viejos bajo la misma carpeta). Se guardan los de álbumes vigentes.
  const deletePdfs: StoredObject[] = []
  const keptPdfs = { objects: 0, bytes: 0 }
  for (const obj of input.pdfs) {
    const albumId = obj.key.split('/')[0]
    const deletable = !protectedBooks.has(albumId) && ageDays(obj.lastModified) >= minAge
    if (deletable) deletePdfs.push(obj)
    else { keptPdfs.objects++; keptPdfs.bytes += obj.size }
  }

  return { deletePhotos, deletePdfs, deleteBlueprintIds, purgeOrderIds, keptPhotos, keptPdfs, counts }
}

/** Días que le quedan a un borrador (sin pedido pagado) antes de borrarse. Negativo = vencido. */
export function draftDaysLeft(createdAt: Date | string, now: Date, draftDays: number): number {
  const created = new Date(createdAt).getTime()
  if (!Number.isFinite(created)) return draftDays
  return Math.ceil(draftDays - (now.getTime() - created) / DAY_MS)
}

export const GB = 1024 ** 3
/** R2 Standard (2026): 10 GB-mes gratis, luego US$0,015 por GB-mes, sin costo de salida. */
export function r2MonthlyCostUsd(bytes: number): number {
  return Math.max(0, bytes / GB - 10) * 0.015
}
