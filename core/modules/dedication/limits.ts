/**
 * Límites de caracteres por zona de la dedicatoria — solo para el EDITOR
 * (maxLength de los campos + contador). El modelo (DedicationContent) y el
 * render (DedicationCard) no imponen ni asumen ningún límite; viven acá
 * para poder recalibrarlos sin tocar ninguno de los dos.
 *
 * BODY_MAX subido de 200 a 300. La ronda anterior bajó el cuerpo a 200
 * porque el TAMAÑO DE FUENTE era demasiado grande (calculaba ~32pt
 * impreso — la carta ocupa una página física de 30×30cm, así que cada cqw
 * de fuente se traduce directo a milímetros reales). Con el tamaño de
 * fuente ya corregido a escala de impresión (~13pt cuerpo, ~33pt
 * encabezado — ver comentario en DedicationCard.tsx), el mismo texto ocupa
 * mucho menos alto en pantalla, así que hay espacio de sobra para volver a
 * subir el tope. Recalibrado con el mismo modelo de wrap que la vez
 * anterior contra los tamaños de fuente nuevos: con encabezado/firma en
 * longitudes típicas de plantilla, BODY_MAX=300 deja ≥65px de margen en
 * los anchos reales del editor (~380-680px) — y a diferencia de la ronda
 * anterior, incluso el caso extremo (encabezado Y firma ambos en su tope
 * de 40) ahora cabe con margen (≥48px), porque el encabezado más chico ya
 * no empuja a 3 líneas.
 *
 *   HEADING_MAX: una línea larga tipo "Para ti, mamá" (con texto muy largo,
 *     hasta 2 líneas — ya no 3, gracias al tamaño de fuente corregido)
 *   BODY_MAX: ~6-7 líneas cómodas con line-height 1.75, al tamaño de
 *     impresión correcto
 *   SIGNATURE_MAX: una línea corta tipo "Con cariño, Jhon"
 */
export const HEADING_MAX = 40
export const BODY_MAX = 300
export const SIGNATURE_MAX = 40
