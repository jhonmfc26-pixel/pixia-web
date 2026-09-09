/**
 * Frontera entre la lógica de armado de PDF (agnóstica de infraestructura,
 * vive en core/modules/print/) y el motor real de render headless (Cloudflare
 * Browser Rendering hoy — ver workers/pdf-render/). generateAlbumPdfs.tsx
 * SOLO conoce esta interfaz, nunca @cloudflare/puppeteer directo — así el
 * core no depende de un runtime de Worker, y el día que haga falta cambiar
 * de proveedor de render headless, el cambio es UNA implementación nueva de
 * esto, no tocar la lógica de armado de páginas/cubierta.
 */
export interface HtmlToPdfRenderer {
  /**
   * Renderiza UN documento HTML standalone (ya armado por wrapPrintPageHtml,
   * con @page fijando el tamaño) a UN PDF de una sola página, exactamente a
   * widthMm×heightMm.
   */
  renderPageToPdf(html: string, widthMm: number, heightMm: number): Promise<Uint8Array>
}
