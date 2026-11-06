import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

export const metadata: Metadata = { robots: { index: false, follow: false } }

// Herramientas internas (/dev/ritmo, /dev/layouts): solo en `next dev`.
// En producción no existen para nadie.
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound()
  return children
}
