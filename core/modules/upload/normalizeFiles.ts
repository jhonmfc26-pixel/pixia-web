export interface NormalizedFile {
  file: File
  /** EXIF del HEIC original antes de conversión. Null para no-HEIC o si falla la extracción. */
  heicExif: { takenAt: string | null; lat?: number; lng?: number } | null
}

export interface NormalizeResult {
  files: NormalizedFile[]
  /** Nombres de archivos HEIC cuya conversión falló — excluidos del pipeline. */
  failed: string[]
}

export function isHeicFile(file: File): boolean {
  const lower = file.name.toLowerCase()
  return (
    lower.endsWith('.heic') || lower.endsWith('.heif') ||
    file.type === 'image/heic' || file.type === 'image/heif'
  )
}

async function extractHeicExif(
  file: File
): Promise<{ takenAt: string | null; lat?: number; lng?: number } | null> {
  try {
    const { parse } = await import('exifr')
    const parsed = await parse(file, {
      tiff: false, xmp: false, icc: false, iptc: false,
      exif: true, gps: true,
      pick: ['DateTimeOriginal', 'CreateDate', 'GPSLatitude', 'GPSLatitudeRef', 'GPSLongitude', 'GPSLongitudeRef'],
    })
    if (!parsed) return null

    const rawDate = parsed.DateTimeOriginal ?? parsed.CreateDate
    const takenAt = rawDate instanceof Date ? rawDate.toISOString() : null

    let lat: number | undefined
    let lng: number | undefined
    if (parsed.GPSLatitude != null && parsed.GPSLongitude != null) {
      lat = parsed.GPSLatitudeRef === 'S' ? -parsed.GPSLatitude : parsed.GPSLatitude
      lng = parsed.GPSLongitudeRef === 'W' ? -parsed.GPSLongitude : parsed.GPSLongitude
    }

    return { takenAt, lat, lng }
  } catch {
    return null
  }
}

async function convertHeicToJpeg(file: File): Promise<File> {
  const heic2any = (await import('heic2any')).default
  const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })
  const blob = Array.isArray(result) ? result[0] : result
  const name = file.name.replace(/\.(heic|heif)$/i, '.jpg')
  // Preservar lastModified del original para que el cache key sea estable entre sesiones
  return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified })
}

const HEIC_CHUNK_SIZE = 4

/**
 * Normaliza archivos de entrada: convierte HEIC→JPEG en chunks de 4 para no
 * saturar el decoder WASM con 45 conversiones simultáneas. Archivos no-HEIC
 * pasan sin tocar. HEIC que fallan la conversión se excluyen del pipeline y
 * se devuelven en `failed` para mostrar un mensaje al usuario.
 *
 * @param onProgress - llamado después de cada chunk con (done, total) donde
 *   `done` es cuántos archivos HEIC se procesaron (ok o fallo) hasta ahora.
 */
export async function normalizeFiles(
  files: File[],
  onProgress?: (done: number, total: number) => void
): Promise<NormalizeResult> {
  const results: NormalizedFile[] = []
  const failed: string[] = []

  const heicTotal = files.filter(isHeicFile).length
  let heicDone = 0

  for (let i = 0; i < files.length; i += HEIC_CHUNK_SIZE) {
    const chunk = files.slice(i, i + HEIC_CHUNK_SIZE)

    const chunkResults = await Promise.all(
      chunk.map(async (file): Promise<NormalizedFile | null> => {
        if (!isHeicFile(file)) return { file, heicExif: null }

        try {
          // Leer EXIF y convertir en paralelo — ambas ops leen el mismo File (idempotente)
          const [heicExif, converted] = await Promise.all([
            extractHeicExif(file),
            convertHeicToJpeg(file),
          ])
          console.log('[normalizeFiles] HEIC→JPEG:', file.name, '→', converted.name, 'takenAt:', heicExif?.takenAt ?? null)
          return { file: converted, heicExif }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          // heic2any lanza este error cuando el archivo ya es legible por el browser
          // (ej. un JPEG renombrado a .heic). Pasarlo tal cual sin marcarlo como fallido.
          if (msg.includes('ERR_USER') && msg.includes('browser readable')) {
            console.log('[normalizeFiles] Archivo ya es browser-readable, pasando original:', file.name)
            return { file, heicExif: null }
          }
          console.warn('[normalizeFiles] Falló conversión HEIC:', file.name, err)
          failed.push(file.name)
          return null // excluir del pipeline — no dejar llegar a compressFile
        }
      })
    )

    const heicInChunk = chunk.filter(isHeicFile).length
    heicDone += heicInChunk
    onProgress?.(heicDone, heicTotal)

    for (const r of chunkResults) {
      if (r !== null) results.push(r)
    }
  }

  return { files: results, failed }
}
