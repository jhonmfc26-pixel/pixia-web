import Link from 'next/link'
import type { ReactNode } from 'react'
import Footer from '@/components/home/Footer'
import { LEGAL_ENTITY, TERMS_UPDATED_LABEL, TERMS_VERSION, isPlaceholder } from '@/lib/legal'

/** Contenedor común de /terminos y /privacidad: legible, con índice y pie. */
export function LegalDoc({ title, intro, toc, children }: {
  title: string
  intro: ReactNode
  toc: { id: string; label: string }[]
  children: ReactNode
}) {
  return (
    <>
      <main className="bg-[var(--bg-base)] px-4 pb-24 pt-10 text-[var(--text-primary)] sm:px-8">
        <div className="mx-auto max-w-3xl">
          <Link href="/" className="font-[family-name:var(--font-display)] text-xl text-white/85">Pixia</Link>
          <h1 className="mt-10 font-[family-name:var(--font-display)] text-4xl font-normal leading-tight sm:text-5xl">{title}</h1>
          <p className="mt-3 text-sm text-[var(--text-tertiary)]">
            Última actualización: {TERMS_UPDATED_LABEL} · Versión {TERMS_VERSION}
          </p>
          <div className="mt-8 text-[15px] leading-relaxed text-[var(--text-secondary)]">{intro}</div>

          <nav aria-label="Contenido" className="mt-10 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <p className="mb-3 text-xs uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Contenido</p>
            <ol className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
              {toc.map((t, i) => (
                <li key={t.id}><a href={`#${t.id}`} className="text-[var(--text-secondary)] hover:text-white">{i + 1}. {t.label}</a></li>
              ))}
            </ol>
          </nav>

          <div className="legal-body mt-12 space-y-12">{children}</div>
        </div>
      </main>
      <Footer />
    </>
  )
}

export function Section({ id, n, title, children }: { id: string; n: number; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8">
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-normal text-white">{n}. {title}</h2>
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-[var(--text-secondary)]">{children}</div>
    </section>
  )
}

export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5 marker:text-[var(--brand-coral)]">
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ul>
  )
}

export function Strong({ children }: { children: ReactNode }) {
  return <strong className="font-medium text-white">{children}</strong>
}

/** Dato de la empresa; si sigue pendiente se resalta para que no pase desapercibido. */
export function Datum({ value }: { value: string }) {
  return isPlaceholder(value)
    ? <mark className="rounded bg-amber-400/15 px-1 text-amber-200">{value}</mark>
    : <>{value}</>
}

export function EntityBlock() {
  return (
    <dl className="grid gap-x-6 gap-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 text-sm sm:grid-cols-[auto_1fr]">
      <dt className="text-[var(--text-tertiary)]">Titular</dt><dd className="text-white"><Datum value={LEGAL_ENTITY.legalName} /></dd>
      <dt className="text-[var(--text-tertiary)]">NIT / identificación</dt><dd className="text-white"><Datum value={LEGAL_ENTITY.taxId} /></dd>
      <dt className="text-[var(--text-tertiary)]">Domicilio</dt><dd className="text-white"><Datum value={LEGAL_ENTITY.address} />, {LEGAL_ENTITY.city}</dd>
      <dt className="text-[var(--text-tertiary)]">Teléfono</dt><dd className="text-white"><Datum value={LEGAL_ENTITY.phone} /></dd>
      <dt className="text-[var(--text-tertiary)]">Correo</dt><dd className="text-white"><a className="underline" href={`mailto:${LEGAL_ENTITY.email}`}>{LEGAL_ENTITY.email}</a></dd>
      <dt className="text-[var(--text-tertiary)]">Sitio web</dt><dd className="text-white">{LEGAL_ENTITY.website.replace('https://', '')}</dd>
    </dl>
  )
}
