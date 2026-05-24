import { PixiaBook } from '../domain/PixiaBook'

const STORAGE_KEY = 'pixia_books'

export function saveBookToLocal(book: PixiaBook) {
  if (typeof window === 'undefined') return

  const existing = localStorage.getItem(STORAGE_KEY)
  const books = existing ? JSON.parse(existing) : {}

  books[book.identity.bookId] = book

  localStorage.setItem(STORAGE_KEY, JSON.stringify(books))
}

export function getBookFromLocal(bookId: string): PixiaBook | null {
  if (typeof window === 'undefined') return null

  const existing = localStorage.getItem(STORAGE_KEY)
  if (!existing) return null

  const books = JSON.parse(existing)

  return books[bookId] || null
}
