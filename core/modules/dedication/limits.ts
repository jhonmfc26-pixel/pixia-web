/**
 * Límites de caracteres por zona de la dedicatoria — solo para el EDITOR
 * (maxLength de los campos + contador). El modelo (DedicationContent) y el
 * render (DedicationCard) no imponen ni asumen ningún límite; viven acá
 * para poder recalibrarlos sin tocar ninguno de los dos.
 *
 * Calibrados para que el render (12-13% de padding, carta ~1:1) nunca se
 * vea apretujado:
 *   HEADING_MAX: una línea larga tipo "Para ti, mamá"
 *   BODY_MAX: 4-5 líneas cómodas con line-height 1.75
 *   SIGNATURE_MAX: una línea corta tipo "Con cariño, Jhon"
 */
export const HEADING_MAX = 40
export const BODY_MAX = 350
export const SIGNATURE_MAX = 40
