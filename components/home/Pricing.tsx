'use client'

import Reveal from '@/components/ui/Reveal'
import Link from 'next/link'
import { Check } from 'lucide-react'

const includes = [
  '20 páginas incluidas (10 spreads)',
  'Tapa dura premium con foto y texto',
  'Impresión de alta calidad en papel grueso',
  'Diseño editorial decidido por Pixia',
  'Envío a tu puerta en Colombia',
]

export default function Pricing() {
  return (
    <section
      id="precios"
      style={{
        padding: '96px 24px',
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border-subtle)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(28px, 4vw, 42px)',
              fontWeight: 500,
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
              marginBottom: '12px',
            }}>
              Precio claro, sin sorpresas
            </h2>
            <p style={{
              fontSize: '16px',
              color: 'var(--text-secondary)',
              fontWeight: 300,
              lineHeight: 1.7,
            }}>
              Un solo álbum, una calidad, un precio honesto.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '16px',
            padding: '40px 36px',
            position: 'relative',
          }}>
            {/* Header */}
            <div style={{
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: '24px',
              marginBottom: '24px',
            }}>
              <p style={{
                fontSize: '11px',
                color: 'var(--text-tertiary)',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                fontWeight: 500,
                marginBottom: '12px',
              }}>
                Álbum Pixia Cuadrado
              </p>
              <p style={{
                fontSize: '14px',
                color: 'var(--text-tertiary)',
                marginBottom: '20px',
                fontWeight: 300,
              }}>
                30 × 30 cm · Tapa dura · Lay-flat
              </p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '44px',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.02em',
                }}>
                  $250.000
                </span>
                <span style={{
                  fontSize: '14px',
                  color: 'var(--text-tertiary)',
                  fontWeight: 400,
                }}>
                  COP
                </span>
              </div>
              <p style={{
                fontSize: '13px',
                color: 'var(--text-tertiary)',
                marginTop: '8px',
                fontWeight: 300,
              }}>
                Páginas extra: $8.000 c/u (desde la página 21)
              </p>
            </div>

            {/* Incluye */}
            <ul style={{ listStyle: 'none', padding: 0, marginBottom: '32px' }}>
              {includes.map((item, i) => (
                <li
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    fontSize: '14px',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                    marginBottom: '12px',
                    fontWeight: 300,
                  }}
                >
                  <Check
                    size={16}
                    style={{ color: 'var(--brand-coral)', flexShrink: 0, marginTop: '3px' }}
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <Link
              href="/create"
              style={{
                display: 'block',
                textAlign: 'center',
                padding: '14px',
                borderRadius: '10px',
                background: 'var(--brand-coral)',
                color: 'var(--text-primary)',
                fontSize: '15px',
                fontWeight: 500,
                textDecoration: 'none',
                letterSpacing: '0.01em',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              Crear mi álbum
            </Link>

            <p style={{
              fontSize: '12px',
              color: 'var(--text-tertiary)',
              textAlign: 'center',
              marginTop: '16px',
              fontWeight: 300,
            }}>
              Pago seguro con Wompi · Tarjeta, PSE, Nequi
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
