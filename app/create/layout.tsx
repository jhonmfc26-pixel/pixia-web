import type { Metadata } from 'next'
import CreateShell from './CreateShell'

export const metadata: Metadata = {
  title: 'Crea tu álbum',
  robots: { index: false, follow: false },
}

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return <CreateShell>{children}</CreateShell>
}
