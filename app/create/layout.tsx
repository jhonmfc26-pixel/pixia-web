'use client'

import { ProgressBar } from '@/components/create/ProgressBar'
import { WizardProvider } from '@/components/create/WizardProvider'

export default function CreateLayout({ children }: { children: React.ReactNode }) {
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
          <div style={{ maxWidth: '960px', margin: '0 auto', padding: '16px 24px' }}>
            <ProgressBar />
          </div>
        </div>

        {/* Content */}
        <main style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{
            maxWidth: '960px',
            margin: '0 auto',
            padding: '80px 48px 48px',
          }}>
            {children}
          </div>
        </main>
      </div>
    </WizardProvider>
  )
}
