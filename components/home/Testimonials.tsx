'use client'

import Reveal from '@/components/ui/Reveal'

const testimonials = [
  {
    name: 'Laura & Andrés',
    tag: 'Boda',
    initials: 'LA',
    text: 'Pixia transformó las fotos de nuestra boda en un libro que parece una película. Cada página cuenta nuestra historia con una calidad impresionante.',
  },
  {
    name: 'Camila R.',
    tag: 'Viaje',
    initials: 'CR',
    text: 'Revivir nuestro viaje por Europa a través de un álbum de Pixia fue emocionante. El diseño, los colores y la narrativa visual son simplemente perfectos.',
  },
  {
    name: 'Daniel & Sofía',
    tag: 'Aniversario',
    initials: 'DS',
    text: 'Regalamos un libro de Pixia a nuestros padres por su aniversario y fue un momento inolvidable. Un recuerdo que quedará para siempre.',
  },
]

export default function Testimonials() {
  return (
    <section
      id="ejemplos"
      style={{
        padding: '96px 24px',
        background: 'var(--bg-base)',
        borderTop: '1px solid var(--border-subtle)',
      }}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(28px, 4vw, 42px)',
              fontWeight: 500,
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
              marginBottom: '12px',
            }}>
              Historias reales
            </h2>
            <p style={{
              fontSize: '16px',
              color: 'var(--text-secondary)',
              fontWeight: 300,
              lineHeight: 1.7,
            }}>
              Recuerdos reales, cuidadosamente transformados en libros por Pixia.
            </p>
          </div>
        </Reveal>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px',
        }}>
          {testimonials.map((t, i) => (
            <Reveal key={i} delay={0.15 + i * 0.1}>
              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '28px',
              }}>
                {/* Puntos de rating */}
                <div style={{
                  display: 'flex',
                  gap: '4px',
                  marginBottom: '16px',
                }}>
                  {[...Array(5)].map((_, idx) => (
                    <span key={idx} style={{
                      width: '4px',
                      height: '4px',
                      borderRadius: '50%',
                      background: 'var(--brand-coral)',
                      display: 'inline-block',
                    }} />
                  ))}
                </div>

                <p style={{
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.7,
                  fontWeight: 300,
                  fontStyle: 'italic',
                  marginBottom: '24px',
                }}>
                  "{t.text}"
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Iniciales */}
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-medium)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 500,
                    color: 'var(--text-tertiary)',
                    letterSpacing: '0.05em',
                    flexShrink: 0,
                  }}>
                    {t.initials}
                  </div>
                  <div>
                    <p style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      marginBottom: '2px',
                    }}>
                      {t.name}
                    </p>
                    <p style={{
                      fontSize: '12px',
                      color: 'var(--text-tertiary)',
                      letterSpacing: '0.05em',
                    }}>
                      {t.tag}
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
