import type { Metadata } from 'next'

// Página privada del cliente: fuera de Google.
export const metadata: Metadata = {
  title: 'Finalizar compra',
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
