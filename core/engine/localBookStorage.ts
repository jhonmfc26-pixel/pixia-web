import { PixiaBook } from '../domain/PixiaBook'

const STORAGE_KEY = 'pixia_books'

export function saveBookToLocal(book: PixiaBook): void {
  if (typeof window === 'undefined') return

  try {
    const data: Record<string, PixiaBook> = {}
    data[book.identity.bookId] = book
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.error('Error guardando libro:', e)
    throw e
  }
}

export function getBookFromLocal(bookId: string): PixiaBook | null {
  if (typeof window === 'undefined') return null

  const existing = localStorage.getItem(STORAGE_KEY)
  if (!existing) return null

  const books = JSON.parse(existing)

  return books[bookId] || null
}
