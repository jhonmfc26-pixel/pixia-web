import Link from 'next/link'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getAdmin } from '@/lib/admin/auth'
import { emailFrom, emailInTestMode } from '@/lib/emailFrom'
import { wompiSetup } from '@/lib/wompiConfig'

export const metadata: Metadata = {
  title: 'Pixia · Admin',
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await getAdmin(await headers())
  // 404 y no 401: no confirmar que el portal existe a quien no tiene acceso.
  if (!admin) notFound()
  const wompi = wompiSetup()

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <a href="/admin" className="flex items-baseline gap-2">
            <span className="font-[family-name:var(--font-display)] text-xl">Pixia</span>
            <span className="text-xs uppercase tracking-widest text-[var(--text-secondary)]">Admin</span>
          </a>
          <nav className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--text-secondary)]">
            <a href="/admin" className="hover:text-white">Pedidos</a>
            <Link href="/admin/pqr" className="hover:text-white">PQR</Link>
            <Link href="/admin/portadas" className="hover:text-white">Portadas</Link>
            <Link href="/admin/almacenamiento" className="hover:text-white">Almacenamiento</Link>
            <Link href="/admin/lanzamiento" className="hover:text-white">Lanzamiento</Link>
            <span className="hidden truncate text-xs text-[var(--text-tertiary)] sm:inline">{admin.email}</span>
          </nav>
        </div>
      </header>
      {emailInTestMode() && (
        <div className="border-b border-amber-400/30 bg-amber-500/10">
          <p className="mx-auto max-w-7xl px-4 py-2.5 text-sm leading-relaxed text-amber-100 sm:px-6">
            <strong>Los correos a clientes no están saliendo.</strong> La web envía desde <code>{emailFrom()}</code>, la dirección de prueba
            de Resend, que solo entrega a tu propio correo. La variable <code>EMAIL_FROM</code> no está llegando a esta versión de la web:
            revísala en Cloudflare (entorno <em>Production</em>) y vuelve a desplegar.
          </p>
        </div>
      )}
      {wompi.mode !== 'produccion' && (
        <div className={`border-b ${wompi.mode === 'mal' ? 'border-red-400/30 bg-red-500/10' : 'border-sky-400/20 bg-sky-500/10'}`}>
          <p className={`mx-auto max-w-7xl px-4 py-2 text-sm leading-relaxed sm:px-6 ${wompi.mode === 'mal' ? 'text-red-100' : 'text-sky-100'}`}>
            {wompi.mode === 'mal'
              ? <><strong>Wompi está mal configurado: los pagos no se van a aprobar.</strong> {wompi.problems.join(' ')}</>
              : <><strong>Pagos en modo de pruebas.</strong> Las llaves de Wompi son de sandbox: no se cobra dinero real.</>}{' '}
            <Link href="/admin/lanzamiento" className="underline underline-offset-2">Ver paso a producción</Link>
          </p>
        </div>
      )}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  )
}
