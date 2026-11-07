'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { PQR_TYPES, isPqrType, type PqrType } from '@/lib/pqr'
import { COMMERCIAL } from '@/lib/legal'
import { field, label, primary } from './ui'

/**
 * Peticiones, quejas y reclamos. Al enviar, la solicitud queda radicada con
 * número, fecha y hora (Ley 2439 de 2024) y llega una constancia al correo.
 * Admite ?tipo=garantia&orden=PIXIA-... para llegar con el formulario listo.
 */
export default function SoportePage() {
  return <Suspense fallback={null}><SoporteForm /></Suspense>
}

interface Done { radicado: string; createdAtLabel: string; dueDateLabel: string; email: string }

function SoporteForm() {
  const params = useSearchParams()
  const initialType = params.get('tipo')
  const [form, setForm] = useState({
    type: (isPqrType(initialType) ? initialType : '') as PqrType | '',
    name: '', email: '', phone: '',
    orderReference: params.get('orden') ?? '',
    message: '', website: '',
  })
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<Done | null>(null)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/pqr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No pudimos radicar tu solicitud.')
      setDone({ ...data, email: form.email.trim() })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos radicar tu solicitud.')
    } finally {
      setSending(false)
    }
  }

  if (done) {
    return (
      <section className="mt-10">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-coral)] text-2xl text-white">✓</div>
        <h1 className="text-center font-[family-name:var(--font-display)] text-4xl font-normal">Solicitud radicada</h1>
        <p className="mx-auto mt-4 max-w-md text-center text-white/65">
          Te enviamos la constancia a <span className="text-white">{done.email}</span>. Guarda el número de radicado para hacerle seguimiento.
        </p>
        <dl className="mt-8 space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 text-sm">
          <Row k="Número de radicado" v={<span className="font-mono text-base">{done.radicado}</span>} />
          <Row k="Fecha y hora" v={done.createdAtLabel} />
          <Row k="Te respondemos a más tardar" v={done.dueDateLabel} />
        </dl>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href={`/soporte/seguimiento?radicado=${encodeURIComponent(done.radicado)}`} className={primary}>Ver el estado</Link>
          <Link href="/" className="inline-flex items-center justify-center rounded-xl border border-white/15 px-6 py-3.5 text-white hover:bg-white/5">Volver al inicio</Link>
        </div>
      </section>
    )
  }

  return (
    <section className="mt-10">
      <h1 className="font-[family-name:var(--font-display)] text-4xl font-normal leading-tight sm:text-5xl">¿En qué te ayudamos?</h1>
      <p className="mt-4 leading-relaxed text-white/65">
        Escríbenos tu pregunta, queja, reclamo o solicitud de garantía. Al enviarla recibes un <strong className="font-medium text-white">número de radicado</strong> con
        fecha y hora, y te respondemos en máximo {COMMERCIAL.pqrResponseBusinessDays} días hábiles.{' '}
        <Link href="/soporte/seguimiento" className="text-[#F08A72] underline">¿Ya tienes un radicado? Consulta su estado</Link>.
      </p>

      <form onSubmit={submit} className="mt-10 space-y-5">
        <label className="block">
          <span className={label}>Tipo de solicitud</span>
          <select required value={form.type} onChange={set('type')} className={field}>
            <option value="" disabled>Elige una opción</option>
            {Object.entries(PQR_TYPES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
          </select>
        </label>
        {form.type === 'garantia' && (
          <p className="rounded-xl bg-white/[0.04] p-4 text-sm leading-relaxed text-white/65">
            Cuéntanos qué defecto o daño tiene el álbum. Después de enviar, <strong className="font-medium text-white">responde el correo de constancia con fotos</strong> del
            álbum y del empaque. Los daños del transporte se reportan dentro de los {COMMERCIAL.transportDamageBusinessDays} días hábiles siguientes a la entrega.
          </p>
        )}
        {form.type === 'cancelacion' && (
          <p className="rounded-xl bg-white/[0.04] p-4 text-sm leading-relaxed text-white/65">
            Puedes cancelar con devolución total mientras tu pedido no haya entrado a impresión. Incluye tu número de orden.
          </p>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block"><span className={label}>Nombre</span>
            <input required autoComplete="name" value={form.name} onChange={set('name')} className={field} /></label>
          <label className="block"><span className={label}>Correo</span>
            <input required type="email" inputMode="email" autoComplete="email" value={form.email} onChange={set('email')} className={field} /></label>
          <label className="block"><span className={label}>Teléfono <span className="text-white/35">· opcional</span></span>
            <input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} className={field} /></label>
          <label className="block"><span className={label}>Número de orden <span className="text-white/35">· si tienes</span></span>
            <input value={form.orderReference} onChange={set('orderReference')} placeholder="PIXIA-…" className={field} /></label>
        </div>
        <label className="block"><span className={label}>Tu mensaje</span>
          <textarea required rows={6} maxLength={5000} value={form.message} onChange={set('message')} className={`${field} resize-y`} /></label>
        {/* Campo trampa para bots: oculto a personas y lectores de pantalla. */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden value={form.website} onChange={set('website')}
          className="absolute left-[-9999px] h-0 w-0 opacity-0" />

        {error && <p role="alert" className="rounded-xl bg-[rgba(232,85,58,0.1)] p-4 text-sm text-[#F08A72]">{error}</p>}

        <div className="flex flex-col items-start gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-relaxed text-white/40">
            Usamos estos datos solo para atender tu solicitud, según la <Link href="/privacidad" className="underline">Política de datos personales</Link>.
          </p>
          <button type="submit" disabled={sending} className={primary}>{sending ? 'Enviando…' : 'Enviar y radicar'}</button>
        </div>
      </form>
    </section>
  )
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-white/55">{k}</dt>
      <dd className="text-white sm:text-right">{v}</dd>
    </div>
  )
}
