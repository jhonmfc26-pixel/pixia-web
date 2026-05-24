'use client'

export default function Footer() {
  return (
    <footer style={{
      background: 'var(--bg-base)',
      borderTop: '1px solid var(--border-subtle)',
      padding: '64px 24px 40px',
    }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '40px',
          marginBottom: '48px',
        }}>
          {/* Marca */}
          <div>
            <p style={{
              fontFamily: 'var(--font-display)',
              fontSize: '18px',
              fontWeight: 500,
              color: 'var(--text-primary)',
              marginBottom: '10px',
            }}>
              Pixia
            </p>
            <p style={{
              fontSize: '13px',
              color: 'var(--text-tertiary)',
              lineHeight: 1.65,
              fontWeight: 300,
              maxWidth: '220px',
            }}>
              Tus fotos, transformadas en libros con criterio editorial e IA.
            </p>
          </div>

          {/* Producto */}
          <div>
            <p style={{
              fontSize: '12px',
              color: 'var(--text-tertiary)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              fontWeight: 500,
              marginBottom: '16px',
            }}>
              Producto
            </p>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {['Crear álbum', 'Cómo funciona', 'Precios', 'Ejemplos'].map(item => (
                <li key={item}>
                  <a href="#" style={{
                    fontSize: '13px',
                    color: 'var(--text-tertiary)',
                    textDecoration: 'none',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                  >
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <p style={{
              fontSize: '12px',
              color: 'var(--text-tertiary)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              fontWeight: 500,
              marginBottom: '16px',
            }}>
              Legal
            </p>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {['Privacidad', 'Términos de uso', 'Cookies'].map(item => (
                <li key={item}>
                  <a href="#" style={{
                    fontSize: '13px',
                    color: 'var(--text-tertiary)',
                    textDecoration: 'none',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                  >
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div style={{
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '24px',
        }}>
          <p style={{
            fontSize: '12px',
            color: 'var(--text-tertiary)',
            letterSpacing: '0.02em',
          }}>
            © {new Date().getFullYear()} Pixia. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  )
}
