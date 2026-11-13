import { chromium, type Page } from 'playwright'
import { buildInteriorPageElements, buildCoverPage } from '@/core/modules/print/generateAlbumPdfs'
import { wrapPrintAlbumHtml } from '@/core/modules/print/renderPrintAlbumHtml'
import { getBookPrintProfile } from '@/core/modules/print/printProfiles'
import type { AlbumStructure } from '@/core/modules/foldModel/types'
import type { CoverConfig, PhotoAsset } from '@/core/contracts/AlbumBlueprint'
import type { DpiWarning } from '@/core/modules/print/dpiCheck'
import { allowedPrintHosts, isAllowedPrintUrl } from './printHosts'

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
 */
export async function renderHtmlToPdf(
  html: string, widthMm: number, heightMm: number, baseUrl: string,
  /** Solo para pruebas: preparar la página (por ejemplo, servir fotos y fuentes desde el disco). */
  opts: { prepare?: (page: Page) => Promise<void> } = {},
): Promise<Uint8Array> {
  const browser = await chromium.launch({ args: ['--no-sandbox'] }) // --no-sandbox: estándar dentro de un contenedor Docker (sin namespaces de usuario disponibles)
  try {
    const page = await browser.newPage()
    const hosts = allowedPrintHosts(baseUrl)
    const failed = new Map<string, string>() // dirección → motivo

    // Solo se descarga del almacenamiento de Pixia y de Google Fonts (ver printHosts.ts).
    await page.route('**/*', (route) => {
      const url = route.request().url()
      if (isAllowedPrintUrl(url, hosts)) return route.continue()
      failed.set(url, 'dominio no permitido')
      return route.abort('blockedbyclient')
    })
    page.on('requestfailed', (req) => {
      if (VISIBLE_RESOURCES.has(req.resourceType()) && !failed.has(req.url())) failed.set(req.url(), req.failure()?.errorText ?? 'no cargó')
    })
    page.on('response', (res) => {
      if (res.status() >= 400 && VISIBLE_RESOURCES.has(res.request().resourceType())) failed.set(res.url(), `HTTP ${res.status()}`)
    })

    await opts.prepare?.(page)

    // networkidle: espera a que las fuentes de Google Fonts y las fotos
    // (URLs de R2, absolutas — ver <base> en wrapPrintAlbumHtml/wrapPrintPageHtml)
    // terminen de cargar antes de capturar el PDF — con 36+ imágenes en un
    // solo documento esto puede tardar más que una página sola, pero
    // Playwright espera lo que haga falta (sin el límite de ~30s del
    // ctx.waitUntil de Cloudflare que forzó todo el rediseño anterior).
    await page.setContent(html, { waitUntil: 'networkidle' })

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

/** Una dirección data: puede pesar megas: en el mensaje solo va el comienzo. */
const short = (url: string) => (url.length > 120 ? `${url.slice(0, 117)}...` : url || '(sin dirección)')

export function describeFailedResources(failed: Map<string, string>): string {
  const list = [...failed].slice(0, 5).map(([url, why]) => `${short(url)} (${why})`).join('; ')
  const n = failed.size
  return `${n === 1 ? 'No cargó 1 foto o fuente' : `No cargaron ${n} fotos o fuentes`} del álbum, no se genera el PDF: ${list}${n > 5 ? `; y ${n - 5} más` : ''}`
}
