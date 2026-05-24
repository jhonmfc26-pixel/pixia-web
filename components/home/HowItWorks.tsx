import Reveal from '@/components/ui/Reveal'

const steps = [
  {
    number: '01',
    title: 'Sube tus fotos',
    description: 'Selecciona entre 5 y 30 fotos desde tu dispositivo. Arrastra para definir el orden.',
  },
  {
    number: '02',
    title: 'La IA construye tu libro',
    description: 'Pixia organiza, curada y diseña tu álbum con criterio editorial automáticamente.',
  },
  {
    number: '03',
    title: 'Revisa y ajusta',
    description: 'Previsualiza tu libro y realiza los cambios que quieras antes de confirmar.',
  },
  {
    number: '04',
    title: 'Recibe tu álbum',
    description: 'Tu libro impreso en papel premium llega a tu puerta en embalaje cuidado.',
  },
]

export default function HowItWorks() {
  return (
    <section
      id="como-funciona"
      style={{
        padding: '96px 24px',
        background: 'var(--bg-base)',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(28px, 4vw, 42px)',
              fontWeight: 500,
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
              marginBottom: '12px',
            }}>
              Cómo funciona
            </h2>
            <p style={{
              fontSize: '16px',
              color: 'var(--text-secondary)',
              fontWeight: 300,
              lineHeight: 1.7,
            }}>
              De tus fotos a un libro impreso en cuatro pasos simples
            </p>
          </div>
        </Reveal>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          position: 'relative',
        }}>
          {steps.map((step, index) => (
            <Reveal key={step.number} delay={0.1 + index * 0.1}>
              <div style={{
                padding: '0 32px 0 0',
                borderRight: index < steps.length - 1
                  ? '1px dashed rgba(255,255,255,0.1)'
                  : 'none',
                paddingRight: index < steps.length - 1 ? '32px' : '0',
                paddingLeft: index > 0 ? '32px' : '0',
              }}>
                <span style={{
                  display: 'block',
                  fontSize: '11px',
                  color: 'var(--text-tertiary)',
                  letterSpacing: '0.15em',
                  fontWeight: 400,
                  marginBottom: '16px',
                  fontFamily: 'var(--font-body)',
                }}>
                  {step.number}
                </span>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  marginBottom: '8px',
                  letterSpacing: '-0.01em',
                }}>
                  {step.title}
                </h3>
                <p style={{
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.65,
                  fontWeight: 300,
                }}>
                  {step.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
