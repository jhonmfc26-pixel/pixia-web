import express from 'express'
import { renderInteriorPdf, renderCoverPdf } from './renderAlbum'
import { createR2Client, signDownloadUrl, verifyDownloadToken } from './r2'
import { runStorageCleanup, type CleanupMode } from './storage'
import { createJobsClient } from './jobs'
import { runSweep } from './queue'
import type { AlbumStructure } from '@/core/modules/foldModel/types'
import type { CoverConfig, PhotoAsset } from '@/core/contracts/AlbumBlueprint'

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Falta la variable de entorno ${name}`)
  return v
}

const CONTAINER_SECRET = requireEnv('PDF_CONTAINER_SECRET')
const SUPABASE_URL = requireEnv('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
const R2_ENDPOINT = requireEnv('R2_PDF_ENDPOINT')
const R2_BUCKET = requireEnv('R2_PDF_BUCKET')
const R2_ACCESS_KEY_ID = requireEnv('R2_PDF_ACCESS_KEY_ID')
const R2_SECRET_ACCESS_KEY = requireEnv('R2_PDF_SECRET_ACCESS_KEY')

const r2 = createR2Client({ endpoint: R2_ENDPOINT, bucket: R2_BUCKET, accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY })
const jobs = createJobsClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const app = express()
app.use(express.json({ limit: '50mb' })) // el body trae fotos+structure del álbum entero, puede ser varios MB de JSON

function checkAuth(req: express.Request): boolean {
  const auth = req.header('authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  return token === CONTAINER_SECRET
}

app.get('/health', (_req, res) => res.status(200).send('ok'))

// Sin Bearer — la seguridad es el token firmado en la URL (ver r2.ts). Para
// que Jhon/Range lo abran directo en el navegador.
app.get('/download', async (req, res) => {
  const key = req.query.key as string | undefined
  const exp = req.query.exp as string | undefined
  const sig = req.query.sig as string | undefined
  if (!key) return res.status(400).send('Falta ?key=')
  if (!verifyDownloadToken(CONTAINER_SECRET, key, exp, sig)) return res.status(403).send('Token inválido o expirado')
  try {
    // Redirección a R2 en vez de proxear los bytes (ver r2.ts). La presigned
    // vive 15 min: el navegador la usa al instante, solo cubre un clic lento.
    const filename = key.split('/').filter(Boolean).slice(-3).join('-') || 'archivo.pdf' // <album>-interior-final.pdf
    const url = await r2.presignedDownloadUrl(key, filename, 15 * 60)
    res.redirect(302, url)
  } catch (err) {
    console.error(`[pdf-render-container] /download falló (${key}):`, err)
    res.status(500).send('No se pudo generar el link de descarga')
  }
})

interface RenderInteriorBody {
  albumId: string
  structure: AlbumStructure
  photos: Record<string, PhotoAsset>
  format: string
  baseUrl: string
}

interface RenderCoverBody {
  albumId: string
  cover: CoverConfig
  coverPhoto?: PhotoAsset
  structure: AlbumStructure
  format: string
  baseUrl: string
}

// Síncrono a propósito: el contenedor SÍ tiene el tiempo/RAM para hacerlo
// todo en una request (a diferencia del Worker CF, que necesitaba
// responder al toque y hacer el trabajo real en un Cron Trigger aparte).
// pdf_generation_jobs sigue reflejando generando_pdf → pdf_listo/error
// igual que antes — which=status/which=download de la ruta dev de pixia-web
// no cambian de contrato, solo de qué backend los llena.
app.post('/render-interior', async (req, res) => {
  if (!checkAuth(req)) return res.status(401).send('No autorizado')
  const body = req.body as Partial<RenderInteriorBody>
  if (!body.albumId || !body.structure || !body.format || !body.baseUrl) {
    return res.status(400).json({ error: 'Body inválido: se espera { albumId, structure, photos, format, baseUrl }' })
  }
  const { albumId, structure, format, baseUrl } = body
  const photosById = new Map(Object.entries(body.photos ?? {}))

  await jobs.startInteriorJob(albumId)
  try {
    const started = Date.now()
    const result = await renderInteriorPdf(structure, photosById, format, baseUrl)
    const elapsedMs = Date.now() - started
    for (const w of result.warnings) {
      console.warn(`[pdf-render-container] ${albumId} interior: foto ${w.photoId} a ${w.effectiveDpi} DPI (objetivo ${w.targetDpi})`)
    }
    const key = await r2.upload(`${albumId}/interior/final.pdf`, result.pdf, 'application/pdf')
    await jobs.markInteriorReady(albumId, key)
    console.log(`[pdf-render-container] ${albumId} interior completo: ${(result.pdf.length / (1024 * 1024)).toFixed(2)}MB en ${(elapsedMs / 1000).toFixed(1)}s`)
    res.status(200).json({ albumId, key, bytes: result.pdf.length, warningsCount: result.warnings.length, elapsedMs })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[pdf-render-container] ${albumId} interior falló:`, message)
    await jobs.markError(albumId, message)
    res.status(502).json({ error: message })
  }
})

app.post('/render-cover', async (req, res) => {
  if (!checkAuth(req)) return res.status(401).send('No autorizado')
  const body = req.body as Partial<RenderCoverBody>
  if (!body.albumId || !body.cover || !body.structure || !body.format || !body.baseUrl) {
    return res.status(400).json({ error: 'Body inválido: se espera { albumId, cover, structure, format, baseUrl }' })
  }
  const { albumId, cover, coverPhoto, structure, format, baseUrl } = body

  await jobs.startCoverJob(albumId)
  try {
    const result = await renderCoverPdf(cover, coverPhoto, structure, format, baseUrl)
    const key = await r2.upload(`${albumId}/cover/final.pdf`, result.pdf, 'application/pdf')
    await jobs.markCoverReady(albumId, key)
    console.log(`[pdf-render-container] ${albumId} cubierta completa: ${(result.pdf.length / (1024 * 1024)).toFixed(2)}MB`)
    res.status(200).json({ albumId, key, bytes: result.pdf.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[pdf-render-container] ${albumId} cubierta falló:`, message)
    await jobs.markError(albumId, message)
    res.status(502).json({ error: message })
  }
})

// Cola de producción pagado → PDF (ver queue.ts). La llama Cloud Scheduler
// cada 5 min con el mismo Bearer que el resto. Responde 200 aunque algún
// job falle (el detalle va en el body): los fallos se gestionan con los
// reintentos de la cola, no con reintentos del Scheduler.
//
// Las imágenes y fuentes del HTML ya son URLs absolutas (R2 público, Google
// Fonts); el <base href> solo cubre rutas relativas residuales. No puede ser
// pixiaa.com: está detrás de Cloudflare Access y Cloud Run no pasa.
const PRINT_BASE_URL = process.env.PRINT_BASE_URL || 'https://assets.pixiaa.com/'
let sweepRunning = false

app.post('/process-pending', async (req, res) => {
  if (!checkAuth(req)) return res.status(401).send('No autorizado')
  if (sweepRunning) return res.status(200).json({ skipped: 'ya hay un barrido corriendo en esta instancia' })
  sweepRunning = true
  try {
    const result = await runSweep({
      jobs,
      engine: { renderInterior: renderInteriorPdf, renderCover: renderCoverPdf, upload: (k, b, t) => r2.upload(k, b, t) },
      baseUrl: PRINT_BASE_URL,
    })
    console.log('[pdf-render-container] barrido:', JSON.stringify(result))
    res.status(200).json(result)
  } catch (err) {
    console.error('[pdf-render-container] barrido falló:', err)
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  } finally {
    sweepRunning = false
  }
})

// Almacenamiento: mide y limpia según la política de conservación (ver
// storage.ts y lib/retention.ts). Cloud Scheduler lo llama una vez al día;
// el admin puede pedir una medición (?mode=prueba) cuando quiera.
let cleanupRunning = false
app.post('/storage-cleanup', async (req, res) => {
  if (!checkAuth(req)) return res.status(401).send('No autorizado')
  if (cleanupRunning) return res.status(200).json({ skipped: 'ya hay una limpieza corriendo' })
  const requested = (req.query.mode as string | undefined) ?? process.env.STORAGE_CLEANUP_MODE ?? 'prueba'
  const mode: CleanupMode = requested === 'aplicada' ? 'aplicada' : 'prueba'
  cleanupRunning = true
  try {
    const report = await runStorageCleanup(mode)
    console.log('[pdf-render-container] almacenamiento:', JSON.stringify({ ...report, details: undefined }))
    res.status(200).json(report)
  } catch (err) {
    console.error('[pdf-render-container] limpieza falló:', err)
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  } finally {
    cleanupRunning = false
  }
})

// Diagnóstico — firma una URL de descarga para una key ya subida, sin pasar
// por pdf_generation_jobs (útil para probar /download suelto).
app.get('/sign', (req, res) => {
  if (!checkAuth(req)) return res.status(401).send('No autorizado')
  const key = req.query.key as string | undefined
  if (!key) return res.status(400).send('Falta ?key=')
  const baseUrl = `${req.protocol}://${req.get('host')}`
  res.status(200).json({ url: signDownloadUrl(CONTAINER_SECRET, baseUrl, key) })
})

app.listen(PORT, () => {
  console.log(`[pdf-render-container] escuchando en :${PORT}`)
})
