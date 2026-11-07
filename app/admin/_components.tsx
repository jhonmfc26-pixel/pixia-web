import type { ReactNode } from 'react'
import { PAYMENT_LABEL, PDF_STATE_LABEL, type PdfState } from '@/lib/admin/model'
import { PRINT_STATUS_ADMIN_LABEL, isPrintStatus } from '@/lib/orderStatus'
import { bogotaDate, businessDaysUntil } from '@/lib/businessDays'

type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'muted'

const TONE: Record<Tone, string> = {
  ok: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30',
  warn: 'bg-amber-500/15 text-amber-300 ring-amber-400/30',
  bad: 'bg-red-500/15 text-red-300 ring-red-400/40',
  info: 'bg-sky-500/15 text-sky-300 ring-sky-400/30',
  muted: 'bg-white/5 text-[var(--text-secondary)] ring-white/10',
}

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE[tone]}`}>
      {children}
    </span>
  )
}

export function PaymentBadge({ status }: { status: string }) {
  const tone: Tone = status === 'approved' ? 'ok' : status === 'pending' ? 'warn' : 'bad'
  return <Badge tone={tone}>{PAYMENT_LABEL[status] ?? status}</Badge>
}

const PDF_TONE: Record<PdfState, Tone> = {
  'no-aplica': 'muted',
  'sin-job': 'warn',
  'en-cola': 'info',
  generando: 'info',
  reintentando: 'warn',
  listo: 'ok',
  fallo: 'bad',
}

export function PdfBadge({ state }: { state: PdfState }) {
  if (state === 'no-aplica') return <span className="text-[var(--text-tertiary)]">—</span>
  return <Badge tone={PDF_TONE[state]}>{PDF_STATE_LABEL[state]}</Badge>
}

export function Card({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 ${className}`}>
      {title && <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">{title}</h2>}
      {children}
    </section>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[var(--border-subtle)] py-2 text-sm last:border-0">
      <dt className="shrink-0 text-[var(--text-secondary)]">{label}</dt>
      <dd className="min-w-0 break-words text-right">{children ?? '—'}</dd>
    </div>
  )
}

export function ButtonLink({ href, children, variant = 'secondary' }: { href: string; children: ReactNode; variant?: 'primary' | 'secondary' }) {
  const cls = variant === 'primary'
    ? 'bg-[var(--brand-coral)] text-white hover:brightness-110'
    : 'border border-[var(--border-medium)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
  return (
    <a href={href} className={`inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm font-medium transition ${cls}`}>
      {children}
    </a>
  )
}

/** Estado post-venta (impresión / envío). Solo para pedidos pagados. */
export function ShipBadge({ status: raw }: { status: string | null }) {
  // Pagada pero con un estado fuera de la lista (DEFAULT de la columna): por imprimir.
  const status = isPrintStatus(raw) ? raw : 'paid'
  const tone: Tone = status === 'delivered' ? 'ok' : status === 'shipped' ? 'info' : status === 'printing' ? 'info' : 'warn'
  const label = status === 'paid' ? 'Por imprimir' : PRINT_STATUS_ADMIN_LABEL[status]
  return <Badge tone={tone}>{label}</Badge>
}

/** Días hábiles para el vencimiento, con color según urgencia. */
export function DueBadge({ due, status }: { due: string; status: string }) {
  if (status === 'respondido') return <span className="text-[var(--text-tertiary)]">—</span>
  const left = businessDaysUntil(bogotaDate(), new Date(`${due}T00:00:00Z`))
  const tone: Tone = left < 0 ? 'bad' : left <= 3 ? 'warn' : 'muted'
  const text = left < 0 ? `Vencido hace ${-left} d. háb.` : left === 0 ? 'Vence hoy' : `${left} d. háb.`
  return <Badge tone={tone}>{text}</Badge>
}

