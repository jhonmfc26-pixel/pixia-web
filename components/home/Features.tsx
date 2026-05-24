import { Sparkles, Clock, Heart, Package } from 'lucide-react'
import Reveal from '@/components/ui/Reveal'

const features = [
  {
    icon: Sparkles,
    title: 'Diseño editorial con IA',
    description: 'La IA analiza tus fotos, selecciona los mejores momentos y construye una maquetación automáticamente.',
  },
  {
    icon: Clock,
    title: 'Listo en minutos',
    description: 'Sube tus fotos y recibe un libro completamente diseñado en menos de 5 minutos.',
  },
  {
    icon: Heart,
    title: 'Tu historia, a tu manera',
    description: 'Edita, reorganiza y personaliza cada página hasta que tu historia se sienta perfecta.',
  },
  {
    icon: Package,
    title: 'Calidad premium',
    description: 'Impresión de alta calidad en papel grueso y lujoso, entregado en tu puerta.',
  },
]

export default function Features() {
  return (
    <section
      id="features"
      style={{
        padding: '96px 24px',
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border-subtle)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
        <Reveal>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(28px, 4vw, 42px)',
            fontWeight: 500,
            color: 'var(--text-primary)',
            letterSpacing: '-0.01em',
            marginBottom: '12px',
          }}>
            Crear recuerdos nunca fue tan sencillo
          </h2>
        </Reveal>

        <Reveal delay={0.1}>
          <p style={{
            fontSize: '16px',
            color: 'var(--text-secondary)',
            maxWidth: '480px',
            margin: '0 auto 64px',
            fontWeight: 300,
            lineHeight: 1.7,
          }}>
            Pixia no solo organiza fotos. Pixia construye tu historia.
          </p>
        </Reveal>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '24px',
        }}>
          {features.map((feature, index) => (
            <Reveal key={index} delay={0.15 + index * 0.1}>
              <div style={{
                padding: '32px 28px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                textAlign: 'left',
              }}>
                <feature.icon
                  size={20}
                  style={{ color: 'var(--text-tertiary)', marginBottom: '20px' }}
                />
                <h3 style={{
                  fontSize: '15px',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  marginBottom: '8px',
                  letterSpacing: '-0.01em',
                }}>
                  {feature.title}
                </h3>
                <p style={{
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.65,
                  fontWeight: 300,
                }}>
                  {feature.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
