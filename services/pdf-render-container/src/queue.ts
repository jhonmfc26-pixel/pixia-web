import { buildPrintJobInput } from '@/core/modules/print/buildPrintJobInput'
import { findUnprintablePhotos, describeUnprintable } from '@/core/modules/print/printablePhotos'
import { renderInteriorPdf, renderCoverPdf } from './renderAlbum'
import { sendPdfFailureAlert } from './alert'
import type { JobsClient, QueueJob } from './jobs'

/**
 * Barrido de la cola pagado → PDF. Lo llama Cloud Scheduler cada 5 min vía
 * POST /process-pending (ver server.ts y supabase/pdf_jobs_trigger.sql).
 *
 * Orden de cada barrido:
 *   1. Reconciliar: órdenes aprobadas sin job → se encolan (red de seguridad
 *      por si el webhook no pudo encolar).
 *   2. Expirar: jobs que agotaron intentos → 'fallo'.
 *   3. Procesar jobs de a uno mientras quede presupuesto de tiempo.
 *   4. Alertar todo 'fallo' sin alerta enviada (los de este barrido y los
 *      que no salieron antes).
 */

export const MAX_ATTEMPTS = 3
/** Un render normal tarda 10–20 s; 15 min sin terminar = el contenedor murió. */
export const STUCK_MINUTES = 15
const RECONCILE_DAYS = 30
/** Cloud Run corta la request a los 300 s por defecto — dejamos margen. */
const TIME_BUDGET_MS = 3 * 60 * 1000
const MAX_JOBS_PER_SWEEP = 5

export interface RenderEngine {
  renderInterior: typeof renderInteriorPdf
  renderCover: typeof renderCoverPdf
  upload: (key: string, bytes: Uint8Array, contentType: string) => Promise<string>
}

export interface SweepResult {
  reconciled: string[]
  expired: string[]
  processed: { order: string | null; albumId: string; ok: boolean; error?: string }[]
  alertsSent: number
  alertsFailed: number
}

type Queue = Pick<JobsClient,
  'claimNext' | 'expireExhausted' | 'listUnalertedFailures' | 'markQueueFailure' | 'markAlerted' |
  'loadBlueprint' | 'reconcileApprovedOrders' | 'markInteriorReady' | 'markCoverReady'>

export async function runSweep(deps: {
  jobs: Queue
  engine: RenderEngine
  baseUrl: string
  alert?: (job: QueueJob) => Promise<boolean>
  now?: () => number
  /** Inyectable para tests; en producción siempre buildPrintJobInput. */
  build?: typeof buildPrintJobInput
}): Promise<SweepResult> {
  const { jobs, engine, baseUrl } = deps
  const alert = deps.alert ?? sendPdfFailureAlert
  const now = deps.now ?? Date.now
  const started = now()
  const result: SweepResult = { reconciled: [], expired: [], processed: [], alertsSent: 0, alertsFailed: 0 }

  // 1. Reconciliar. Un fallo acá no frena el resto del barrido.
  try {
    result.reconciled = await jobs.reconcileApprovedOrders(RECONCILE_DAYS)
    if (result.reconciled.length) console.warn(`[queue] Órdenes aprobadas sin job, encoladas: ${result.reconciled.join(', ')}`)
  } catch (err) {
    console.error('[queue] reconcile falló:', err)
  }

  // 2. Expirar colgados/agotados.
  try {
    const expired = await jobs.expireExhausted(MAX_ATTEMPTS, STUCK_MINUTES)
    result.expired = expired.map((j) => j.order_reference ?? j.blueprint_id)
  } catch (err) {
    console.error('[queue] expire falló:', err)
  }

  // 3. Procesar.
  while (result.processed.length < MAX_JOBS_PER_SWEEP && now() - started < TIME_BUDGET_MS) {
    let job: QueueJob | null
    try {
      job = await jobs.claimNext(MAX_ATTEMPTS, STUCK_MINUTES)
    } catch (err) {
      console.error('[queue] claim falló:', err)
      break
    }
    if (!job) break
    result.processed.push(await processJob(job, { jobs, engine, baseUrl, build: deps.build ?? buildPrintJobInput }))
  }

  // 4. Alertas pendientes (incluye las recién expiradas y las de este barrido).
  try {
    for (const failed of await jobs.listUnalertedFailures()) {
      if (await alert(failed)) {
        await jobs.markAlerted(failed.blueprint_id)
        result.alertsSent++
      } else {
        result.alertsFailed++
      }
    }
  } catch (err) {
    console.error('[queue] alertas fallaron:', err)
  }

  return result
}

async function processJob(
  job: QueueJob,
  deps: { jobs: Queue; engine: RenderEngine; baseUrl: string; build: typeof buildPrintJobInput },
): Promise<SweepResult['processed'][number]> {
  const { jobs, engine, baseUrl, build } = deps
  const albumId = job.blueprint_id
  const order = job.order_reference
  console.log(`[queue] Generando PDF de orden ${order} (álbum ${albumId}, intento ${job.attempt_count}/${MAX_ATTEMPTS})`)

  try {
    const raw = await jobs.loadBlueprint(albumId)
    const built = build(raw, albumId)
    if (!built.ok) throw new PermanentError(built.reason)
    for (const w of built.warnings) console.warn(`[queue] ${albumId}: ${w}`)
    // Fotos que no quedaron subidas: no se arregla reintentando — directo a 'fallo' y alerta.
    const unprintable = findUnprintablePhotos(built.input)
    if (unprintable.length > 0) throw new PermanentError(describeUnprintable(unprintable))
    const { structure, photos, cover, coverPhoto, format } = built.input

    const interior = await engine.renderInterior(structure, new Map(Object.entries(photos)), format, baseUrl)
    for (const w of interior.warnings) {
      console.warn(`[queue] ${albumId} interior: foto ${w.photoId} a ${w.effectiveDpi} DPI (objetivo ${w.targetDpi})`)
    }
    const interiorKey = await engine.upload(`${albumId}/interior/final.pdf`, interior.pdf, 'application/pdf')
    await jobs.markInteriorReady(albumId, interiorKey)

    const coverResult = await engine.renderCover(cover, coverPhoto, structure, format, baseUrl)
    const coverKey = await engine.upload(`${albumId}/cover/final.pdf`, coverResult.pdf, 'application/pdf')
    await jobs.markCoverReady(albumId, coverKey) // cierra en pdf_listo (maybeComplete)

    console.log(`[queue] ✓ PDF listo orden ${order} (álbum ${albumId})`)
    return { order, albumId, ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // Un álbum sin pliegos no se arregla reintentando — directo a 'fallo'.
    const final = err instanceof PermanentError || job.attempt_count >= MAX_ATTEMPTS
    console.error(`[queue] ✗ orden ${order} (álbum ${albumId}) falló${final ? ' DEFINITIVAMENTE' : ''}:`, message)
    await jobs.markQueueFailure(albumId, message, final)
    return { order, albumId, ok: false, error: message }
  }
}

class PermanentError extends Error {}
