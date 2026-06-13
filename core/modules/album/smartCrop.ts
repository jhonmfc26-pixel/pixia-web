// Recorte consciente de caras — función pura, sin dependencias de DOM.
//
// Tests mentales:
//   portrait cara arriba (y0=0.1, y1=0.3) en slot landscape → posY ≈ 14% < 50 ✓
//   landscape cara derecha (x0=0.7, x1=0.9) en slot portrait → posX ≈ 86% > 50 ✓

export interface Rect { x: number; y: number; w: number; h: number }

// Margen alrededor del bounding box de caras (fracción del tamaño del bbox).
const FACE_MARGIN = 0.15

/**
 * Calcula el CSS object-position (en %) para encuadrar las regiones de interés.
 *
 * @param photoAspect   w/h de la foto (dimensiones reales o normalizadas)
 * @param slotAspect    w/h del slot donde se renderiza
 * @param regions       rectángulos normalizados 0-1 de las caras detectadas
 * @param photoId       solo para el log de advertencia
 */
export function computeObjectPosition(
  photoAspect: number,
  slotAspect: number,
  regions: Rect[],
  photoId?: string,
): { x: number; y: number } {
  if (!regions.length || !photoAspect || !slotAspect) return { x: 50, y: 50 }

  // Bounding box que une todas las caras
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const r of regions) {
    x0 = Math.min(x0, r.x)
    y0 = Math.min(y0, r.y)
    x1 = Math.max(x1, r.x + r.w)
    y1 = Math.max(y1, r.y + r.h)
  }

  // Margen proporcional al tamaño del bbox (las cabezas necesitan aire arriba)
  const mx = FACE_MARGIN * (x1 - x0)
  const my = FACE_MARGIN * (y1 - y0)
  x0 = Math.max(0, x0 - mx)
  y0 = Math.max(0, y0 - my)
  x1 = Math.min(1, x1 + mx)
  y1 = Math.min(1, y1 + my)

  const result = { x: 50, y: 50 }

  if (photoAspect > slotAspect) {
    // El ancho se recorta; el alto está completamente visible → ajustar X
    result.x = shiftAxis(x0, x1, slotAspect / photoAspect, photoId)
  } else if (photoAspect < slotAspect) {
    // El alto se recorta; el ancho está completamente visible → ajustar Y
    result.y = shiftAxis(y0, y1, photoAspect / slotAspect, photoId)
  }

  return result
}

/**
 * Desplaza mínimamente la ventana visible para contener [bbStart, bbEnd].
 * `winSize` = fracción de la foto visible en ese eje (< 1 cuando hay recorte).
 * Devuelve el porcentaje CSS (0-100).
 */
function shiftAxis(
  bbStart: number,
  bbEnd: number,
  winSize: number,
  photoId?: string,
): number {
  const travel = 1 - winSize  // cuánto puede moverse la ventana
  if (travel <= 0) return 50  // sin recorte

  const bbSize = bbEnd - bbStart

  if (bbSize >= winSize) {
    // Las caras no caben completas → centrar en el bbox y advertir
    if (photoId) console.warn('[SmartCrop] caras no caben completas en slot', photoId)
    const center = (bbStart + bbEnd) / 2
    const winStart = Math.max(0, Math.min(travel, center - winSize / 2))
    return (winStart / travel) * 100
  }

  // Desplazar lo mínimo necesario desde el centro para contener el bbox
  const centerWin = travel / 2  // winStart cuando posX=50%

  if (centerWin > bbStart) {
    // El centro deja la cara cortada por la izquierda/arriba → ir hacia el borde
    return Math.max(0, (bbStart / travel) * 100)
  }
  if (centerWin + winSize < bbEnd) {
    // El centro deja la cara cortada por la derecha/abajo → ir hacia el otro borde
    return Math.min(100, ((bbEnd - winSize) / travel) * 100)
  }

  return 50  // el bbox ya cabe en la ventana centrada
}
