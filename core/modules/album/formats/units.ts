/**
 * Conversiones entre unidades físicas y puntos PDF.
 * 1 pulgada = 2.54 cm = 72 puntos PDF.
 */

const CM_PER_INCH = 2.54
const PT_PER_INCH = 72

export function cmToPt(cm: number): number {
  return (cm / CM_PER_INCH) * PT_PER_INCH
}

export function mmToPt(mm: number): number {
  return cmToPt(mm / 10)
}

/**
 * Factor de conversión de puntos PDF a píxeles del canvas, al DPI dado.
 * Usado para dimensionar canvas que se exportarán como imagen en el PDF.
 */
export function ptToPxFactor(dpi: number): number {
  return dpi / PT_PER_INCH
}
