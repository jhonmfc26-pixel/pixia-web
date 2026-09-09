import { chromium } from 'playwright'
import { buildInteriorPageElements, buildCoverPage } from '@/core/modules/print/generateAlbumPdfs'
import { wrapPrintAlbumHtml } from '@/core/modules/print/renderPrintAlbumHtml'
import { wrapPrintPageHtml } from '@/core/modules/print/renderPrintHtml'
import { getBookPrintProfile } from '@/core/modules/print/printProfiles'
import type { AlbumStructure } from '@/core/modules/foldModel/types'
import type { CoverConfig, PhotoAsset } from '@/core/contracts/AlbumBlueprint'
import type { DpiWarning } from '@/core/modules/print/dpiCheck'

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

  const pdf = await renderHtmlToPdf(html, widthMm, heightMm)
  return { pdf, warnings }
}

/** Cubierta — 1 sola página física, sigue siendo un solo render.pdf() como antes (nunca tuvo el problema de OOM). */
export async function renderCoverPdf(cover: CoverConfig, coverPhoto: PhotoAsset | undefined, structure: AlbumStructure, format: string, baseUrl: string): Promise<RenderResult> {
  const profile = getBookPrintProfile(format)
  const page = buildCoverPage(cover, coverPhoto, structure, { profile, baseUrl })
  const pdf = await renderHtmlToPdf(page.html, page.widthMm, page.heightMm)
  return { pdf, warnings: [] }
}

async function renderHtmlToPdf(html: string, widthMm: number, heightMm: number): Promise<Uint8Array> {
  const browser = await chromium.launch({ args: ['--no-sandbox'] }) // --no-sandbox: estándar dentro de un contenedor Docker (sin namespaces de usuario disponibles)
  try {
    const page = await browser.newPage()
    // networkidle: espera a que las fuentes de Google Fonts y las fotos
    // (URLs de R2, absolutas — ver <base> en wrapPrintAlbumHtml/wrapPrintPageHtml)
    // terminen de cargar antes de capturar el PDF — con 36+ imágenes en un
    // solo documento esto puede tardar más que una página sola, pero
    // Playwright espera lo que haga falta (sin el límite de ~30s del
    // ctx.waitUntil de Cloudflare que forzó todo el rediseño anterior).
    await page.setContent(html, { waitUntil: 'networkidle' })
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
