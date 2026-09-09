import type { BrowserWorker } from '@cloudflare/puppeteer'
import { PDFDocument } from 'pdf-lib'
import { createCloudflareRenderer, createCloudflarePageRenderer } from './cloudflareRenderer'
import { createJobsClient, type InteriorSection } from './jobs'
import { createR2Storage, verifyDownloadToken } from './r2Storage'
import { buildInteriorPages, buildCoverPage } from '../../../core/modules/print/generateAlbumPdfs'
import { getBookPrintProfile } from '../../../core/modules/print/printProfiles'
import type { AlbumStructure } from '../../../core/modules/foldModel/types'
import type { CoverConfig, PhotoAsset } from '../../../core/contracts/AlbumBlueprint'

export interface Env {
  /** Binding de Browser Rendering — nombre debe calzar con [browser].binding en wrangler.toml. */
  MYBROWSER: BrowserWorker
  /** Bucket R2 PRIVADO para páginas/PDF final — ver r2_buckets en wrangler.toml. */
  PDF_BUCKET: R2Bucket
  PDF_RENDER_SECRET: string
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

/**
 * DIAGNÓSTICO Y REDISEÑO — historial completo (tickets "rediseño async por
 * lotes" → "bloat del PDF" → "Brick 3 / R2"):
 *
 * v1 (síncrona): generaba TODO el interior en una invocación → error 1102
 * "Worker exceeded MEMORY limit" (confirmado en vivo).
 * v2 (self-continuation por ctx.waitUntil + fetch): falló en vivo dos veces
 * — waitUntil() solo se extiende ~30s después de responder, insuficiente
 * incluso para una página.
 * v3 (Cron Trigger maneja los lotes): scheduled() tiene su propio
 * presupuesto de hasta 15 min de wall time — funciona, confirmado en vivo,
 * progreso estable de a CHUNK_SIZE páginas por minuto.
 * v4 (bloat del PDF): object-fit:cover hacía que Chromium rasterizara cada
 * foto recortada en vez de preservar el JPEG (~7x más pesado) — reemplazado
 * por un cálculo manual de "cover" (ver core/modules/viewer/manualCover.ts).
 * También se sacó la carga de Google Fonts de páginas sin texto.
 * v5 (R2 privado) — los archivos (páginas, job-input, PDF final) se
 * movieron de Supabase Storage a un bucket R2 PRIVADO (pixia-pdfs-private,
 * ver r2Storage.ts) — el plan Free de Supabase Storage tiene un tope DE PLAN
 * de 50MB por archivo (no es el file_size_limit del bucket, que no lo puede
 * superar) — confirmado en vivo: el merge de 36 páginas (114MB) rebotaba
 * con "exceeded maximum allowed size" pese a tener el bucket configurado a
 * 200MB. R2 no tiene ese tope.
 *
 * v6 (ESTE brick) — sin combine final, el interior se entrega en SECCIONES:
 * mergear en sub-lotes (v5 llevaba esto a MERGE_BATCH_SIZE páginas por
 * tick) NO alcanza si al final igual se combinan todas las secciones en un
 * único archivo — confirmado en vivo, OOM persistente: el .save() de
 * pdf-lib (sin API streaming) necesita el documento COMPLETO en memoria, y
 * un interior de 100MB+ está al borde del isolate de 128MB sin importar
 * cuánto se sub-lotee el camino hasta ahí. La solución real es no armar
 * nunca ese archivo grande: cada SECCIÓN (MERGE_BATCH_SIZE páginas, ~35-40MB)
 * queda como su propio PDF final en R2 — pdf_generation_jobs.interior_sections
 * guarda la lista (key + rango de páginas), sin un "combine" que las una.
 * Range recibe 2-4 archivos en vez de uno solo (imprime página por página de
 * todos modos) — pendiente de confirmar con Range que este formato de
 * entrega les sirve.
 *
 * Descargar el PDF: no hay presigned URLs de S3 (eso pediría un Access
 * Key/Secret de R2 nuevos) — un token HMAC-SHA256 propio sobre `key|exp`,
 * firmado con el mismo PDF_RENDER_SECRET que ya comparten app↔worker, valida
 * en GET /download y streamea desde R2. La app firma la URL localmente
 * (mismo secreto, sin ida y vuelta) y solo el worker toca R2 directamente —
 * ver r2Storage.ts.
 *
 * Se evaluaron y descartaron Cloudflare Queues y Durable Objects — mismo
 * razonamiento que en v3, sigue sin hacer falta ninguno de los dos.
 */
const CHUNK_SIZE = 6
// ~12 páginas ≈ 35-40MB por sección con el peso post-fix-de-bloat medido en
// vivo (~3.2MB/página) — bien lejos del límite de 128MB del isolate, y da
// 2-4 secciones para álbumes típicos (20-40 páginas) en vez de un archivo
// gigante o docenas de partes chicas.
const MERGE_BATCH_SIZE = 12
const MAX_JOBS_PER_TICK = 5 // techo defensivo — a 100/mes la concurrencia real es rarísima

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
  /** Foto completa (no solo la URL) — width/height hacen falta para el recorte manual, ver manualCover.ts. */
  coverPhoto?: PhotoAsset
  structure: AlbumStructure
  format: string
  baseUrl: string
}

interface InteriorJobInput {
  structure: AlbumStructure
  photos: Record<string, PhotoAsset>
  format: string
  baseUrl: string
}

interface CoverJobInput {
  cover: CoverConfig
  coverPhoto?: PhotoAsset
  structure: AlbumStructure
  format: string
  baseUrl: string
}

function isRenderInteriorBody(x: unknown): x is RenderInteriorBody {
  if (!x || typeof x !== 'object') return false
  const b = x as Record<string, unknown>
  return typeof b.albumId === 'string' && typeof b.structure === 'object' && b.structure !== null && typeof b.format === 'string' && typeof b.baseUrl === 'string'
}

function isRenderCoverBody(x: unknown): x is RenderCoverBody {
  if (!x || typeof x !== 'object') return false
  const b = x as Record<string, unknown>
  return typeof b.albumId === 'string' && typeof b.cover === 'object' && b.cover !== null && typeof b.structure === 'object' && typeof b.format === 'string' && typeof b.baseUrl === 'string'
}

function checkAuth(req: Request, env: Env): boolean {
  const auth = req.headers.get('authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  return Boolean(env.PDF_RENDER_SECRET) && token === env.PDF_RENDER_SECRET
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    const r2 = createR2Storage(env.PDF_BUCKET, env.PDF_RENDER_SECRET, url.origin)

    if (url.pathname === '/health') {
      return new Response('ok', { status: 200 })
    }

    // Descarga real — sin Bearer, la seguridad es el token firmado en la URL
    // (ver r2Storage.ts). Pensado para que Jhon/Range lo abran directo en el
    // navegador, no para llamarlo desde código con el secreto compartido.
    if (req.method === 'GET' && url.pathname === '/download') {
      const key = url.searchParams.get('key')
      const exp = url.searchParams.get('exp')
      const sig = url.searchParams.get('sig')
      if (!key) return new Response('Falta ?key=', { status: 400 })
      const valid = await verifyDownloadToken(env.PDF_RENDER_SECRET, key, exp, sig)
      if (!valid) return new Response('Token inválido o expirado', { status: 403 })
      const obj = await env.PDF_BUCKET.get(key)
      if (!obj) return new Response('No encontrado', { status: 404 })
      const filename = key.split('/').pop() ?? 'archivo.pdf'
      return new Response(obj.body, {
        status: 200,
        headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${filename}"` },
      })
    }

    // Diagnóstico TEMPORAL — renderiza UNA página puntual y reporta su peso
    // real, SIN subirla. Se borra junto con el resto de la ruta dev.
    if (req.method === 'GET' && url.pathname === '/inspect-page') {
      if (!checkAuth(req, env)) return new Response('No autorizado', { status: 401 })
      const albumId = url.searchParams.get('albumId')
      const index = Number(url.searchParams.get('index') ?? '0')
      if (!albumId) return new Response('Falta ?albumId=', { status: 400 })

      const input = await r2.loadJobInput<InteriorJobInput>(albumId, 'interior')
      if (!input) return new Response('No hay job-input persistido para ese albumId (¿se disparó /render-interior alguna vez?)', { status: 404 })

      const profile = getBookPrintProfile(input.format)
      const photosById = new Map(Object.entries(input.photos ?? {}))
      const pages = buildInteriorPages(input.structure, photosById, { profile, baseUrl: input.baseUrl })
      const page = pages[index]
      if (!page) return new Response(`No existe la página ${index} (total ${pages.length})`, { status: 404 })

      const fold = input.structure.folds[Math.floor(index / 2)]
      const layoutId = fold.kind === 'paired' ? (index % 2 === 0 ? fold.left.layout : fold.right.layout) : 'hero-spread'

      const renderer = createCloudflareRenderer(env.MYBROWSER)
      let pdf: Uint8Array
      try {
        pdf = await renderer.renderPageToPdf(page.html, page.widthMm, page.heightMm)
      } finally {
        await renderer.close()
      }

      return json({
        albumId,
        index,
        foldKind: fold.kind,
        layoutId,
        htmlBytes: new TextEncoder().encode(page.html).length,
        pdfBytes: pdf.length,
        pdfMB: Number((pdf.length / (1024 * 1024)).toFixed(2)),
        sampleImageUrl: [...photosById.values()][0]?.url,
      })
    }

    // Diagnóstico TEMPORAL — renderiza HTML crudo a PDF y devuelve el peso.
    if (req.method === 'POST' && url.pathname === '/render-test') {
      if (!checkAuth(req, env)) return new Response('No autorizado', { status: 401 })
      const testBody = (await req.json().catch(() => null)) as { html?: string; widthMm?: number; heightMm?: number; label?: string } | null
      if (!testBody?.html || !testBody.widthMm || !testBody.heightMm) {
        return new Response('Body inválido: se espera { html, widthMm, heightMm, label? }', { status: 400 })
      }
      const renderer = createCloudflareRenderer(env.MYBROWSER)
      let pdf: Uint8Array
      try {
        pdf = await renderer.renderPageToPdf(testBody.html, testBody.widthMm, testBody.heightMm)
      } finally {
        await renderer.close()
      }
      return json({ label: testBody.label ?? null, pdfBytes: pdf.length, pdfMB: Number((pdf.length / (1024 * 1024)).toFixed(2)) })
    }

    if (req.method !== 'POST' || !['/render-interior', '/render-cover'].includes(url.pathname)) {
      return new Response('Not found', { status: 404 })
    }

    if (!checkAuth(req, env)) {
      return new Response('No autorizado', { status: 401 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return new Response('Body inválido', { status: 400 })
    }

    const jobs = createJobsClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

    if (url.pathname === '/render-interior') {
      if (!isRenderInteriorBody(body)) {
        return new Response('Body inválido: se espera { albumId, structure, photos, format, baseUrl }', { status: 400 })
      }
      const profile = getBookPrintProfile(body.format)
      const photosById = new Map(Object.entries(body.photos ?? {}))
      const pagesTotal = buildInteriorPages(body.structure, photosById, { profile, baseUrl: body.baseUrl }).length
      const input: InteriorJobInput = { structure: body.structure, photos: body.photos, format: body.format, baseUrl: body.baseUrl }
      await r2.saveJobInput(body.albumId, 'interior', input)
      await jobs.startInteriorJob(body.albumId, pagesTotal)
      return json({ status: 'generando_pdf', albumId: body.albumId, pagesTotal })
    }

    // /render-cover
    if (!isRenderCoverBody(body)) {
      return new Response('Body inválido: se espera { albumId, cover, structure, format, baseUrl }', { status: 400 })
    }
    const coverInput: CoverJobInput = { cover: body.cover, coverPhoto: body.coverPhoto, structure: body.structure, format: body.format, baseUrl: body.baseUrl }
    await r2.saveJobInput(body.albumId, 'cover', coverInput)
    await jobs.startCoverJob(body.albumId)
    return json({ status: 'generando_pdf', albumId: body.albumId })
  },

  /** Cron Trigger (ver [triggers] en wrangler.toml) — el motor real de los lotes, ver comentario arriba. */
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(processActiveJobs(env))
  },
}

async function processActiveJobs(env: Env) {
  const jobs = createJobsClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  // No hace falta una URL "real" para armar signedUrl acá — el worker no
  // firma nada por sí mismo en este paso, solo lee/escribe R2.
  const r2 = createR2Storage(env.PDF_BUCKET, env.PDF_RENDER_SECRET, 'https://internal.invalid')
  const active = await jobs.getActiveJobs()
  for (const job of active.slice(0, MAX_JOBS_PER_TICK)) {
    // Interior y cubierta avanzan independiente uno del otro (sesiones de
    // browser separadas) — no hay razón para que la cubierta espere a que
    // el interior termine sus páginas.
    if (!job.interior_sections) {
      try {
        // Dos fases, cada una su PROPIO tick — nunca comparten invocación
        // (evita el OOM). NO hay combine final a un solo archivo: se probó
        // en vivo y el .save() de pdf-lib sobre el resultado completo
        // (114MB para 36 páginas) revienta el isolate de 128MB sin importar
        // cuánto se sub-lotee el camino hasta ahí — pdf-lib no tiene
        // streaming, necesita el documento ENTERO en memoria para guardarlo.
        // El interior se entrega en SECCIONES (cada una ya cabe cómoda en
        // memoria por construcción, ver MERGE_BATCH_SIZE) — nunca se arma
        // un PDF más grande que eso.
        if (job.interior_pages_done < job.interior_pages_total) {
          await renderInteriorChunk(env, r2, jobs, job)
        } else {
          await mergeNextBatch(r2, jobs, job)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[pdf-render] ${job.blueprint_id} interior falló en el tick del cron:`, message)
        await jobs.markError(job.blueprint_id, message)
      }
    }
    if (!job.cover_done) {
      try {
        await advanceCover(env, r2, jobs, job)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[pdf-render] ${job.blueprint_id} cubierta falló en el tick del cron:`, message)
        await jobs.markError(job.blueprint_id, message)
      }
    }
  }
}

async function renderInteriorChunk(
  env: Env,
  r2: ReturnType<typeof createR2Storage>,
  jobs: ReturnType<typeof createJobsClient>,
  job: { blueprint_id: string; interior_pages_done: number; interior_pages_total: number },
) {
  const input = await r2.loadJobInput<InteriorJobInput>(job.blueprint_id, 'interior')
  if (!input) throw new Error('No se encontró el input persistido del job de interior (job-input.json)')

  const profile = getBookPrintProfile(input.format)
  const photosById = new Map(Object.entries(input.photos ?? {}))
  const pages = buildInteriorPages(input.structure, photosById, { profile, baseUrl: input.baseUrl })

  const offset = job.interior_pages_done
  const chunk = pages.slice(offset, offset + CHUNK_SIZE)
  if (chunk.length === 0) return

  const renderer = createCloudflarePageRenderer(env.MYBROWSER)
  try {
    for (let i = 0; i < chunk.length; i++) {
      const page = chunk[i]
      for (const w of page.warnings) {
        console.warn(`[pdf-render] ${job.blueprint_id} interior página ${offset + i}: foto ${w.photoId} a ${w.effectiveDpi} DPI (objetivo ${w.targetDpi})`)
      }
      const pdf = await renderer.renderPageToPdf(page.html, page.widthMm, page.heightMm)
      await r2.uploadPagePdf(job.blueprint_id, 'interior', offset + i, pdf)
    }
  } finally {
    await renderer.close()
  }
  await jobs.bumpInteriorProgress(job.blueprint_id, offset + chunk.length)
  console.log(`[pdf-render] ${job.blueprint_id} interior: ${offset + chunk.length}/${pages.length} páginas`)
}

/**
 * Mergea UN sub-lote (MERGE_BATCH_SIZE páginas) en una SECCIÓN del interior
 * y la sube a R2 — nunca las páginas completas del álbum juntas, y NUNCA se
 * combinan las secciones en un solo archivo final (ver comentario largo en
 * processActiveJobs: eso era justo lo que reventaba la memoria). Cuando esta
 * es la ÚLTIMA sección, el job queda listo directamente acá — no hay un
 * paso de "combine final" separado.
 */
async function mergeNextBatch(
  r2: ReturnType<typeof createR2Storage>,
  jobs: ReturnType<typeof createJobsClient>,
  job: { blueprint_id: string; interior_pages_total: number; interior_merge_batches_done: number },
) {
  const batchIndex = job.interior_merge_batches_done
  const start = batchIndex * MERGE_BATCH_SIZE
  const end = Math.min(start + MERGE_BATCH_SIZE, job.interior_pages_total)
  const totalBatches = Math.ceil(job.interior_pages_total / MERGE_BATCH_SIZE)

  const partDoc = await PDFDocument.create()
  for (let i = start; i < end; i++) {
    const key = `${job.blueprint_id}/interior/page-${String(i).padStart(4, '0')}.pdf`
    const pageBytes = await r2.downloadPagePdf(key)
    const doc = await PDFDocument.load(pageBytes)
    const [copied] = await partDoc.copyPages(doc, [0])
    partDoc.addPage(copied)
  }
  const partBytes = await partDoc.save()
  const partKey = `${job.blueprint_id}/interior/section-${String(batchIndex).padStart(3, '0')}.pdf`
  await r2.uploadRaw(partKey, partBytes)

  const batchesDone = batchIndex + 1
  await jobs.bumpMergeProgress(job.blueprint_id, batchesDone)
  console.log(`[pdf-render] ${job.blueprint_id} interior sección ${batchesDone}/${totalBatches} (páginas ${start}-${end - 1}, ${(partBytes.length / (1024 * 1024)).toFixed(2)}MB)`)

  if (batchesDone >= totalBatches) {
    // Última sección — el job queda listo con la LISTA de secciones, no un
    // único archivo. Determinístico a partir del total de páginas, no hace
    // falta releer nada de R2 para armar el manifiesto.
    const sections: InteriorSection[] = Array.from({ length: totalBatches }, (_, b) => ({
      key: `${job.blueprint_id}/interior/section-${String(b).padStart(3, '0')}.pdf`,
      pageStart: b * MERGE_BATCH_SIZE,
      pageEnd: Math.min((b + 1) * MERGE_BATCH_SIZE, job.interior_pages_total) - 1,
    }))
    await jobs.markInteriorReady(job.blueprint_id, sections)
    console.log(`[pdf-render] ${job.blueprint_id} interior completo: ${job.interior_pages_total} páginas en ${totalBatches} secciones`)
  }
}

async function advanceCover(env: Env, r2: ReturnType<typeof createR2Storage>, jobs: ReturnType<typeof createJobsClient>, job: { blueprint_id: string }) {
  const input = await r2.loadJobInput<CoverJobInput>(job.blueprint_id, 'cover')
  if (!input) throw new Error('No se encontró el input persistido del job de cubierta (job-input.json)')

  const profile = getBookPrintProfile(input.format)
  const page = buildCoverPage(input.cover, input.coverPhoto, input.structure, { profile, baseUrl: input.baseUrl })
  const renderer = createCloudflareRenderer(env.MYBROWSER)
  let pdf: Uint8Array
  try {
    pdf = await renderer.renderPageToPdf(page.html, page.widthMm, page.heightMm)
  } finally {
    await renderer.close()
  }
  const key = await r2.uploadFinalPdf(job.blueprint_id, 'cover', pdf)
  await jobs.markCoverReady(job.blueprint_id, key)
  console.log(`[pdf-render] ${job.blueprint_id} cubierta completa`)
}

function json(data: unknown, status = 202): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
}
