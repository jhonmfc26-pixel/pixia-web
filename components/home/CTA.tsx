'use client'

import Reveal from '@/components/ui/Reveal'
import Link from 'next/link'

export default function CTA() {
  return (
    <section style={{
      padding: '96px 24px',
      background: 'var(--bg-surface)',
      borderTop: '1px solid var(--border-subtle)',
    }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
        <Reveal>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(28px, 4vw, 44px)',
            fontWeight: 500,
            color: 'var(--text-primary)',
            lineHeight: 1.2,
            letterSpacing: '-0.01em',
            marginBottom: '16px',
          }}>
            Tu historia merece
            <br />
            <em style={{ fontStyle: 'italic', color: 'var(--brand-coral)' }}>
              ser recordada.
            </em>
          </h2>
        </Reveal>

        <Reveal delay={0.1}>
          <p style={{
            fontSize: '16px',
            color: 'var(--text-secondary)',
            fontWeight: 300,
            lineHeight: 1.7,
            marginBottom: '40px',
          }}>
            Convierte tus fotos en un libro físico, diseñado editorialmente,
            que podrás conservar, regalar y revivir toda la vida.
          </p>
        </Reveal>

        <Reveal delay={0.2}>
          <Link
            href="/create"
            style={{
              display: 'inline-block',
              padding: '14px 36px',
              borderRadius: '10px',
              background: 'var(--brand-coral)',
              color: 'var(--text-primary)',
              fontSize: '15px',
              fontWeight: 500,
              textDecoration: 'none',
              letterSpacing: '0.01em',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Crear mi álbum
          </Link>
        </Reveal>
      </div>
    </section>
  )
}
