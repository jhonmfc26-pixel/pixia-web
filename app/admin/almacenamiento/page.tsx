import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { isAdminRequest } from '@/lib/admin/auth'
import { listStorageReports, type StorageReport } from '@/lib/admin/storage'
import { formatBogotaDateTime } from '@/lib/pqr'
import { COMMERCIAL } from '@/lib/legal'
import { GB, r2MonthlyCostUsd } from '@/lib/retention'
import { Badge, Card, Field } from '../_components'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const gb = (b: number | null | undefined) => `${((b ?? 0) / GB).toFixed(2)} GB`
const n = (x: number | null | undefined) => (x ?? 0).toLocaleString('es-CO')

/**
 * /admin/almacenamiento — cuánto ocupa Pixia (fotos y PDFs en R2), cuánto se
 * limpió, qué falta por limpiar y alertas. Los datos los escribe el
 * contenedor de PDF en storage_reports (una corrida diaria + "Medir ahora").
 */
export default async function AdminStoragePage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  if (!(await isAdminRequest(await headers()))) notFound()
  const sp = await searchParams

  let reports: StorageReport[] = []
  let loadError: string | null = null
  try { reports = await listStorageReports(30) } catch (e) { loadError = e instanceof Error ? e.message : String(e) }

  const valid = reports.filter(r => !r.error || r.photos_objects > 0)
  const last = valid[0]
  const lastCleanup = reports.find(r => r.mode === 'aplicada' && r.deleted_objects > 0)
  const lastFailure = reports.find(r => r.error && r.photos_objects === 0)
  const used = last ? last.photos_bytes + last.pdfs_bytes - (last.mode === 'aplicada' ? last.deleted_bytes : 0) : 0
  const budget = last?.budget_bytes ?? 10 * GB
  const pct = Math.min(100, Math.round((used / budget) * 100))
  const tone = pct >= 90 ? 'bad' : pct >= 80 ? 'warn' : 'ok'
  const pendingMode = last?.mode === 'prueba' && (last.to_delete_objects ?? 0) > 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Almacenamiento</h1>
        <form action="/api/admin/storage" method="post">
          <button className="rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2 text-sm hover:bg-white/[0.08]">
            Medir ahora
          </button>
        </form>
      </div>

      {sp.ok && <p className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">Medición lista (modo prueba: no se borró nada).</p>}
      {sp.error && <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">No se pudo medir: {sp.error}</p>}
      {loadError && (
        <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          No se pudieron cargar los reportes: {loadError}. ¿Ya se corrió <code>supabase/almacenamiento.sql</code>?
        </p>
      )}
      {!loadError && !last && (
        <Card><p className="text-sm text-[var(--text-secondary)]">Todavía no hay mediciones. Pulsa «Medir ahora» o espera la corrida diaria.</p></Card>
      )}

      {last && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card title="En uso">
              <p className="text-3xl tabular-nums">{gb(used)}</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">de {gb(budget)} presupuestados</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div className={`h-full ${tone === 'bad' ? 'bg-red-400' : tone === 'warn' ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                {pct} % · Disponible: {gb(Math.max(0, budget - used))} · Alerta por correo desde el 80 %
              </p>
            </Card>
            <Card title="Costo estimado">
              <p className="text-3xl tabular-nums">US${r2MonthlyCostUsd(used).toFixed(2)}<span className="text-base text-[var(--text-secondary)]">/mes</span></p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Cloudflare R2: 10 GB gratis, luego US$0,015 por GB al mes. Descargas sin costo.</p>
            </Card>
            <Card title="Última limpieza">
              {lastCleanup ? (
                <>
                  <p className="text-3xl tabular-nums">{gb(lastCleanup.deleted_bytes)}</p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    liberados el {formatBogotaDateTime(lastCleanup.created_at)} · {n(lastCleanup.deleted_objects)} archivos, {n(lastCleanup.deleted_blueprints)} borradores
                  </p>
                </>
              ) : (
                <p className="text-sm text-[var(--text-secondary)]">Todavía no se ha borrado nada.</p>
              )}
            </Card>
          </div>

          {pendingMode && (
            <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-100">
              <strong>La limpieza está en modo prueba.</strong> Según la política, hoy se borrarían <strong>{gb(last.to_delete_bytes)}</strong> ({n(last.to_delete_objects)} archivos,
              {' '}{n(last.details?.drafts_to_delete)} borradores vencidos y {n(last.details?.orders_to_purge)} pedidos entregados hace más de {COMMERCIAL.warrantyDays} días).
              Si estás de acuerdo, actívala en Cloud Run con <code>STORAGE_CLEANUP_MODE=aplicada</code> (ver el README del servicio de PDF).
            </div>
          )}
          {lastFailure && lastFailure.created_at > (last?.created_at ?? '') && (
            <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              La última corrida falló ({formatBogotaDateTime(lastFailure.created_at)}): {lastFailure.error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Card title="Qué ocupa">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Fotos">{gb(last.photos_bytes)} · {n(last.photos_objects)}</Field>
                <Field label="PDF de impresión">{gb(last.pdfs_bytes)} · {n(last.pdfs_objects)}</Field>
                <Field label="Borradores vigentes">{n(last.details?.counts?.draftsActive)}</Field>
                <Field label="Pedidos vigentes">{n(last.details?.counts?.ordersActive)}</Field>
                <Field label="Foto más antigua">{last.details?.oldest_photo ? formatBogotaDateTime(last.details.oldest_photo) : '—'}</Field>
                <Field label="Medido">{formatBogotaDateTime(last.created_at)} · <Badge tone={last.mode === 'aplicada' ? 'ok' : 'warn'}>{last.mode === 'aplicada' ? 'limpieza activa' : 'modo prueba'}</Badge></Field>
              </div>
            </Card>
            <Card title="Política">
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-[var(--text-secondary)]">
                <li>Álbum sin comprar: {COMMERCIAL.draftRetentionDays} días desde que se crea; luego se borra con sus fotos.</li>
                <li>Álbum comprado: fotos y PDF hasta {COMMERCIAL.warrantyDays} días después de la entrega (garantía).</li>
                <li>Ninguna foto de menos de {COMMERCIAL.draftRetentionDays} días se borra, aunque nada la use.</li>
                <li>Los datos de los pedidos no se borran (normas contables).</li>
                <li>Corre todos los días a las 3 a. m.; borra máximo 20.000 archivos por corrida.</li>
              </ul>
            </Card>
          </div>

          <Card title="Historial">
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-[var(--text-tertiary)]">
                  <tr>
                    <th className="px-4 py-2 font-medium">Fecha</th>
                    <th className="px-4 py-2 font-medium">Modo</th>
                    <th className="px-4 py-2 text-right font-medium">En uso</th>
                    <th className="px-4 py-2 text-right font-medium">Por borrar</th>
                    <th className="px-4 py-2 text-right font-medium">Borrado</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map(r => (
                    <tr key={r.id} className="border-t border-white/5">
                      <td className="whitespace-nowrap px-4 py-2">{formatBogotaDateTime(r.created_at)}</td>
                      <td className="px-4 py-2">{r.error && r.photos_objects === 0 ? <Badge tone="bad">falló</Badge> : <Badge tone={r.mode === 'aplicada' ? 'ok' : 'muted'}>{r.mode}</Badge>}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{gb(r.photos_bytes + r.pdfs_bytes)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{gb(r.to_delete_bytes)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{r.deleted_objects ? gb(r.deleted_bytes) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
