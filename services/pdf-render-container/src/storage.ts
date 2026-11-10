import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { planCleanup, extractPhotoKeys, r2MonthlyCostUsd, GB, type StoredObject, type BlueprintInfo, type OrderInfo } from '@/lib/retention'
import { COMMERCIAL } from '@/lib/legal'
import { sendAlert } from './alert'

/**
 * Medición y limpieza del almacenamiento (fotos en el bucket público, PDFs en
 * el privado). La regla de qué se borra está en lib/retention.ts; acá solo
 * la I/O. Cloud Scheduler llama POST /storage-cleanup una vez al día y el
 * admin (/admin/almacenamiento) puede pedir una medición en cualquier momento.
 *
 * Modos:
 *  - 'prueba'   → mide y calcula qué se borraría, NO borra nada. Es el
 *                 default (STORAGE_CLEANUP_MODE) hasta que Jhon revise el
 *                 primer reporte en el admin y lo cambie a 'aplicada'.
 *  - 'aplicada' → además borra. Tope de MAX_DELETE_PER_RUN objetos por
 *                 corrida; lo que quede se borra al día siguiente.
 *
 * Cada corrida deja una fila en storage_reports (supabase/almacenamiento.sql)
 * y manda alerta si el uso pasa el umbral o si la corrida falla.
 */

export type CleanupMode = 'prueba' | 'aplicada'

const MAX_DELETE_PER_RUN = 20_000
const PAGE = 500

interface StorageEnv {
  endpoint: string
  assets: { bucket: string; accessKeyId: string; secretAccessKey: string }
  pdfs: { bucket: string; accessKeyId: string; secretAccessKey: string }
  supabaseUrl: string
  serviceRoleKey: string
  budgetBytes: number
  alertPct: number
}

export function readStorageEnv(): StorageEnv | { missing: string[] } {
  const need = ['R2_PDF_ENDPOINT', 'R2_PDF_BUCKET', 'R2_PDF_ACCESS_KEY_ID', 'R2_PDF_SECRET_ACCESS_KEY',
    'R2_ASSETS_BUCKET', 'R2_ASSETS_ACCESS_KEY_ID', 'R2_ASSETS_SECRET_ACCESS_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
  const missing = need.filter(n => !process.env[n])
  if (missing.length) return { missing }
  const e = process.env as Record<string, string>
  return {
    endpoint: e.R2_PDF_ENDPOINT,
    assets: { bucket: e.R2_ASSETS_BUCKET, accessKeyId: e.R2_ASSETS_ACCESS_KEY_ID, secretAccessKey: e.R2_ASSETS_SECRET_ACCESS_KEY },
    pdfs: { bucket: e.R2_PDF_BUCKET, accessKeyId: e.R2_PDF_ACCESS_KEY_ID, secretAccessKey: e.R2_PDF_SECRET_ACCESS_KEY },
    supabaseUrl: e.SUPABASE_URL,
    serviceRoleKey: e.SUPABASE_SERVICE_ROLE_KEY,
    // 10 GB = lo gratis de R2; Jhon lo sube cuando quiera (es un presupuesto, R2 no tiene tope).
    budgetBytes: Number(process.env.STORAGE_BUDGET_GB || 10) * GB,
    alertPct: Number(process.env.STORAGE_ALERT_PCT || 80),
  }
}

function bucketClient(endpoint: string, b: StorageEnv['assets']) {
  const s3 = new S3Client({ region: 'auto', endpoint, credentials: { accessKeyId: b.accessKeyId, secretAccessKey: b.secretAccessKey } })
  return {
    async list(prefix?: string): Promise<StoredObject[]> {
      const out: StoredObject[] = []
      let token: string | undefined
      do {
        const r = await s3.send(new ListObjectsV2Command({ Bucket: b.bucket, Prefix: prefix, ContinuationToken: token, MaxKeys: 1000 }))
        for (const o of r.Contents ?? []) {
          if (o.Key) out.push({ key: o.Key, size: o.Size ?? 0, lastModified: o.LastModified ?? new Date() })
        }
        token = r.IsTruncated ? r.NextContinuationToken : undefined
      } while (token)
      return out
    },
    async remove(keys: string[]): Promise<{ deleted: number; errors: string[] }> {
      let deleted = 0
      const errors: string[] = []
      for (let i = 0; i < keys.length; i += 1000) {
        const batch = keys.slice(i, i + 1000)
        const r = await s3.send(new DeleteObjectsCommand({ Bucket: b.bucket, Delete: { Objects: batch.map(Key => ({ Key })), Quiet: true } }))
        const failed = r.Errors ?? []
        deleted += batch.length - failed.length
        failed.slice(0, 5).forEach(e => errors.push(`${e.Key}: ${e.Message}`))
      }
      return { deleted, errors }
    },
  }
}

async function selectAll<T>(sb: SupabaseClient, table: string, columns: string, filter?: (q: any) => any): Promise<T[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    let q = sb.from(table).select(columns).order('id').range(from, from + PAGE - 1)
    if (filter) q = filter(q)
    const { data, error } = await q
    if (error) throw new Error(`Supabase ${table}: ${error.message}`)
    rows.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGE) return rows
  }
}

const sum = (xs: StoredObject[]) => xs.reduce((a, o) => a + o.size, 0)
const fmtGb = (b: number) => `${(b / GB).toFixed(2)} GB`

export async function runStorageCleanup(mode: CleanupMode) {
  const env = readStorageEnv()
  if ('missing' in env) throw new Error(`Faltan variables para la limpieza: ${env.missing.join(', ')}`)
  const now = new Date()
  const sb = createClient(env.supabaseUrl, env.serviceRoleKey, { auth: { persistSession: false } })
  const assets = bucketClient(env.endpoint, env.assets)
  const pdfs = bucketClient(env.endpoint, env.pdfs)

  try {
    const [photoObjs, pdfObjs, bpRows, orderRows] = await Promise.all([
      assets.list('users/'),
      pdfs.list(),
      selectAll<{ id: string; created_at: string; cover: unknown; spreads: unknown; structure: unknown }>(sb, 'blueprints', 'id, created_at, cover, spreads, structure'),
      selectAll<{ id: string; book_id: string | null; payment_status: string | null; delivered_at: string | null; assets_purged_at: string | null; book_snapshot: unknown }>(
        sb, 'orders', 'id, book_id, payment_status, delivered_at, assets_purged_at, book_snapshot', q => q.eq('payment_status', 'approved')),
    ])

    const blueprints: BlueprintInfo[] = bpRows.map(r => ({ id: r.id, createdAt: new Date(r.created_at), photoKeys: extractPhotoKeys([r.cover, r.spreads, r.structure]) }))
    const orders: OrderInfo[] = orderRows.map(r => ({
      id: r.id, bookId: r.book_id, paymentStatus: r.payment_status,
      deliveredAt: r.delivered_at ? new Date(r.delivered_at) : null,
      assetsPurgedAt: r.assets_purged_at ? new Date(r.assets_purged_at) : null,
      photoKeys: extractPhotoKeys(r.book_snapshot),
    }))

    const plan = planCleanup({ blueprints, orders, photos: photoObjs, pdfs: pdfObjs }, now,
      { draftDays: COMMERCIAL.draftRetentionDays, warrantyDays: COMMERCIAL.warrantyDays })

    const usedBytes = sum(photoObjs) + sum(pdfObjs)
    const toDelete = [...plan.deletePhotos, ...plan.deletePdfs]
    let deletedObjects = 0, deletedBytes = 0, deletedBlueprints = 0, purgedOrders = 0
    const errors: string[] = []

    if (mode === 'aplicada') {
      // Tope por corrida: primero lo más viejo.
      const byAge = (a: StoredObject, b: StoredObject) => a.lastModified.getTime() - b.lastModified.getTime()
      const photosNow = [...plan.deletePhotos].sort(byAge).slice(0, MAX_DELETE_PER_RUN)
      const pdfsNow = [...plan.deletePdfs].sort(byAge).slice(0, Math.max(0, MAX_DELETE_PER_RUN - photosNow.length))
      const rp = await assets.remove(photosNow.map(o => o.key))
      const rd = await pdfs.remove(pdfsNow.map(o => o.key))
      deletedObjects = rp.deleted + rd.deleted
      deletedBytes = sum(photosNow) + sum(pdfsNow) // aproximado si hubo errores (se listan abajo)
      errors.push(...rp.errors, ...rd.errors)

      // Filas de borradores vencidos (sus fotos ya se borraron o se borran mañana).
      for (let i = 0; i < plan.deleteBlueprintIds.length; i += 100) {
        const ids = plan.deleteBlueprintIds.slice(i, i + 100)
        const { error, count } = await sb.from('blueprints').delete({ count: 'exact' }).in('id', ids)
        if (error) errors.push(`blueprints: ${error.message}`)
        else deletedBlueprints += count ?? 0
      }
      if (plan.purgeOrderIds.length) {
        const { error, count } = await sb.from('orders').update({ assets_purged_at: now.toISOString() }, { count: 'exact' }).in('id', plan.purgeOrderIds)
        if (error) errors.push(`orders: ${error.message}`)
        else purgedOrders = count ?? 0
      }
    }

    const report = {
      mode,
      photos_bytes: sum(photoObjs), photos_objects: photoObjs.length,
      pdfs_bytes: sum(pdfObjs), pdfs_objects: pdfObjs.length,
      to_delete_bytes: sum(toDelete), to_delete_objects: toDelete.length,
      deleted_bytes: deletedBytes, deleted_objects: deletedObjects,
      deleted_blueprints: deletedBlueprints, purged_orders: purgedOrders,
      budget_bytes: env.budgetBytes,
      details: {
        counts: plan.counts,
        drafts_to_delete: plan.deleteBlueprintIds.length,
        orders_to_purge: plan.purgeOrderIds.length,
        oldest_photo: photoObjs.reduce<string | null>((m, o) => (!m || o.lastModified.toISOString() < m ? o.lastModified.toISOString() : m), null),
        monthly_cost_usd: Number(r2MonthlyCostUsd(usedBytes - deletedBytes).toFixed(2)),
        errors: errors.slice(0, 20),
      },
      error: errors.length ? `${errors.length} errores al borrar (ver details.errors)` : null,
    }
    const { error: insErr } = await sb.from('storage_reports').insert(report)
    if (insErr) console.error('[storage] no se pudo guardar el reporte:', insErr.message)

    // Alerta de espacio (con el uso que queda después de borrar).
    const remaining = usedBytes - deletedBytes
    if (remaining >= env.budgetBytes * env.alertPct / 100) {
      await sendAlert(`⚠️ Pixia: almacenamiento al ${Math.round(remaining / env.budgetBytes * 100)} % del presupuesto`, [
        `Uso actual: ${fmtGb(remaining)} de ${fmtGb(env.budgetBytes)} presupuestados.`,
        `Fotos: ${fmtGb(report.photos_bytes)} · PDFs: ${fmtGb(report.pdfs_bytes)}`,
        `Costo estimado de R2: US$${report.details.monthly_cost_usd}/mes.`,
        mode === 'prueba' ? `La limpieza está en modo prueba: liberaría ${fmtGb(report.to_delete_bytes)}. Actívala en el admin → Almacenamiento.` : '',
        'Detalle en pixiaa.com/admin/almacenamiento',
      ].filter(Boolean).join('\n'))
    }
    if (errors.length) await sendAlert('⚠️ Pixia: la limpieza de almacenamiento tuvo errores', errors.slice(0, 20).join('\n'))

    return report
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await sb.from('storage_reports').insert({ mode, error: message, budget_bytes: env.budgetBytes }).then(() => {}, () => {})
    await sendAlert('🚨 Pixia: falló la limpieza de almacenamiento', message)
    throw err
  }
}
