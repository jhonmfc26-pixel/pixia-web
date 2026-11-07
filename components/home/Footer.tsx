import Link from 'next/link'
import { LEGAL_ENTITY, SIC_URL, isPlaceholder } from '@/lib/legal'

/**
 * Pie del sitio. Además de navegación, cumple lo que exige el art. 50 de la
 * Ley 1480 para quien vende en línea: identificación del vendedor, enlace a
 * términos y datos personales, y enlace visible a la autoridad (SIC).
 * Antes todos los enlaces apuntaban a "#".
 */
const COLS: { title: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    title: 'Producto',
    links: [
      { label: 'Crear álbum', href: '/create' },
      { label: 'Cómo funciona', href: '/#como-funciona' },
      { label: 'Ejemplos', href: '/#ejemplos' },
      { label: 'Precios', href: '/#precios' },
    ],
  },
  {
    title: 'Ayuda',
    links: [
      { label: 'Mis álbumes', href: '/mis-albumes' },
      { label: LEGAL_ENTITY.email, href: `mailto:${LEGAL_ENTITY.email}`, external: true },
      { label: 'Garantía y devoluciones', href: '/terminos#garantia' },
      { label: 'Peticiones, quejas y reclamos', href: '/soporte' },
      { label: 'Consultar un radicado', href: '/soporte/seguimiento' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Términos y condiciones', href: '/terminos' },
      { label: 'Tratamiento de datos personales', href: '/privacidad' },
      { label: 'Superintendencia de Industria y Comercio', href: SIC_URL, external: true },
    ],
  },
]

export default function Footer() {
  const identity = [
    isPlaceholder(LEGAL_ENTITY.legalName) ? null : LEGAL_ENTITY.legalName,
    isPlaceholder(LEGAL_ENTITY.taxId) ? null : `NIT ${LEGAL_ENTITY.taxId}`,
    LEGAL_ENTITY.city,
  ].filter(Boolean).join(' · ')

  return (
    <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-base)] px-6 pb-10 pt-16">
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="mb-2.5 font-[family-name:var(--font-display)] text-lg font-medium text-[var(--text-primary)]">Pixia</p>
            <p className="max-w-[240px] text-[13px] font-light leading-relaxed text-[var(--text-tertiary)]">
              Tus fotos, transformadas en álbumes impresos con criterio editorial.
            </p>
          </div>
          {COLS.map(col => (
            <div key={col.title}>
              <p className="mb-4 text-xs font-medium uppercase tracking-[0.1em] text-[var(--text-tertiary)]">{col.title}</p>
              <ul className="flex flex-col gap-2.5">
                {col.links.map(l => (
                  <li key={l.label}>
                    {l.external ? (
                      <a href={l.href} target={l.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer"
                        className="text-[13px] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)]">{l.label}</a>
                    ) : (
                      <Link href={l.href} className="text-[13px] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)]">{l.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 border-t border-[var(--border-subtle)] pt-6 text-xs tracking-[0.02em] text-[var(--text-tertiary)] sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Pixia. Todos los derechos reservados.</p>
          <p>{identity}</p>
        </div>
      </div>
    </footer>
  )
}
