import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import Footer from '@/components/home/Footer'

export const metadata: Metadata = {
  title: 'Soporte · Peticiones, quejas y reclamos',
  description: 'Escríbenos tu pregunta, queja, reclamo o solicitud de garantía y recibe un número de radicado para hacerle seguimiento.',
  alternates: { canonical: '/soporte' },
}

export default function SoporteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <main className="min-h-[70vh] bg-[var(--bg-base)] px-4 pb-24 pt-10 text-[var(--text-primary)] sm:px-8">
        <div className="mx-auto max-w-2xl">
          <Link href="/" className="font-[family-name:var(--font-display)] text-xl text-white/85">Pixia</Link>
          {children}
        </div>
      </main>
      <Footer />
    </>
  )
}
