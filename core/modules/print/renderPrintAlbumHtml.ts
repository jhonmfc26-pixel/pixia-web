import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactElement } from 'react'
import { GOOGLE_FONTS_IMPORT } from './renderPrintHtml'

/**
 * Arma el interior COMPLETO del álbum como UN documento HTML, con todas las
 * páginas separadas por salto de página CSS — pensado para un motor que
 * genera el PDF en UNA sola pasada (Playwright en un contenedor con RAM
 * real), no página por página + merge (eso es lo que revienta la memoria de
 * un Worker de Cloudflare, ver el historial largo en
 * workers/pdf-render/src/index.ts).
 *
 * No reemplaza wrapPrintPageHtml (se conserva tal cual, la sigue usando el
 * Worker CF) — es la variante "N páginas en un documento" en vez de "1
 * página, N documentos".
 *
 * `break-after: page` (con el alias `page-break-after: always` para
 * Chromium más viejo, aunque el runtime moderno de Playwright ya soporta el
 * nombre actual) en cada página — la ÚLTIMA no lleva salto (evita una hoja
 * en blanco de más al final). @page se declara UNA sola vez (todas las
 * páginas del interior comparten el mismo tamaño físico) — a diferencia de
 * wrapPrintPageHtml, que lo repite por documento porque cada página ahí ES
 * su propio documento.
 */
export function wrapPrintAlbumHtml(
  pages: { element: ReactElement; needsFonts: boolean }[],
  params: {
    widthMm: number
    heightMm: number
    /** Origen real de la app — ver wrapPrintPageHtml, mismo motivo (assets con ruta relativa). */
    baseUrl: string
  },
): string {
  const { widthMm, heightMm, baseUrl } = params
  const needsFonts = pages.some((p) => p.needsFonts)

  const pagesHtml = pages
    .map((p, i) => {
      const isLast = i === pages.length - 1
      const breakStyle = isLast ? '' : 'break-after: page; page-break-after: always;'
      return `<div style="width:${widthMm}mm;height:${heightMm}mm;overflow:hidden;${breakStyle}">${renderToStaticMarkup(p.element)}</div>`
    })
    .join('')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<base href="${baseUrl}" />
<style>
${needsFonts ? GOOGLE_FONTS_IMPORT : ''}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${widthMm}mm; }
@page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
</style>
</head>
<body>${pagesHtml}</body>
</html>`
}
