// BrowserWorker es el tipo oficial que exporta @cloudflare/puppeteer para el
// binding [browser] de wrangler.toml (v1.x) — no el Fetcher genérico de
// @cloudflare/workers-types, aunque sean estructuralmente compatibles.
import puppeteer, { type Browser, type BrowserWorker } from '@cloudflare/puppeteer'
import type { HtmlToPdfRenderer } from '../../../core/modules/print/htmlToPdfRenderer'

/**
 * Implementación de HtmlToPdfRenderer sobre Cloudflare Browser Rendering.
 *
 * Un solo Browser por instancia de renderer (lazy, se lanza en la primera
 * llamada) reusado entre renderPageToPdf sucesivas — cada página abre/cierra
 * su propio Page (tab), barato; lo caro es puppeteer.launch() en sí, eso NO
 * se repite por página. Quien orquesta (el fetch handler de index.ts) debe
 * llamar close() al terminar el lote de páginas de ese request.
 */
export function createCloudflareRenderer(browserBinding: BrowserWorker): HtmlToPdfRenderer & { close(): Promise<void> } {
  let browserPromise: Promise<Browser> | null = null
  const getBrowser = () => {
    if (!browserPromise) browserPromise = puppeteer.launch(browserBinding)
    return browserPromise
  }

  return {
    async renderPageToPdf(html: string, widthMm: number, heightMm: number): Promise<Uint8Array> {
      const browser = await getBrowser()
      const page = await browser.newPage()
      try {
        // networkidle0: espera a que las fuentes de Google Fonts y las fotos
        // (URLs públicas de R2, absolutas — ver <base> en wrapPrintPageHtml)
        // terminen de cargar antes de capturar el PDF. Sin esto, page.pdf()
        // puede disparar antes de que las imágenes hayan pintado.
        await page.setContent(html, { waitUntil: 'networkidle0' })
        const pdf = await page.pdf({
          width: `${widthMm}mm`,
          height: `${heightMm}mm`,
          printBackground: true,
          margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
        })
        return pdf
      } finally {
        await page.close()
      }
    },
    async close() {
      if (!browserPromise) return
      const browser = await browserPromise
      await browser.close()
    },
  }
}

/**
 * Variante para lotes: UNA página (tab) del browser se reusa para renderizar
 * varias hojas en secuencia (setContent + pdf por cada una), en vez de abrir
 * y cerrar una página nueva por hoja — eso era una de las causas del OOM
 * (ver diagnóstico en index.ts). Quien la usa debe llamar close() al
 * terminar el LOTE (no hace falta un browser nuevo por lote, ver getBrowser
 * arriba — pero acá cada instancia de este objeto vive dentro de UNA sola
 * invocación del Worker, así que en la práctica sí lanza un browser por
 * invocación/lote — reconectar sesiones entre invocaciones queda fuera de
 * este ajuste, ver nota en el README).
 */
export function createCloudflarePageRenderer(browserBinding: BrowserWorker): HtmlToPdfRenderer & { close(): Promise<void> } {
  let browserPromise: Promise<Browser> | null = null
  let pagePromise: Promise<import('@cloudflare/puppeteer').Page> | null = null

  const getPage = async () => {
    if (!browserPromise) browserPromise = puppeteer.launch(browserBinding)
    if (!pagePromise) pagePromise = browserPromise.then((b) => b.newPage())
    return pagePromise
  }

  return {
    async renderPageToPdf(html: string, widthMm: number, heightMm: number): Promise<Uint8Array> {
      const page = await getPage()
      await page.setContent(html, { waitUntil: 'networkidle0' })
      return page.pdf({
        width: `${widthMm}mm`,
        height: `${heightMm}mm`,
        printBackground: true,
        margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
      })
    },
    async close() {
      if (pagePromise) await (await pagePromise).close().catch(() => {})
      if (browserPromise) await (await browserPromise).close().catch(() => {})
    },
  }
}
