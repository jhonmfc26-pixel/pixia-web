'use client'

import Image from 'next/image'
import Reveal from '@/components/ui/Reveal'
import Link from 'next/link'

const occasions = [
  {
    id: 'boda',
    title: 'Boda',
    description: 'El día que decidieron pasar todas las páginas juntos.',
    image: '/story/wedding.jpg',
  },
  {
    id: 'viaje',
    title: 'Viaje',
    description: 'Los lugares se olvidan. Los álbumes no.',
    image: '/story/trip.jpg',
  },
  {
    id: 'aniversario',
    title: 'Aniversario',
    description: 'Para celebrar el tiempo compartido y el que viene.',
    image: '/story/anniversary.jpg',
  },
  {
    id: 'familia',
    title: 'Familia',
    description: 'Los momentos pequeños son los que más se extrañan.',
    image: '/story/other.jpg',
  },
]

export default function ExampleAlbums() {
  return (
    <section
      id="ejemplos"
      style={{
        padding: '80px 24px',
        background: 'var(--bg-base)',
        borderTop: '1px solid var(--border-subtle)',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
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
              Hecho para tus momentos
            </h2>
            <p style={{
              fontSize: '16px',
              color: 'var(--text-secondary)',
              fontWeight: 300,
              lineHeight: 1.7,
            }}>
              Cada ocasión, contada con la cadencia que merece.
            </p>
          </div>
        </Reveal>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '20px',
          maxWidth: '1100px',
          margin: '0 auto',
        }}>
          {occasions.map((occ, i) => (
            <Reveal key={occ.id} delay={0.1 + i * 0.08}>
              <div
                style={{
                  background: 'var(--bg-surface)',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  border: '1px solid var(--border-subtle)',
                  transition: 'transform 0.3s ease, border-color 0.3s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.borderColor = 'var(--border-medium)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.borderColor = 'var(--border-subtle)'
                }}
              >
                <div style={{
                  width: '100%',
                  aspectRatio: '3 / 4',
                  position: 'relative',
                  overflow: 'hidden',
                  background: 'var(--bg-elevated)',
                }}>
                  <Image
                    src={occ.image}
                    alt={`Ejemplo de álbum ${occ.title}`}
                    fill
                    sizes="(max-width: 768px) 100vw, 320px"
                    style={{ objectFit: 'cover' }}
                  />
                </div>

                <div style={{ padding: '24px 22px' }}>
                  <p style={{
                    fontSize: '11px',
                    color: 'var(--text-tertiary)',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    fontWeight: 500,
                    marginBottom: '8px',
                  }}>
                    Álbum {occ.title}
                  </p>
                  <p style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '17px',
                    fontStyle: 'italic',
                    color: 'var(--text-primary)',
                    lineHeight: 1.4,
                    fontWeight: 400,
                  }}>
                    {occ.description}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.4}>
          <div style={{ textAlign: 'center', marginTop: '56px' }}>
            <Link
              href="/create"
              style={{
                display: 'inline-block',
                padding: '12px 28px',
                borderRadius: '8px',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                fontWeight: 500,
                textDecoration: 'none',
                transition: 'border-color 0.2s, background 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--brand-coral)'
                e.currentTarget.style.background = 'rgba(232,85,58,0.05)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border-medium)'
                e.currentTarget.style.background = 'transparent'
              }}
            >
              Crear el mío
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
