/**
 * Chequeo de DPI efectivo — "esta foto, al tamaño físico real que va a
 * ocupar impresa, ¿llega a la resolución objetivo del PrintProfile?".
 * Nunca bloquea: solo produce advertencias (ver generateAlbumPdfs.ts).
 *
 * ⚠️ HALLAZGO IMPORTANTE (no es parte del código, es contexto para el
 * equipo): el pipeline de upload actual (compressForUpload.ts/
 * compressWorker.ts) cachea TODA foto subida a un máximo de 3000px de lado
 * mayor antes de llegar a R2 — no existe hoy un "original sin comprimir"
 * distinto al que ya usa el viewer. photo.url y photo.thumbnailUrl son
 * literalmente la MISMA URL (ver useUpload.ts: `thumbnailUrl: data.url`).
 * Con ese techo de 3000px, una foto full-bleed sola en una página de 30×30cm
 * (que a 300dpi con sangrado pide 3614px, ver printProfiles.ts) da como
 * mucho ~249dpi — bajo el objetivo SIEMPRE, no en casos raros. Este chequeo
 * lo va a reportar así de honesto para cada foto en esa situación; subir el
 * techo de compressForUpload (o guardar un original aparte) es un cambio de
 * pipeline de upload que queda fuera de este brick.
 */

import { slotAreas, slotAspectRatios } from '@/core/modules/album/layoutFit'

export interface DpiWarning {
  photoId: string
  layoutId: string
  slotIndex: number
  effectiveDpi: number
  targetDpi: number
}

/**
 * Tamaño físico (mm) del slot `slotIndex` de `layoutId`, sobre una página de
 * pageWidthMm × pageHeightMm (usar el tamaño CON sangrado — los layouts son
 * full-bleed, el slot ocupa hasta el borde del sangrado, no solo el trim).
 * Deriva ancho/alto desde el área (fracción de página) + aspect ratio del
 * slot — mismos datos que ya calcula layoutFit.ts para el motor de layouts,
 * no se duplica esa geometría acá.
 */
export function getSlotSizeMm(
  layoutId: string,
  slotIndex: number,
  pageWidthMm: number,
  pageHeightMm: number,
): { widthMm: number; heightMm: number } | null {
  const areas = slotAreas(layoutId)
  const ratios = slotAspectRatios(layoutId)
  const areaFraction = areas[slotIndex]
  const ar = ratios[slotIndex]
  if (areaFraction == null || ar == null) return null

  const slotAreaMm2 = areaFraction * pageWidthMm * pageHeightMm
  const heightMm = Math.sqrt(slotAreaMm2 / ar)
  const widthMm = heightMm * ar
  return { widthMm, heightMm }
}

/**
 * DPI efectivo de una foto en un slot — el mínimo entre el eje ancho y el
 * eje alto (con object-fit:cover, el escalado es uniforme en ambos ejes; el
 * eje que "ajusta exacto" —sin sobrar— es el que manda la resolución real
 * visible tras el recorte, y tomar el mínimo de los dos es la forma
 * conservadora estándar de estimarlo sin tener que replicar el cálculo
 * exacto del crop).
 */
export function effectivePhotoDpi(
  photoWidthPx: number,
  photoHeightPx: number,
  slotWidthMm: number,
  slotHeightMm: number,
): number {
  if (slotWidthMm <= 0 || slotHeightMm <= 0) return Infinity
  const dpiByWidth = photoWidthPx / (slotWidthMm / 25.4)
  const dpiByHeight = photoHeightPx / (slotHeightMm / 25.4)
  return Math.min(dpiByWidth, dpiByHeight)
}

/**
 * Chequea una foto puesta en un slot de un layout, sobre una página de
 * tamaño físico dado. Devuelve un DpiWarning si no alcanza targetDpi, o
 * null si está OK (o si no se pudo calcular el slot — no bloquea).
 */
export function checkSlotDpi(params: {
  photoId: string
  photoWidthPx: number
  photoHeightPx: number
  layoutId: string
  slotIndex: number
  pageWidthMm: number
  pageHeightMm: number
  targetDpi: number
}): DpiWarning | null {
  const { photoId, photoWidthPx, photoHeightPx, layoutId, slotIndex, pageWidthMm, pageHeightMm, targetDpi } = params
  const size = getSlotSizeMm(layoutId, slotIndex, pageWidthMm, pageHeightMm)
  if (!size) return null

  const dpi = effectivePhotoDpi(photoWidthPx, photoHeightPx, size.widthMm, size.heightMm)
  if (dpi >= targetDpi) return null

  return {
    photoId,
    layoutId,
    slotIndex,
    effectiveDpi: Math.round(dpi),
    targetDpi,
  }
}
