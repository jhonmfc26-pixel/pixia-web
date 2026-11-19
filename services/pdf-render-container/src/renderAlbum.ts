import { chromium, type Page } from 'playwright'
import { buildInteriorPageElements, buildCoverPage } from '@/core/modules/print/generateAlbumPdfs'
import { wrapPrintAlbumHtml } from '@/core/modules/print/renderPrintAlbumHtml'
import { getBookPrintProfile } from '@/core/modules/print/printProfiles'
import type { AlbumStructure } from '@/core/modules/foldModel/types'
import type { CoverConfig, PhotoAsset } from '@/core/contracts/AlbumBlueprint'
import type { DpiWarning } from '@/core/modules/print/dpiCheck'
import { allowedPrintHosts, isAllowedPrintUrl, isPixiaAsset } from './printHosts'
import { imageInfo, placeholderSvg, requiredScale, downscaleForPrint, limiter, type ImageInfo } from './printImages'

export interface RenderResult {
  pdf: Uint8Array
  warnings: DpiWarning[]
}

/**
 * Interior COMPLETO en UNA sola pasada — reusa exactamente los mismos
 * componentes de render que el viewer (WYSIWYG por construcción) y el mismo
 * PrintProfile, pero arma TODAS las páginas como UN documento HTML (ver
 * wrapPrintAlbumHtml) y le pide a Chromium real (Playwright) que lo pagine
 * de un tirón — sin generar página por página ni mergear con pdf-lib. Esto
 * es justo lo que elimina el OOM del Worker de Cloudflare: acá hay RAM real
 * (2GB+ configurados en Cloud Run) y Chromium hace SU trabajo normal de
 * paginar un documento largo, algo para lo que está diseñado.
 */
export async function renderInteriorPdf(structure: AlbumStructure, photosById: Map<string, PhotoAsset>, format: string, baseUrl: string): Promise<RenderResult> {
  const profile = getBookPrintProfile(format)
  const { pages, widthMm, heightMm } = buildInteriorPageElements(structure, photosById, { profile })
  const warnings = pages.flatMap((p) => p.warnings)

  const html = wrapPrintAlbumHtml(
    pages.map((p) => ({ element: p.element, needsFonts: p.needsFonts })),
    { widthMm, heightMm, baseUrl },
  )

  const pdf = await renderHtmlToPdf(html, widthMm, heightMm, baseUrl)
  return { pdf, warnings }
}

/** Cubierta — 1 sola página física, sigue siendo un solo render.pdf() como antes (nunca tuvo el problema de OOM). */
export async function renderCoverPdf(cover: CoverConfig, coverPhoto: PhotoAsset | undefined, structure: AlbumStructure, format: string, baseUrl: string): Promise<RenderResult> {
  const profile = getBookPrintProfile(format)
  const page = buildCoverPage(cover, coverPhoto, structure, { profile, baseUrl })
  const pdf = await renderHtmlToPdf(page.html, page.widthMm, page.heightMm, baseUrl)
  return { pdf, warnings: [] }
}

/** Lo que se ve en el papel: si alguno de estos no carga, el PDF sale mal. */
const VISIBLE_RESOURCES = new Set(['image', 'font', 'stylesheet'])

/**
 * HTML → PDF con Chromium. Falla (en vez de entregar un PDF incompleto) si
 * alguna foto, fuente u hoja de estilos no cargó: un PDF con un recuadro vacío
 * o con otra letra no se puede mandar a la imprenta, y nadie lo vería hasta
 * tener el álbum impreso en la mano. El error dice qué fue lo que no cargó; la
 * cola reintenta y, si sigue fallando, avisa al equipo.
 *
 * Las fotos se entregan reducidas a lo que ocupan en la página a 300 ppp
 * (ver printImages.ts): dos pasadas, una para medir y otra para imprimir.
 */
export async function renderHtmlToPdf(
  html: string, widthMm: number, heightMm: number, baseUrl: string,
  opts: {
    /** Solo para pruebas: preparar la página (por ejemplo, servir fuentes desde el disco). */
    prepare?: (page: Page) => Promise<void>
    /** Solo para pruebas: de dónde se descargan las fotos (por defecto, la red). */
    fetchAsset?: (url: string) => Promise<FetchedAsset>
  } = {},
): Promise<Uint8Array> {
  const browser = await chromium.launch({ args: ['--no-sandbox'] }) // --no-sandbox: estándar dentro de un contenedor Docker (sin namespaces de usuario disponibles)
  try {
    const hosts = allowedPrintHosts(baseUrl)
    const fetchAsset = opts.fetchAsset ?? fetchFromNetwork
    const isPhoto = (url: string, type: string) => type === 'image' && isPixiaAsset(url)

    // ── 1. Medir: cada foto como un SVG vacío de sus mismas medidas ─────────
    // Mismo documento, misma diagramación, sin decodificar ninguna foto.
    const infos = new Map<string, ImageInfo | null>()
    const measureSlot = limiter(6)
    const scales = new Map<string, number>()
    {
      const context = await browser.newContext()
      const page = await context.newPage()
      await page.route('**/*', async (route) => {
        const req = route.request()
        const url = req.url()
        if (!isAllowedPrintUrl(url, hosts)) return route.abort('blockedbyclient')
        if (!isPhoto(url, req.resourceType())) return route.continue()
        const info = await measureSlot(async () => {
          const got = await fetchAsset(url).catch(() => null)
          return got && got.ok && got.bytes ? imageInfo(got.bytes) : null
        })
        infos.set(url, info)
        // Si no se pudo leer, la segunda pasada la vuelve a pedir y ahí se reporta.
        if (!info) return route.fulfill({ status: 404, body: '' })
        return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: placeholderSvg(info) })
      })
      await opts.prepare?.(page)
      await page.setContent(html, { waitUntil: 'networkidle', timeout: LOAD_TIMEOUT_MS })
      const boxes = await page.evaluate(() =>
        Array.from(document.images).map((img) => {
          const r = img.getBoundingClientRect()
          return { url: img.currentSrc || img.src, width: r.width, height: r.height }
        }))
      for (const b of boxes) {
        const info = infos.get(b.url)
        if (!info) continue
        const s = requiredScale(b, info)
        scales.set(b.url, Math.max(scales.get(b.url) ?? 0, s))
      }
      await context.close()
    }

    // ── 2. Imprimir con cada foto del tamaño justo ──────────────────────────
    const context = await browser.newContext()
    const page = await context.newPage()
    const failed = new Map<string, string>() // dirección → motivo
    const printSlot = limiter(2)

    // Solo se descarga del almacenamiento de Pixia y de Google Fonts (ver printHosts.ts).
    await page.route('**/*', async (route) => {
      const req = route.request()
      const url = req.url()
      if (!isAllowedPrintUrl(url, hosts)) {
        failed.set(url, 'dominio no permitido')
        return route.abort('blockedbyclient')
      }
      if (!isPhoto(url, req.resourceType())) return route.continue()
      const out = await printSlot(async () => {
        const got = await fetchAsset(url).catch(() => null)
        if (!got) return { abort: true as const }
        if (!got.ok || !got.bytes) return { status: got.status }
        const info = infos.get(url) ?? await imageInfo(got.bytes)
        const smaller = info ? await downscaleForPrint(got.bytes, info, scales.get(url) ?? 1) : null
        return smaller
          ? { status: 200, body: smaller, contentType: 'image/jpeg' }
          : { status: 200, body: got.bytes, contentType: got.contentType }
      })
      if ('abort' in out) return route.abort('failed')
      if (out.status !== 200 || !('body' in out)) return route.fulfill({ status: out.status, body: '' })
      return route.fulfill({ status: 200, body: out.body, contentType: out.contentType })
    })
    page.on('requestfailed', (req) => {
      if (VISIBLE_RESOURCES.has(req.resourceType()) && !failed.has(req.url())) failed.set(req.url(), req.failure()?.errorText ?? 'no cargó')
    })
    page.on('response', (res) => {
      if (res.status() >= 400 && VISIBLE_RESOURCES.has(res.request().resourceType())) failed.set(res.url(), `HTTP ${res.status()}`)
    })

    await opts.prepare?.(page)

    // networkidle: espera a que las fuentes de Google Fonts y las fotos
    // terminen de cargar antes de capturar el PDF.
    await page.setContent(html, { waitUntil: 'networkidle', timeout: LOAD_TIMEOUT_MS })

    // Segunda comprobación, en el documento: imágenes que quedaron rotas o sin
    // dirección (eso no genera ninguna petición que falle).
    const broken = await page.evaluate(() =>
      Array.from(document.images)
        .filter((img) => !(img.complete && img.naturalWidth > 0))
        .map((img) => img.currentSrc || img.getAttribute('src') || ''))
    for (const src of broken) if (!failed.has(src)) failed.set(src, src ? 'imagen rota' : 'imagen sin dirección')

    if (failed.size > 0) throw new Error(describeFailedResources(failed))

    const pdf = await page.pdf({
      width: `${widthMm}mm`,
      height: `${heightMm}mm`,
      printBackground: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
    })
    return pdf
  } finally {
    await browser.close()
  }
}

/** Cargar todas las fotos puede tardar con 100 fotos (Cloud Run corta a los 5 min). */
const LOAD_TIMEOUT_MS = 180_000

export interface FetchedAsset {
  ok: boolean
  status: number
  bytes?: Buffer
  contentType?: string
}

async function fetchFromNetwork(url: string): Promise<FetchedAsset> {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  if (!res.ok) return { ok: false, status: res.status }
  return { ok: true, status: res.status, bytes: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get('content-type') ?? undefined }
}

/** Una dirección data: puede pesar megas: en el mensaje solo va el comienzo. */
const short = (url: string) => (url.length > 120 ? `${url.slice(0, 117)}...` : url || '(sin dirección)')

export function describeFailedResources(failed: Map<string, string>): string {
  const list = [...failed].slice(0, 5).map(([url, why]) => `${short(url)} (${why})`).join('; ')
  const n = failed.size
  return `${n === 1 ? 'No cargó 1 foto o fuente' : `No cargaron ${n} fotos o fuentes`} del álbum, no se genera el PDF: ${list}${n > 5 ? `; y ${n - 5} más` : ''}`
}
