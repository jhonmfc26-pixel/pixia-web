'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { PQR_STATUSES, PQR_STATUS_LABEL, type PqrStatus } from '@/lib/pqr'
import { field, label, primary } from '../ui'

interface Found {
  radicado: string
  typeLabel: string
  status: PqrStatus
  createdAtLabel: string
  dueDateLabel: string
  response: string | null
  respondedAtLabel: string | null
}

export default function SeguimientoPage() {
  return <Suspense fallback={null}><Seguimiento /></Suspense>
}

function Seguimiento() {
  const params = useSearchParams()
  const [radicado, setRadicado] = useState(params.get('radicado') ?? '')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [found, setFound] = useState<Found | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setFound(null)
    try {
      const res = await fetch('/api/pqr/seguimiento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ radicado, email }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No pudimos consultar el radicado.')
      setFound(data.pqr)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos consultar el radicado.')
    } finally {
      setLoading(false)
    }
  }

  const idx = found ? PQR_STATUSES.indexOf(found.status) : -1

  return (
    <section className="mt-10">
      <h1 className="font-[family-name:var(--font-display)] text-4xl font-normal leading-tight">Estado de tu solicitud</h1>
      <p className="mt-4 text-white/65">Escribe el número de radicado que te enviamos por correo y el correo con el que la radicaste.</p>

      <form onSubmit={submit} className="mt-8 grid gap-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="block"><span className={label}>Número de radicado</span>
          <input required value={radicado} onChange={e => setRadicado(e.target.value)} placeholder="PQR-20261106-XXXXXX" className={`${field} font-mono uppercase`} /></label>
        <label className="block"><span className={label}>Correo</span>
          <input required type="email" inputMode="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className={field} /></label>
        <button type="submit" disabled={loading} className={primary}>{loading ? 'Consultando…' : 'Consultar'}</button>
      </form>

      {error && <p role="alert" className="mt-6 rounded-xl bg-[rgba(232,85,58,0.1)] p-4 text-sm text-[#F08A72]">{error}</p>}

      {found && (
        <div className="mt-10 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6">
          <p className="font-mono text-sm text-white/60">{found.radicado}</p>
          <p className="mt-1 text-lg text-white">{found.typeLabel}</p>
          <ol className="mt-6 flex items-center gap-2 text-xs">
            {PQR_STATUSES.map((s, i) => (
              <li key={s} className="flex items-center gap-2">
                <span className={`whitespace-nowrap rounded-full px-3 py-1 ${i <= idx ? 'bg-[rgba(232,85,58,0.16)] text-[#F08A72]' : 'bg-white/[0.05] text-white/35'}`}>{PQR_STATUS_LABEL[s]}</span>
                {i < PQR_STATUSES.length - 1 && <span className="h-px w-4 bg-white/15" />}
              </li>
            ))}
          </ol>
          <dl className="mt-6 space-y-2 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-white/55">Radicada</dt><dd className="text-right">{found.createdAtLabel}</dd></div>
            {found.status !== 'respondido' && (
              <div className="flex justify-between gap-4"><dt className="text-white/55">Respuesta a más tardar</dt><dd className="text-right">{found.dueDateLabel}</dd></div>
            )}
            {found.respondedAtLabel && (
              <div className="flex justify-between gap-4"><dt className="text-white/55">Respondida</dt><dd className="text-right">{found.respondedAtLabel}</dd></div>
            )}
          </dl>
          {found.response && (
            <div className="mt-6 border-l-2 border-[var(--brand-coral)] bg-white/[0.02] p-4 text-sm leading-relaxed whitespace-pre-line text-white/85">{found.response}</div>
          )}
        </div>
      )}

      <p className="mt-10 text-sm text-white/50">
        ¿Necesitas radicar algo nuevo? <Link href="/soporte" className="text-[#F08A72] underline">Escríbenos aquí</Link>.
      </p>
    </section>
  )
}
