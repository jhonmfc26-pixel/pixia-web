import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactElement } from 'react'

// Misma línea de @import que app/globals.css. Este documento se renderiza
// standalone en Puppeteer (page.setContent), no hereda el <head> de la app
// real — hay que repetir las fuentes acá. Si se agrega una tipografía nueva
// a globals.css (ej. para un template de portada nuevo), hay que espejarla
// acá también — no hay forma limpia de compartir un <style> de Next con un
// documento que Next nunca sirve.
export const GOOGLE_FONTS_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@300;400;500;600&family=Parisienne&family=Pinyon+Script&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap');"

/**
 * Envuelve el markup SSR de una página física (o de la cubierta) en un
 * documento HTML standalone listo para Puppeteer:
 *  - @page fija el tamaño físico EXACTO en mm — es lo que Chromium usa como
 *    tamaño de página real al generar el PDF (page.pdf() respeta @page
 *    cuando no se le pasan width/height propios).
 *  - <base href> resuelve los assets con ruta relativa de la app (ej.
 *    /logo-pixia.png en BackCoverPage/PrintCoverWrap) contra el dominio
 *    real — este documento nunca se sirve DESDE la app, Puppeteer lo recibe
 *    como HTML crudo vía page.setContent(), así que sin <base> esas rutas
 *    relativas no resuelven contra nada.
 */
export function wrapPrintPageHtml(element: ReactElement, params: {
  widthMm: number
  heightMm: number
  /** Origen real de la app (ej. https://pixia.app) — de acá cuelgan los assets con ruta relativa. */
  baseUrl: string
  /**
   * Solo true en páginas con texto real (dedicatoria, cubierta) — la
   * mayoría son grillas de fotos sin una sola letra. Chromium igual
   * descarga/subsetea/embebe TODAS las familias del @import aunque la
   * página no use ninguna, engordando cada PDF de página con fuentes que
   * nunca se ven — confirmado como una causa adicional (no la principal,
   * ver object-fit:cover) del bloat al mergear álbumes grandes. Default
   * false a propósito: la mayoría de las páginas no necesita fuentes.
   */
  needsFonts?: boolean
}): string {
  const { widthMm, heightMm, baseUrl, needsFonts = false } = params
  const bodyHtml = renderToStaticMarkup(element)

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<base href="${baseUrl}" />
<style>
${needsFonts ? GOOGLE_FONTS_IMPORT : ''}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${widthMm}mm; height: ${heightMm}mm; overflow: hidden; }
@page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
</style>
</head>
<body>${bodyHtml}</body>
</html>`
}
