import type { CSSProperties } from 'react'

/**
 * Reemplazo de `object-fit: cover` (+ `object-position`) que preserva el
 * JPEG original al exportar a PDF. Hallazgo confirmado con pruebas
 * controladas (ticket "bloat del PDF"): Chromium/Skia rasteriza y re-embebe
 * sin comprimir cualquier <img> con object-fit:cover (o background-size:
 * cover) al generar un PDF — una foto de ~1.4MB terminaba pesando ~9.7MB
 * (~7x) en el PDF de una sola página; clip-path tampoco lo evita. Lograr el
 * MISMO recorte con position:absolute + width/height + transform en cambio
 * exporta preservando el JPEG intacto.
 *
 * Solo necesita las PROPORCIONES (no depende de que la imagen haya cargado
 * en el DOM ni del tamaño en px del contenedor) — por eso funciona igual en
 * el viewer (responsive, en un browser real) y en el render server-side del
 * PDF (renderToStaticMarkup, sin DOM) sin ninguna lógica de carga aparte.
 * PhotoAsset ya trae width/height, y la proporción del contenedor se conoce
 * de antemano por la geometría del layout (ver layoutFit.ts) o el formato
 * del álbum — nunca hace falta medir nada en tiempo de render.
 *
 * El contenedor que lo use sigue necesitando position:relative +
 * overflow:hidden para recortar lo que desborda — eso no cambia, object-fit:
 * cover también lo necesitaba.
 */
export function manualCoverStyle(
  contentAspect: number,
  containerAspect: number,
  objectPosition: string = 'center center',
): CSSProperties {
  // Sin proporción conocida (foto sin width/height, dato corrupto/legacy) —
  // cae de vuelta a object-fit:cover normal. Peor en tamaño de PDF, pero
  // nunca en visual: mejor un caso raro pesado que uno mal recortado.
  if (!Number.isFinite(contentAspect) || !Number.isFinite(containerAspect) || contentAspect <= 0 || containerAspect <= 0) {
    // top/left/width/height explícitos, NUNCA el shorthand inset:0 — bug
    // confirmado en vivo (ticket "layouts rotos" en el contenedor Playwright):
    // dentro de un slot de CSS Grid dimensionado por fracciones (fr), inset:0
    // en un <img> sin width/height propios NO estira de forma confiable en
    // los dos ejes — el eje horizontal (left/right) sí resuelve contra el
    // slot, pero el vertical (top/bottom) cae al aspect-ratio de la propia
    // foto. En el viewer (slots en px) esto se notaba poco: un borde del
    // color de fondo del slot sin cubrir. En el contenedor de impresión
    // (documento @page en mm, muchas páginas apiladas) el mismo bug se
    // agrava y termina usando el tamaño NATURAL completo de la foto — de ahí
    // el zoom enorme mostrando solo un fragmento minúsculo. width/height:100%
    // explícitos resuelven bien en ambos casos (confirmado con reproducción
    // mínima) y siguen apilando bien detrás de overlays absolutos
    // (CoverRenderer, etc.) — mismo comportamiento visual que inset:0 tenía
    // la intención de dar, ahora sin el bug.
    return { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition, display: 'block' }
  }

  const [xRaw, yRaw] = objectPosition.trim().split(/\s+/)
  const toPercent = (v: string | undefined): number | null => {
    if (v === undefined) return null
    if (v === 'center') return 50
    if (v === 'left' || v === 'top') return 0
    if (v === 'right' || v === 'bottom') return 100
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : null
  }
  const x = toPercent(xRaw) ?? 50
  const y = toPercent(yRaw) ?? 50

  // Foto proporcionalmente más ancha que el contenedor → llenar por ALTO,
  // el ancho desborda a los costados (se recorta con overflow:hidden).
  // Si no, llenar por ANCHO, el alto desborda arriba/abajo.
  const constrainByHeight = contentAspect > containerAspect

  return {
    position: 'absolute',
    top: `${y}%`,
    left: `${x}%`,
    transform: `translate(-${x}%, -${y}%)`,
    display: 'block',
    ...(constrainByHeight
      ? { height: '100%', width: 'auto', maxWidth: 'none' }
      : { width: '100%', height: 'auto', maxHeight: 'none' }),
  }
}

/** contentAspect a partir de width/height — undefined si faltan o son inválidos (ver fallback arriba). */
export function aspectOf(width: number | undefined | null, height: number | undefined | null): number {
  if (!width || !height) return NaN
  return width / height
}
