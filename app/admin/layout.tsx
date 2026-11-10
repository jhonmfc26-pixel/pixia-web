import Link from 'next/link'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getAdmin } from '@/lib/admin/auth'

export const metadata: Metadata = {
  title: 'Pixia · Admin',
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await getAdmin(await headers())
  // 404 y no 401: no confirmar que el portal existe a quien no tiene acceso.
  if (!admin) notFound()

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <a href="/admin" className="flex items-baseline gap-2">
            <span className="font-[family-name:var(--font-display)] text-xl">Pixia</span>
            <span className="text-xs uppercase tracking-widest text-[var(--text-secondary)]">Admin</span>
          </a>
          <nav className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
            <a href="/admin" className="hover:text-white">Pedidos</a>
            <Link href="/admin/pqr" className="hover:text-white">PQR</Link>
            <Link href="/admin/almacenamiento" className="hover:text-white">Almacenamiento</Link>
            <span className="hidden truncate text-xs text-[var(--text-tertiary)] sm:inline">{admin.email}</span>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  )
}
