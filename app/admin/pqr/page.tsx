import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { isAdminRequest } from '@/lib/admin/auth'
import { listPqr } from '@/lib/pqrData'
import { PQR_STATUS_LABEL, PQR_TYPES, formatBogotaDateTime } from '@/lib/pqr'
import { Badge, Card, DueBadge } from '../_components'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export default async function AdminPqrPage() {
  if (!(await isAdminRequest(await headers()))) notFound()
  let rows: Awaited<ReturnType<typeof listPqr>> = []
  let loadError: string | null = null
  try { rows = await listPqr() } catch (e) { loadError = e instanceof Error ? e.message : String(e) }

  const open = rows.filter(r => r.status !== 'respondido')
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Peticiones, quejas y reclamos</h1>
        <p className="text-sm text-[var(--text-secondary)]">{open.length} abiertos · {rows.length} en total</p>
      </div>
      {loadError && (
        <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          No se pudieron cargar los PQR: {loadError}. ¿Ya se corrió <code>supabase/pqr.sql</code>?
        </div>
      )}
      <Card>
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">Todavía no hay solicitudes.</p>
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-[var(--text-tertiary)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Radicado</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Recibido</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Vence</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-t border-[var(--border-subtle)] hover:bg-white/[0.02]">
                    <td className="px-4 py-3"><Link className="font-mono text-xs hover:underline" href={`/admin/pqr/${encodeURIComponent(r.radicado)}`}>{r.radicado}</Link></td>
                    <td className="px-4 py-3">{PQR_TYPES[r.type]?.label ?? r.type}</td>
                    <td className="px-4 py-3"><div>{r.name}</div><div className="text-xs text-[var(--text-secondary)]">{r.email}</div></td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-[var(--text-secondary)]">{formatBogotaDateTime(r.created_at)}</td>
                    <td className="px-4 py-3"><Badge tone={r.status === 'respondido' ? 'ok' : r.status === 'en_tramite' ? 'info' : 'warn'}>{PQR_STATUS_LABEL[r.status]}</Badge></td>
                    <td className="px-4 py-3"><DueBadge due={r.due_date} status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
