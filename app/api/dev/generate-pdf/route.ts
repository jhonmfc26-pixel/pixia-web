import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { normalizeBook } from '@/core/modules/album/normalizeBook'
import { foldsFromBlueprint } from '@/core/modules/foldModel/fromBlueprint'
import { validateAlbumStructure } from '@/core/modules/foldModel/validateStructure'
import type { AlbumStructure } from '@/core/modules/foldModel/types'
import type { PhotoAsset } from '@/core/contracts/AlbumBlueprint'

export const runtime = 'edge'

/**
 * ⚠️ RUTA TEMPORAL DE DESARROLLO — dispara y consulta la generación de PDF
 * REAL. Se borra cuando exista el trigger de producción (webhook de Wompi
 * ya listo para engancharse — ver print_status en app/api/orders/webhook/route.ts).
 *
 * Deshabilitada por completo salvo que se cumplan LAS DOS condiciones:
 *   1. NODE_ENV !== 'production' — estructuralmente inalcanzable en
 *      cualquier deploy de Cloudflare Pages, solo responde con `next dev`.
 *   2. DEV_PDF_SECRET seteado en el entorno Y pasado como ?secret= — falla
 *      cerrado, no abierto, si falta.
 *
 * DOS MOTORES coexisten mientras se valida la migración (ver ticket
 * "migración a contenedor Playwright") — elegir con ?engine=worker|container
 * (default: worker, el que ya estaba funcionando):
 *   - worker: Worker de Cloudflare (workers/pdf-render/) — 128MB de RAM,
 *     genera por lotes vía Cron Trigger, el interior queda en SECCIONES
 *     (nunca un solo archivo, ver interior_sections).
 *   - container: contenedor Playwright en Cloud Run
 *     (services/pdf-render-container/) — RAM real, genera el álbum COMPLETO
 *     en una sola pasada de Chromium, sin merge. El interior queda en UN
 *     solo archivo (interior_path).
 *
 * IMPORTANTE — el comportamiento de ?which=interior|cover|both YA NO es
 * igual entre motores: worker sigue siendo fire-and-forget (202, no
 * bloquea, se consulta con ?which=status) porque el Cron Trigger lo procesa
 * en segundo plano; container es SÍNCRONO (200, ya terminó cuando responde)
 * porque el contenedor sí tiene tiempo/RAM para hacerlo todo en la misma
 * request. ?which=status y ?which=download funcionan igual para los dos —
 * leen pdf_engine en pdf_generation_jobs para saber con qué secreto firmar.
 *
 * Uso típico:
 *   GET ...?albumId=<id>&secret=<DEV_PDF_SECRET>&which=both&engine=container
 *   GET ...?albumId=<id>&secret=...&which=status     (repetir hasta pdf_listo)
 *   GET ...?albumId=<id>&secret=...&which=download
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'No disponible' }, { status: 404 })
  }

  const devSecret = process.env.DEV_PDF_SECRET
  if (!devSecret) {
    return NextResponse.json(
      { error: 'Ruta deshabilitada: falta DEV_PDF_SECRET en el entorno. Setealo en .env.local para habilitarla (nunca en producción).' },
      { status: 404 },
    )
  }
  if (req.nextUrl.searchParams.get('secret') !== devSecret) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const albumId = req.nextUrl.searchParams.get('albumId')
  if (!albumId) {
    return NextResponse.json({ error: 'Falta ?albumId=<id del blueprint>' }, { status: 400 })
  }

  const which = req.nextUrl.searchParams.get('which') ?? 'interior'
  if (!['interior', 'cover', 'both', 'status', 'download', 'inspect', 'croptest'].includes(which)) {
    return NextResponse.json({ error: `?which= inválido: "${which}". Usar interior | cover | both | status | download | inspect | croptest.` }, { status: 400 })
  }

  const engine = req.nextUrl.searchParams.get('engine') ?? 'worker'
  if (engine !== 'worker' && engine !== 'container') {
    return NextResponse.json({ error: `?engine= inválido: "${engine}". Usar worker | container.` }, { status: 400 })
  }

  // ── croptest: DIAGNÓSTICO TEMPORAL (ticket "bloat del PDF") — arma HTML
  // aislado con distintas técnicas de recorte CSS sobre la MISMA foto real,
  // y mide el peso del PDF de cada una vía /render-test del worker. Objetivo:
  // encontrar cuál técnica dispara la rasterización de Chromium.
  if (which === 'croptest') {
    const workerUrl = process.env.PDF_RENDER_WORKER_URL
    const workerSecret = process.env.PDF_RENDER_SECRET
    if (!workerUrl || !workerSecret) {
      return NextResponse.json({ error: 'Falta PDF_RENDER_WORKER_URL/PDF_RENDER_SECRET' }, { status: 500 })
    }
    const imgUrl = req.nextUrl.searchParams.get('img')
    if (!imgUrl) return NextResponse.json({ error: 'Falta ?img=<url real de una foto>' }, { status: 400 })

    const PAGE_MM = 150
    const SLOT_MM = 100 // slot cuadrado, más chico que la página — fuerza que el <img> real (no cuadrado) tenga que recortarse

    const page = (bodyContent: string) => `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>
* { margin:0; padding:0; box-sizing:border-box; }
html,body { width:${PAGE_MM}mm; height:${PAGE_MM}mm; }
@page { size:${PAGE_MM}mm ${PAGE_MM}mm; margin:0; }
.slot { width:${SLOT_MM}mm; height:${SLOT_MM}mm; position:relative; }
</style></head><body>${bodyContent}</body></html>`

    const variants: Record<string, string> = {
      // Patrón EXACTO de producción (SpreadFaces.tsx): overflow:hidden + object-fit:cover.
      'objectfit-cover': page(`<div class="slot" style="overflow:hidden"><img src="${imgUrl}" style="width:100%;height:100%;object-fit:cover;object-position:center center;display:block" /></div>`),
      // object-fit:cover SIN el overflow:hidden envolvente.
      'objectfit-cover-no-overflow': page(`<div class="slot"><img src="${imgUrl}" style="width:100%;height:100%;object-fit:cover;object-position:center center;display:block" /></div>`),
      // overflow:hidden recortando por posición absoluta, SIN object-fit.
      'overflow-absolute-no-objectfit': page(`<div class="slot" style="overflow:hidden"><img src="${imgUrl}" style="position:absolute;top:-50%;left:-50%;width:200%;height:200%;display:block" /></div>`),
      // Recorte vía clip-path en vez de overflow+object-fit.
      'clip-path': page(`<div class="slot"><img src="${imgUrl}" style="width:100%;height:100%;object-fit:cover;object-position:center center;display:block;clip-path:inset(0)" /></div>`),
      // background-image + background-size:cover en vez de <img>.
      'background-cover': page(`<div class="slot" style="background-image:url('${imgUrl}');background-size:cover;background-position:center center"></div>`),
      // <img> sin ningún recorte (tamaño natural, sin forzar aspect ratio) — baseline.
      'no-crop-natural': page(`<img src="${imgUrl}" style="display:block;max-width:${SLOT_MM}mm;max-height:${SLOT_MM}mm" />`),
      // "Cover" MANUAL asimétrico (constrain por alto, centrar y recortar los
      // costados vía position+transform) — la alternativa real a object-fit,
      // no solo el símil simétrico 200%/-50% del primer test.
      'manual-cover-asymmetric': page(`<div class="slot"><img src="${imgUrl}" style="position:absolute;top:0;left:50%;height:100%;width:auto;max-width:none;transform:translateX(-50%);display:block" /></div>`),
    }

    const results: Record<string, unknown> = {}
    for (const [label, html] of Object.entries(variants)) {
      const res = await fetch(`${workerUrl.replace(/\/$/, '')}/render-test`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${workerSecret}` },
        body: JSON.stringify({ html, widthMm: PAGE_MM, heightMm: PAGE_MM, label }),
      })
      results[label] = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    }
    return NextResponse.json({ imgUrl, pageMm: PAGE_MM, slotMm: SLOT_MM, results })
  }

  // ── inspect: DIAGNÓSTICO TEMPORAL (ticket "límite de tamaño de Storage")
  // — proxy a /inspect-page del worker, solo para tener el secreto compartido
  // sin que yo (agente) lo lea directo. Se borra con el resto de la ruta dev.
  if (which === 'inspect') {
    const workerUrl = process.env.PDF_RENDER_WORKER_URL
    const workerSecret = process.env.PDF_RENDER_SECRET
    if (!workerUrl || !workerSecret) {
      return NextResponse.json({ error: 'Falta PDF_RENDER_WORKER_URL/PDF_RENDER_SECRET' }, { status: 500 })
    }
    const page = req.nextUrl.searchParams.get('page') ?? '0'
    const res = await fetch(`${workerUrl.replace(/\/$/, '')}/inspect-page?albumId=${albumId}&index=${page}`, {
      headers: { authorization: `Bearer ${workerSecret}` },
    })
    const data = await res.json().catch(() => ({ error: 'respuesta no-JSON del worker' }))
    return NextResponse.json(data, { status: res.status })
  }

  // ── status / download no necesitan el worker, solo leen Supabase ───────
  if (which === 'status') {
    const { data: job, error } = await supabaseAdmin.from('pdf_generation_jobs').select('*').eq('blueprint_id', albumId).single()
    if (error || !job) {
      return NextResponse.json({ error: `No hay job de generación para "${albumId}" (¿todavía no se disparó con ?which=interior|cover|both?)` }, { status: 404 })
    }
    return NextResponse.json({
      albumId,
      status: job.status,
      engine: job.pdf_engine,
      interior: {
        // worker: por lotes, en secciones. container: una sola pasada, un archivo.
        pagesDone: job.interior_pages_done,
        pagesTotal: job.interior_pages_total,
        ready: Boolean(job.interior_sections) || Boolean(job.interior_path),
        sectionsDone: job.interior_merge_batches_done,
        sectionsTotal: job.interior_pages_total ? Math.ceil(job.interior_pages_total / 12) : null, // 12 = MERGE_BATCH_SIZE del worker (paquete separado, no importable acá) — no aplica a container
      },
      cover: { ready: job.cover_done },
      errorMessage: job.error_message,
      attemptCount: job.attempt_count,
      updatedAt: job.updated_at,
    })
  }

  if (which === 'download') {
    const { data: job, error } = await supabaseAdmin.from('pdf_generation_jobs').select('*').eq('blueprint_id', albumId).single()
    if (error || !job) {
      return NextResponse.json({ error: `No hay job de generación para "${albumId}"` }, { status: 404 })
    }
    // pdf_engine dice quién generó el job — cada motor valida su propio
    // token de descarga con su propio secreto (PDF_RENDER_SECRET vs
    // PDF_CONTAINER_SECRET), así que hay que firmar con el que corresponda.
    // Jobs viejos (de antes de este campo) caen al worker por default.
    const jobEngine: 'worker' | 'container' = job.pdf_engine === 'container' ? 'container' : 'worker'
    const baseUrl = jobEngine === 'container' ? process.env.PDF_CONTAINER_URL : process.env.PDF_RENDER_WORKER_URL
    const secret = jobEngine === 'container' ? process.env.PDF_CONTAINER_SECRET : process.env.PDF_RENDER_SECRET
    if (!baseUrl || !secret) {
      return NextResponse.json({ error: `Falta configurar ${jobEngine === 'container' ? 'PDF_CONTAINER_URL/PDF_CONTAINER_SECRET' : 'PDF_RENDER_WORKER_URL/PDF_RENDER_SECRET'}` }, { status: 500 })
    }

    const expiresInSeconds = 3600
    let interior: unknown = null
    if (jobEngine === 'worker') {
      // Worker: NUNCA un único archivo (ver comentario largo en
      // workers/pdf-render/src/index.ts — reventaba la memoria) — son
      // SECCIONES, cada una firmada aparte.
      const interiorSections: { key: string; pageStart: number; pageEnd: number }[] = job.interior_sections ?? []
      interior = await Promise.all(
        interiorSections.map(async (s) => ({
          pageStart: s.pageStart,
          pageEnd: s.pageEnd,
          url: await signR2DownloadUrl(secret, baseUrl, s.key, expiresInSeconds),
        })),
      )
    } else if (job.interior_path) {
      // Container: un solo archivo (generado en una pasada, sin merge).
      interior = { url: await signR2DownloadUrl(secret, baseUrl, job.interior_path, expiresInSeconds) }
    }
    const cover = job.cover_path ? await signR2DownloadUrl(secret, baseUrl, job.cover_path, expiresInSeconds) : null
    const interiorEmpty = Array.isArray(interior) ? interior.length === 0 : !interior
    if (interiorEmpty && !cover) {
      return NextResponse.json({ error: `Todavía no hay PDFs listos para "${albumId}" (status: ${job.status}). Consultar ?which=status.` }, { status: 409 })
    }
    return NextResponse.json({ albumId, status: job.status, engine: jobEngine, interior, cover, expiresInSeconds })
  }

  // ── interior / cover / both: cargar datos y disparar el job ────────────
  const engineUrl = engine === 'container' ? process.env.PDF_CONTAINER_URL : process.env.PDF_RENDER_WORKER_URL
  const engineSecret = engine === 'container' ? process.env.PDF_CONTAINER_SECRET : process.env.PDF_RENDER_SECRET
  if (!engineUrl || !engineSecret) {
    const varNames = engine === 'container' ? 'PDF_CONTAINER_URL/PDF_CONTAINER_SECRET' : 'PDF_RENDER_WORKER_URL/PDF_RENDER_SECRET'
    return NextResponse.json({ error: `Falta configurar ${varNames} en el entorno.` }, { status: 500 })
  }

  let book
  try {
    const { data, error } = await supabaseAdmin.from('blueprints').select('*').eq('id', albumId).single()
    if (error || !data) {
      return NextResponse.json({ error: `Álbum "${albumId}" no encontrado en Supabase: ${error?.message ?? 'sin datos'}` }, { status: 404 })
    }
    book = normalizeBook(data, albumId)
  } catch (err) {
    return NextResponse.json({ error: `Error cargando el álbum desde Supabase: ${err instanceof Error ? err.message : String(err)}` }, { status: 502 })
  }

  let structure: AlbumStructure
  if (book.structure) {
    const knownIds = new Set<string>()
    for (const s of book.spreads) for (const p of s.photos) knownIds.add(p.id)
    const validation = validateAlbumStructure(book.structure, knownIds)
    structure = validation.ok ? book.structure : foldsFromBlueprint(book).structure
    if (!validation.ok) console.warn('[dev/generate-pdf] structure guardada inválida, derivando desde el blueprint:', validation.reason)
  } else {
    structure = foldsFromBlueprint(book).structure
  }
  if (structure.folds.length === 0) {
    return NextResponse.json({ error: `El álbum "${albumId}" no tiene pliegos (structure vacía) — no hay nada que generar.` }, { status: 422 })
  }

  const photosById = new Map<string, PhotoAsset>()
  for (const spread of book.spreads) {
    for (const photo of spread.photos) photosById.set(photo.id, photo)
  }
  const coverPhoto = (book.cover.photoId && photosById.get(book.cover.photoId)) || [...photosById.values()][0]
  const baseUrl = req.nextUrl.origin
  const photos = Object.fromEntries(photosById)

  const callEngine = async (path: string, payload: unknown) => {
    const res = await fetch(`${engineUrl.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${engineSecret}` },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown')
      throw new Error(`${engine} respondió ${res.status} en ${path}: ${errText}`)
    }
    return res.json()
  }

  try {
    // worker: fire-and-forget, 202, el Cron Trigger hace el trabajo real —
    // container: SÍNCRONO, ya terminó de renderizar+subir cuando responde
    // (ver doc comment arriba). callEngine espera la respuesta completa en
    // los dos casos, la diferencia es CUÁNTO tarda esa espera.
    const results: Record<string, unknown> = {}
    if (which === 'interior' || which === 'both') {
      results.interior = await callEngine('/render-interior', { albumId, structure, photos, format: book.format, baseUrl })
    }
    if (which === 'cover' || which === 'both') {
      results.cover = await callEngine('/render-cover', { albumId, cover: book.cover, coverPhoto, structure, format: book.format, baseUrl })
    }
    return NextResponse.json(
      {
        albumId,
        engine,
        results,
        status: engine === 'container' ? 'listo (síncrono)' : 'generando_pdf',
        hint:
          engine === 'container'
            ? `Generación completa — resultado en "results". Descargar con ?albumId=${albumId}&secret=...&which=download&engine=container`
            : `Generación disparada en segundo plano (por lotes, no bloquea). Consultar progreso con ?albumId=${albumId}&secret=...&which=status`,
      },
      { status: engine === 'container' ? 200 : 202 },
    )
  } catch (err) {
    console.error('[dev/generate-pdf] Error disparando la generación:', err)
    return NextResponse.json(
      {
        error: `Falló la generación (${which}, engine=${engine}) para "${albumId}": ${err instanceof Error ? err.message : String(err)}`,
        hint:
          engine === 'container'
            ? 'Confirmar que el contenedor pdf-render está desplegado y responde en PDF_CONTAINER_URL/health, y que PDF_CONTAINER_SECRET coincide con el que se le puso al servicio.'
            : 'Confirmar que el worker pdf-render está desplegado y responde en PDF_RENDER_WORKER_URL/health, y que PDF_RENDER_SECRET coincide con el que se le puso al worker (wrangler secret put). También confirmar que supabase/pdf_jobs.sql, pdf_jobs_merge_batches.sql, pdf_jobs_sections.sql y pdf_jobs_engine.sql ya se corrieron.',
      },
      { status: 502 },
    )
  }
}

/**
 * Firma una URL de descarga para una key de R2 (Brick 3) — MISMO esquema
 * que verifyDownloadToken en workers/pdf-render/src/r2Storage.ts (HMAC-SHA256
 * base64url sobre `key|exp`, mismo PDF_RENDER_SECRET compartido). Se firma
 * acá en vez de pedírselo al worker porque la app ya tiene todo lo que hace
 * falta (el secreto, la key desde pdf_generation_jobs) — evita una ida y
 * vuelta innecesaria. El worker nunca expone el bucket R2 directo, solo a
 * través de /download validando esta misma firma.
 */
async function signR2DownloadUrl(secret: string, workerUrl: string, key: string, expiresInSeconds: number): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(`${key}|${exp}`))
  let binary = ''
  for (const byte of new Uint8Array(sigBuf)) binary += String.fromCharCode(byte)
  const sig = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const url = new URL('/download', workerUrl)
  url.searchParams.set('key', key)
  url.searchParams.set('exp', String(exp))
  url.searchParams.set('sig', sig)
  return url.toString()
}
