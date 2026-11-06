'use client'

import { ProgressBar } from '@/components/create/ProgressBar'
import { WizardProvider } from '@/components/create/WizardProvider'
import Link from 'next/link'

export default function CreateShell({ children }: { children: React.ReactNode }) {
  return (
    <WizardProvider>
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg-base)',
        color: 'var(--text-primary)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Progress bar sticky */}
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'var(--bg-base)',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <div className="px-4 py-4 sm:px-6" style={{ maxWidth: '960px', margin: '0 auto', position: 'relative' }}>
            <Link href="/" aria-label="Volver al inicio" className="absolute left-4 top-1/2 hidden -translate-y-1/2 lg:block sm:left-6"
              style={{ fontFamily: 'var(--font-display)', fontSize: '18px', color: 'var(--text-primary)', textDecoration: 'none' }}>
              Pixia
            </Link>
            <ProgressBar />
          </div>
        </div>

        {/* Content */}
        <main style={{ flex: 1, overflowY: 'auto' }}>
          <div className="px-4 pb-32 pt-10 sm:px-12 sm:pt-20" style={{
            maxWidth: '960px',
            margin: '0 auto',
          }}>
            {children}
          </div>
        </main>
      </div>
    </WizardProvider>
  )
}
