/**
 * Config del LOMO (spine) de la cubierta extendida — [CONTRAPORTADA | LOMO |
 * PORTADA] como una sola pieza, igual que el case-wrap de un libro de pasta
 * dura. Ver PrintCoverWrap.tsx para el render.
 */

/**
 * ⚠️ PLACEHOLDER PROVISIONAL — Range todavía no confirma el grosor real de
 * papel por página impresa. 0.1mm/página dejaba lomos casi invisibles (36
 * páginas → 3.6mm, por debajo de SPINE_MIN_WIDTH_FOR_TITLE_MM: ni el título
 * entraba). Subido a 0.4mm/página como estimación más realista mientras se
 * confirma el dato — 36 páginas → ~14mm, ancho suficiente para logo + título.
 * AJUSTAR este número en cuanto Range dé el dato real — es la ÚNICA
 * constante que hay que tocar, calculateSpineWidthMm no cambia.
 */
export const SPINE_MM_PER_PAGE = 0.4

/**
 * Ancho de lomo mínimo bajo el cual el título ya no entra legible — por
 * debajo de esto, PrintCoverWrap degrada a solo el logo (ver
 * shouldShowSpineTitle). Threshold a ojo, conservador: un lomo de <8mm no
 * tiene margen real para texto vertical + padding sin verse apretado.
 */
export const SPINE_MIN_WIDTH_FOR_TITLE_MM = 8

/**
 * Ancho de lomo mínimo bajo el cual ni el logo entra con aire — por debajo
 * de esto, PrintCoverWrap no dibuja nada en el lomo (queda como color
 * plano). Un pliego mínimo (1 pliego = 2 páginas) da spine ≈ 0.2mm — no
 * cabe nada ahí, es literalmente un pliegue.
 */
export const SPINE_MIN_WIDTH_FOR_LOGO_MM = 3

/**
 * spineWidthMm = pageCount * SPINE_MM_PER_PAGE. pageCount es el conteo de
 * páginas INTERIORES real (ver countRealPages en foldModel/validate.ts —
 * folds.length * 2), no book.pageCount (que puede estar desactualizado).
 */
export function calculateSpineWidthMm(pageCount: number): number {
  return Math.max(0, pageCount) * SPINE_MM_PER_PAGE
}
