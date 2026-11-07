import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { isAdminRequest } from '@/lib/admin/auth'
import { getPqr } from '@/lib/pqrData'
import { PQR_STATUS_LABEL, PQR_TYPES, formatBogotaDateTime } from '@/lib/pqr'
import { formatDateEs } from '@/lib/businessDays'
import { Badge, Card, DueBadge, Field } from '../../_components'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const FLASH: Record<string, string> = {
  guardado: 'Cambios guardados.',
  respondido: 'Respuesta guardada y enviada al cliente.',
}

export default async function AdminPqrDetail({ params, searchParams }: {
  params: Promise<{ radicado: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (!(await isAdminRequest(await headers()))) notFound()
  const { radicado } = await params
  const sp = await searchParams
  const r = await getPqr(decodeURIComponent(radicado))
  if (!r) notFound()

  const flash = typeof sp.ok === 'string' ? { ok: true, text: FLASH[sp.ok] ?? 'Listo.' } : typeof sp.error === 'string' ? { ok: false, text: sp.error } : null
  const answered = r.status === 'respondido'
  const input = 'w-full rounded-lg border border-[var(--border-medium)] bg-[var(--bg-base)] px-3 py-2 text-sm'

  return (
    <div className="space-y-6">
      <Link href="/admin/pqr" className="text-sm text-[var(--text-secondary)] hover:underline">← PQR</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-xl">{r.radicado}</h1>
        <Badge tone={answered ? 'ok' : r.status === 'en_tramite' ? 'info' : 'warn'}>{PQR_STATUS_LABEL[r.status]}</Badge>
        <DueBadge due={r.due_date} status={r.status} />
      </div>
      {flash && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${flash.ok ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-red-400/40 bg-red-500/10 text-red-200'}`}>{flash.text}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card title={PQR_TYPES[r.type]?.label ?? r.type}>
            <p className="whitespace-pre-line text-sm leading-relaxed">{r.message}</p>
          </Card>
          {answered && r.response && (
            <Card title={`Respuesta enviada · ${r.responded_at ? formatBogotaDateTime(r.responded_at) : ''}`}>
              <p className="whitespace-pre-line text-sm leading-relaxed">{r.response}</p>
            </Card>
          )}
          <Card title={answered ? 'Notas internas' : 'Responder'}>
            <form method="post" action={`/api/admin/pqr/${encodeURIComponent(r.radicado)}`} className="space-y-3">
              {!answered && (
                <>
                  <select name="status" defaultValue={r.status === 'recibido' ? 'en_tramite' : r.status} className={input}>
                    <option value="en_tramite">En trámite (sin responder todavía)</option>
                    <option value="respondido">Respondido — enviar la respuesta al cliente</option>
                  </select>
                  <textarea name="response" rows={7} placeholder="Respuesta para el cliente (se envía por correo al marcar 'Respondido')" className={input} />
                  <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <input type="checkbox" name="notify" defaultChecked className="h-4 w-4 accent-[var(--brand-coral)]" />
                    Enviar la respuesta por correo
                  </label>
                </>
              )}
              {answered && <input type="hidden" name="status" value="respondido" />}
              <textarea name="internalNotes" rows={3} defaultValue={r.internal_notes ?? ''} placeholder="Notas internas (el cliente no las ve)" className={input} />
              <button className="rounded-lg bg-[var(--brand-coral)] px-3.5 py-2 text-sm font-medium text-white hover:brightness-110">Guardar</button>
            </form>
          </Card>
        </div>
        <Card title="Datos">
          <dl>
            <Field label="Recibido">{formatBogotaDateTime(r.created_at)}</Field>
            <Field label="Vence">{formatDateEs(new Date(`${r.due_date}T00:00:00Z`))}</Field>
            <Field label="Nombre">{r.name}</Field>
            <Field label="Correo"><a className="hover:underline" href={`mailto:${r.email}?subject=${encodeURIComponent(`Radicado ${r.radicado}`)}`}>{r.email}</a></Field>
            <Field label="Teléfono">{r.phone}</Field>
            <Field label="Orden">{r.order_reference ? <Link className="hover:underline" href={`/admin/pedidos/${encodeURIComponent(r.order_reference)}`}>{r.order_reference}</Link> : null}</Field>
          </dl>
        </Card>
      </div>
    </div>
  )
}
