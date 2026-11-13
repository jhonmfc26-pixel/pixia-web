/**
 * El álbum que se cobra es exactamente el que se imprime.
 *
 * Lógica pura (lib/orderAlbum.test.ts) que usan /api/orders/create y el
 * webhook de Wompi:
 *
 *  1. Al crear la orden, el álbum se arma EN EL SERVIDOR: si ya está guardado
 *     en la cuenta manda esa fila (lo que el cliente ve en el visor y en el
 *     checkout); si no, lo que envía el navegador. De ahí salen el precio y la
 *     copia que se guarda con la orden (orders.book_snapshot).
 *  2. Al aprobarse el pago, el álbum se congela con esa copia. Si el cliente lo
 *     editó en otra pestaña entre crear la orden y pagar, se imprime lo que
 *     pagó — nunca más páginas ni otro tamaño.
 *
 * El armado usa buildPrintJobInput, el mismo que usa el contenedor de PDF:
 * las páginas que se cobran son las que el PDF va a tener.
 */
import type { AlbumBlueprint, CoverConfig } from '@/core/contracts/AlbumBlueprint'
import type { AlbumStructure, Face, Fold } from '@/core/modules/foldModel/types'
import { isOrdered } from '@/core/modules/album/orderLock'
import { normalizeBook } from '@/core/modules/album/normalizeBook'
import { buildPrintJobInput } from '@/core/modules/print/buildPrintJobInput'
import { countRealPages } from '@/core/modules/foldModel/validate'
import { validateAlbumStructure } from '@/core/modules/foldModel/validateStructure'
import { resolveCover } from '@/core/modules/cover/coverDesign'
import { formatOfBook, MIN_ALBUM_PAGES, type AlbumFormat } from '@/lib/formats'

/** Lo mínimo de la fila de `blueprints` que hace falta para decidir. */
export interface StoredBlueprint {
  user_id: string | null
  status: string | null
  [column: string]: unknown
}

/** Copia del álbum que se cobró. Es JSON plano: se guarda en orders.book_snapshot. */
export interface OrderSnapshot {
  id: string
  occasion: string
  format: string
  style: string
  pageCount: number
  cover: CoverConfig
  spreads: AlbumBlueprint['spreads']
  structure: AlbumStructure
  narrative: unknown
  version: number
  aiGenerated: boolean
}

export type OrderAlbumResult =
  | {
      ok: true; snapshot: OrderSnapshot; pages: number; format: AlbumFormat
      /**
       * Qué hacer con la fila del álbum antes de crear la orden:
       *  - 'create': no existe, se guarda completa.
       *  - 'claim':  existe sin dueño, se reescribe con esta copia y pasa a ser de quien paga.
       *  - 'keep':   ya es del cliente; su contenido no se toca (solo se fija la estructura cobrada).
       */
      save: 'create' | 'claim' | 'keep'
    }
  | { ok: false; status: 400 | 403 | 409; error: string }

const facesOf = (fold: Fold): Face[] => (fold.kind === 'paired' ? [fold.left, fold.right] : [fold.face])

/** Ids de las fotos que de verdad se imprimen (las colocadas en alguna página). */
export function printedPhotoIds(structure: AlbumStructure): string[] {
  const ids = new Set<string>()
  for (const fold of structure.folds) {
    for (const face of facesOf(fold)) {
      if (face.kind === 'dedication') {
        if (face.dedication?.photoId) ids.add(face.dedication.photoId)
      } else {
        for (const id of face.photoIds) ids.add(id)
      }
    }
  }
  return [...ids]
}

/** Una foto subida vive en una URL https; una que no subió queda como data:/blob: o vacía. */
export const isUploadedUrl = (url: unknown): boolean => typeof url === 'string' && /^https:\/\/\S+$/.test(url)

export function resolveOrderAlbum(input: {
  /** Fila guardada del álbum, o null si todavía no existe. */
  row: StoredBlueprint | null
  /** El álbum que envía el navegador (solo se usa si no hay fila). */
  snapshot: unknown
  bookId: string
  userId: string
}): OrderAlbumResult {
  const { row, snapshot, bookId, userId } = input

  if (row) {
    if (row.user_id && row.user_id !== userId) return { ok: false, status: 403, error: 'No autorizado' }
    // Pagado = congelado. Tampoco se vuelve a cobrar.
    if (isOrdered(row.status)) {
      return { ok: false, status: 409, error: 'Este álbum ya fue pedido. Lo encuentras en «Mis álbumes».' }
    }
  }

  // Una fila sin dueño (álbumes de antes de que guardar exigiera sesión) no la
  // puede leer el navegador de nadie: el checkout muestra la copia local, así
  // que esa es la que se cobra y con la que se reclama la fila.
  const stored = row?.user_id ? row : null
  const source = stored ?? snapshot
  if (!source || typeof source !== 'object') return { ok: false, status: 400, error: 'Datos del libro incompletos' }

  let built: ReturnType<typeof buildPrintJobInput>
  try {
    built = buildPrintJobInput(source, bookId)
  } catch {
    return { ok: false, status: 400, error: 'No pudimos leer tu álbum. Ábrelo de nuevo e inténtalo otra vez.' }
  }
  if (!built.ok) return { ok: false, status: 400, error: 'Tu álbum no tiene páginas todavía.' }
  const { structure, photos, cover } = built.input

  const format = formatOfBook(built.input.format)
  if (!format.available) {
    return { ok: false, status: 400, error: `El formato ${format.sizeLabel} todavía no está disponible.` }
  }

  const pages = countRealPages(structure)
  if (pages < MIN_ALBUM_PAGES) {
    return { ok: false, status: 400, error: `Tu álbum tiene ${pages} páginas y el mínimo para imprimirlo es ${MIN_ALBUM_PAGES}.` }
  }

  // Ninguna foto a medio subir llega a la imprenta: saldría pixelada o en blanco.
  const needed = printedPhotoIds(structure)
  if (resolveCover(cover).kind === 'photo' && built.input.coverPhoto) needed.push(built.input.coverPhoto.id)
  const missing = new Set(needed.filter(id => !isUploadedUrl(photos[id]?.url)))
  if (missing.size > 0) {
    const n = missing.size
    return {
      ok: false, status: 409,
      error: `${n === 1 ? 'Una foto de tu álbum no terminó' : `${n} fotos de tu álbum no terminaron`} de subir. Ábrelo en el editor, cámbiala${n === 1 ? '' : 's'} o vuelve a subirla${n === 1 ? '' : 's'}, y regresa a pagar.`,
    }
  }

  // Misma normalización que usa el armado del PDF: de acá salen las columnas del álbum.
  const book = normalizeBook(source, bookId)
  const snap: OrderSnapshot = {
    id: bookId,
    occasion: book.occasion,
    format: built.input.format,
    style: book.style,
    pageCount: pages,
    cover,
    spreads: book.spreads,
    structure,
    narrative: book.narrative ?? {},
    version: typeof book.version === 'number' ? book.version : 1,
    aiGenerated: Boolean(book.aiGenerated ?? (source as { ai_generated?: unknown }).ai_generated),
  }
  return { ok: true, snapshot: toPlainJson(snap), pages, format, save: stored ? 'keep' : row ? 'claim' : 'create' }
}

/** Sin Map, Date ni undefined: lo que de verdad queda guardado en la base. */
function toPlainJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/**
 * Lo que el navegador mostró antes de pagar tiene que ser lo que se cobra.
 * Si el álbum cambió desde que se abrió el checkout (otra pestaña, otro
 * dispositivo), se pide recargar en vez de cobrar otro precio.
 */
export function matchesWhatClientSaw(
  album: { pages: number; format: AlbumFormat },
  client: { pagesTotal: unknown; format: unknown },
): boolean {
  const samePages = Number(client.pagesTotal) === album.pages
  const sameFormat = formatOfBook(typeof client.format === 'string' ? client.format : null).id === album.format.id
  return samePages && sameFormat
}

/** Columnas de `blueprints` para guardar el álbum por primera vez (todavía borrador). */
export function blueprintInsertColumns(s: OrderSnapshot, owner: { userId: string; sessionId: string }) {
  return {
    id: s.id,
    user_id: owner.userId,
    session_id: owner.sessionId,
    status: 'draft',
    occasion: s.occasion,
    version: s.version,
    ai_generated: s.aiGenerated,
    ...contentColumns(s),
  }
}

/** ¿Es una copia de las que arma resolveOrderAlbum? (las órdenes viejas guardaban lo que mandaba el navegador). */
export function isOrderSnapshot(raw: unknown): raw is OrderSnapshot {
  return frozenBlueprintColumns(raw) !== null
}

function contentColumns(s: OrderSnapshot) {
  return {
    format: s.format,
    style: s.style,
    page_count: s.pageCount,
    cover: s.cover,
    spreads: s.spreads,
    structure: s.structure,
    narrative: s.narrative,
  }
}

/**
 * Columnas con las que se congela el álbum al aprobarse el pago, a partir de
 * orders.book_snapshot. Devuelve null si la copia no es de las que arma
 * resolveOrderAlbum (órdenes creadas antes de 2026-11-13): en ese caso solo
 * se marca el estado y el álbum queda como esté.
 */
export function frozenBlueprintColumns(rawSnapshot: unknown): ReturnType<typeof contentColumns> | null {
  if (!rawSnapshot || typeof rawSnapshot !== 'object') return null
  const s = rawSnapshot as Partial<OrderSnapshot>
  if (!Array.isArray(s.spreads) || !s.cover || typeof s.format !== 'string' || typeof s.style !== 'string') return null
  const known = new Set<string>()
  for (const spread of s.spreads) for (const p of spread?.photos ?? []) known.add(p.id)
  if (!validateAlbumStructure(s.structure, known).ok) return null
  const structure = s.structure as AlbumStructure
  return contentColumns({ ...(s as OrderSnapshot), structure, pageCount: countRealPages(structure) })
}
