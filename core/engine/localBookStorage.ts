import { PixiaBook } from '../domain/PixiaBook'

/**
 * Copia local del álbum antes de que el cliente inicie sesión (después vive en
 * Supabase). Va en IndexedDB y no en localStorage: Safari en iPhone da ~5 MB
 * de localStorage por sitio y un álbum con fotos en base64 no cabía ("Tu
 * navegador se quedó sin espacio" con 18 fotos). IndexedDB permite cientos de MB.
 *
 * Si IndexedDB no está disponible se usa localStorage como antes, y la lectura
 * también mira ahí para no perder álbumes guardados con la versión anterior.
 */

const LEGACY_KEY = 'pixia_books'
const DB_NAME = 'pixia'
const STORE = 'books'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawBook = Record<string, any>

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB no disponible'))
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idb<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const req = run(tx.objectStore(STORE))
      tx.oncomplete = () => resolve(req.result)
      tx.onerror = () => reject(tx.error ?? req.error)
      tx.onabort = () => reject(tx.error ?? new Error('Transacción abortada'))
    })
  } finally {
    db.close()
  }
}

function readLegacy(): Record<string, RawBook> {
  try {
    return JSON.parse(localStorage.getItem(LEGACY_KEY) || '{}')
  } catch {
    return {}
  }
}

/** Guarda (o reemplaza) el álbum. Lanza si no se pudo guardar en ningún lado. */
export async function saveBookToLocal(book: PixiaBook | RawBook, id?: string): Promise<void> {
  if (typeof window === 'undefined') return
  const key = id ?? (book as PixiaBook).identity?.bookId ?? (book as RawBook).id
  try {
    // Se clona a JSON plano: lo mismo que antes iba a localStorage (sin Maps ni Dates).
    await idb('readwrite', s => s.put(JSON.parse(JSON.stringify(book)), key))
    // Ya no hace falta la copia vieja; libera espacio de localStorage.
    try { localStorage.removeItem(LEGACY_KEY) } catch { /* no importa */ }
    return
  } catch (e) {
    console.warn('[localBook] IndexedDB falló, uso localStorage:', e)
  }
  localStorage.setItem(LEGACY_KEY, JSON.stringify({ [key]: book }))
}

/** El álbum guardado localmente (formato crudo, pasar por normalizeBook). */
export async function getLocalBook(bookId: string): Promise<RawBook | null> {
  if (typeof window === 'undefined') return null
  try {
    const b = await idb<RawBook | undefined>('readonly', s => s.get(bookId))
    if (b) return b
  } catch (e) {
    console.warn('[localBook] IndexedDB lectura:', e)
  }
  return readLegacy()[bookId] ?? null
}

/** Mezcla `patch` sobre el álbum local (lo crea si no existía). */
export async function updateLocalBook(bookId: string, patch: RawBook): Promise<void> {
  const current = (await getLocalBook(bookId)) ?? {}
  await saveBookToLocal({ ...current, ...patch }, bookId)
}

/** Compatibilidad: lectura síncrona solo de la copia vieja en localStorage. */
export function getBookFromLocal(bookId: string): PixiaBook | null {
  if (typeof window === 'undefined') return null
  return (readLegacy()[bookId] as PixiaBook) ?? null
}
