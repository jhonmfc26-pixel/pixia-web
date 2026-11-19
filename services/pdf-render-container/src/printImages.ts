/**
 * Fotos del tamaño que de verdad ocupan en la página impresa.
 *
 * Un iPhone reciente saca fotos de 24 MP (5712 × 4284). Una página completa
 * de 30 × 30 a 300 ppp necesita ~3600 px y una foto de un cuarto de página,
 * ~1800. Chromium mete en el PDF cada JPEG tal como lo recibe, así que con
 * las originales un álbum de 40 fotos pesaba 234 MB y uno de 70, 409 MB, y
 * Chromium pasaba de 2 GB de memoria: el contenedor se quedaba sin memoria y
 * el PDF fallaba («Page.printToPDF: Printing failed»).
 *
 * Acá se mide cuánto ocupa cada foto en el documento y se le entrega a
 * Chromium una copia reducida a esa medida a 300 ppp (nunca agrandada). Lo
 * que se imprime no cambia: la imprenta no puede usar más resolución que esa.
 */
import sharp from 'sharp'

/** Resolución de impresión. */
export const PRINT_DPI = 300
/** 1 px CSS = 1/96 de pulgada (el documento está en mm). */
const CSS_PX_PER_INCH = 96
/** Solo se reduce si la foto pasa en más de un 15 % de lo que hace falta. */
const MIN_SAVING = 0.85
/** JPEG de alta calidad, sin submuestreo de color: es para imprenta. */
const JPEG = { quality: 92, chromaSubsampling: '4:4:4' } as const

export interface ImageInfo {
  /** Medidas ya orientadas (como las ve Chromium). */
  width: number
  height: number
  format: string
}

export async function imageInfo(bytes: Buffer): Promise<ImageInfo | null> {
  try {
    const m = await sharp(bytes).metadata()
    if (!m.width || !m.height || !m.format) return null
    const swap = (m.orientation ?? 1) >= 5
    return { width: swap ? m.height : m.width, height: swap ? m.width : m.height, format: m.format }
  } catch {
    return null
  }
}

/**
 * Escala que necesita una foto de `natural` px para cubrir una caja de
 * `boxCssPx` px CSS a PRINT_DPI. Con `object-fit: cover` (o una foto
 * agrandada a mano) la foto se escala por el lado que más exige: por eso el
 * máximo de los dos.
 */
export function requiredScale(box: { width: number; height: number }, natural: { width: number; height: number }): number {
  if (!natural.width || !natural.height) return 1
  const needW = (box.width / CSS_PX_PER_INCH) * PRINT_DPI
  const needH = (box.height / CSS_PX_PER_INCH) * PRINT_DPI
  return Math.max(needW / natural.width, needH / natural.height)
}

/** Imagen SVG vacía con las medidas de la foto: para medir el documento sin descargar ni decodificar fotos enteras. */
export function placeholderSvg(info: ImageInfo): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${info.width}" height="${info.height}"/>`
}

/**
 * Copia reducida para imprimir, o null si conviene usar la original (no es
 * JPEG, ya es del tamaño justo, o falló la reducción).
 */
export async function downscaleForPrint(bytes: Buffer, info: ImageInfo, scale: number): Promise<Buffer | null> {
  if (info.format !== 'jpeg' || !(scale > 0) || scale >= MIN_SAVING) return null
  const width = Math.max(1, Math.round(info.width * scale))
  const height = Math.max(1, Math.round(info.height * scale))
  try {
    return await sharp(bytes, { failOn: 'none' })
      .rotate() // aplica la orientación EXIF a los píxeles, como la ve Chromium
      .resize(width, height, { fit: 'fill', kernel: 'lanczos3' })
      .keepIccProfile() // mismo perfil de color (Display P3 en iPhone): mismos colores
      .jpeg(JPEG)
      .toBuffer()
  } catch {
    return null
  }
}

/** Como mucho `n` tareas a la vez (decodificar una foto de 24 MP ocupa ~100 MB). */
export function limiter(n: number) {
  let active = 0
  const waiting: Array<() => void> = []
  return async function run<T>(job: () => Promise<T>): Promise<T> {
    if (active >= n) await new Promise<void>((r) => waiting.push(r))
    active++
    try { return await job() } finally { active--; waiting.shift()?.() }
  }
}
