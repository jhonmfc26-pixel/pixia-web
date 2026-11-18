export interface ExifData {
  takenAt: string | null
  lat?: number
  lng?: number
  width?: number
  height?: number
  orientation?: number
}

// Contador a nivel de módulo — loguea solo las primeras 3 fotos por sesión de análisis
let _exifLogCount = 0

/** Los datos EXIF van al principio del archivo: casi siempre basta con leer esto. */
const HEAD_BYTES = 512 * 1024
/** El trozo leído no alcanzó: hay que leer el archivo entero. */
const INCOMPLETE = Symbol('incompleto')

export async function readExif(file: File): Promise<ExifData> {
  const logThis = ++_exifLogCount <= 3
  // Primero solo el principio (una foto de celular pesa 3–5 MB y se leen
  // decenas seguidas); si no alcanza, el archivo entero, como antes.
  if (file.size > HEAD_BYTES) {
    const head = await readExifFrom(await file.slice(0, HEAD_BYTES).arrayBuffer().catch(() => null), file.name, logThis, true)
    if (head !== INCOMPLETE) return head
  }
  const full = await readExifFrom(await file.arrayBuffer().catch(() => null), file.name, logThis, false)
  return full === INCOMPLETE ? { takenAt: null } : full
}

async function readExifFrom(
  buffer: ArrayBuffer | null, name: string, logThis: boolean, partial: boolean,
): Promise<ExifData | typeof INCOMPLETE> {
  const empty: ExifData = { takenAt: null }
  if (!buffer) return partial ? INCOMPLETE : empty
  try {
    const view = new DataView(buffer)

    if (view.getUint16(0) !== 0xFFD8) {
      if (logThis) console.log('[EXIF] sin segmento JPEG (no 0xFFD8):', name)
      return empty
    }

    let offset = 2
    while (offset < view.byteLength - 2) {
      if (partial && offset + 4 > view.byteLength) return INCOMPLETE
      const marker = view.getUint16(offset)
      const length = view.getUint16(offset + 2)

      if (marker === 0xFFE1) {
        if (partial && offset + 2 + length > view.byteLength) return INCOMPLETE
        const exifHeader = view.getUint32(offset + 4)
        if (exifHeader === 0x45786966) {
          const result = parseExifIFD(view, offset + 10)
          if (logThis) console.log('[EXIF]', name, {
            foundAPP1: true,
            takenAt: result.takenAt ?? null,
            gps: result.lat != null ? { lat: result.lat, lng: result.lng } : null,
          })
          return result
        }
      }

      if (marker === 0xFFDA) break
      offset += 2 + length
    }
    if (partial && offset >= view.byteLength - 2) return INCOMPLETE

    if (logThis) console.log('[EXIF] sin segmento Exif (APP1 no encontrado):', name)
    return empty
  } catch {
    return partial ? INCOMPLETE : empty
  }
}

function parseExifIFD(view: DataView, tiffOffset: number): ExifData {
  const empty: ExifData = { takenAt: null }
  try {
    const byteOrder = view.getUint16(tiffOffset)
    const littleEndian = byteOrder === 0x4949

    const ifdOffset = view.getUint32(tiffOffset + 4, littleEndian)
    const ifdStart = tiffOffset + ifdOffset

    if (ifdStart >= view.byteLength) return empty

    const numEntries = view.getUint16(ifdStart, littleEndian)
    let modifyDate: string | undefined
    let gpsOffset: number | undefined
    let exifOffset: number | undefined

    for (let i = 0; i < numEntries; i++) {
      const entryOffset = ifdStart + 2 + i * 12
      if (entryOffset + 12 > view.byteLength) break

      const tag = view.getUint16(entryOffset, littleEndian)

      if (tag === 0x8825) gpsOffset = view.getUint32(entryOffset + 8, littleEndian)
      if (tag === 0x8769) exifOffset = view.getUint32(entryOffset + 8, littleEndian)
      if (tag === 0x0132) {
        const strOffset = view.getUint32(entryOffset + 8, littleEndian)
        modifyDate = parseExifDate(view, tiffOffset + strOffset)
      }
    }

    // Priority: DateTimeOriginal (0x9003) > CreateDate (0x9004) > ModifyDate (0x0132)
    let takenAt: string | null = modifyDate ?? null
    if (exifOffset) {
      const subIFD = tiffOffset + exifOffset
      if (subIFD < view.byteLength) {
        const subEntries = view.getUint16(subIFD, littleEndian)
        let dateTimeOriginal: string | undefined
        let createDate: string | undefined

        for (let i = 0; i < subEntries; i++) {
          const entryOffset = subIFD + 2 + i * 12
          if (entryOffset + 12 > view.byteLength) break
          const tag = view.getUint16(entryOffset, littleEndian)

          if (tag === 0x9003) {
            const strOffset = view.getUint32(entryOffset + 8, littleEndian)
            dateTimeOriginal = parseExifDate(view, tiffOffset + strOffset)
          }
          if (tag === 0x9004) {
            const strOffset = view.getUint32(entryOffset + 8, littleEndian)
            createDate = parseExifDate(view, tiffOffset + strOffset)
          }
        }

        if (dateTimeOriginal) takenAt = dateTimeOriginal
        else if (createDate) takenAt = createDate
      }
    }

    let lat: number | undefined
    let lng: number | undefined
    if (gpsOffset) {
      const gps = parseGPS(view, tiffOffset + gpsOffset, littleEndian, tiffOffset)
      if (gps) { lat = gps.lat; lng = gps.lng }
    }

    return { takenAt, lat, lng }
  } catch {
    return empty
  }
}

function parseExifDate(view: DataView, offset: number): string | undefined {
  try {
    let str = ''
    for (let i = 0; i < 19; i++) {
      const char = view.getUint8(offset + i)
      if (char === 0) break
      str += String.fromCharCode(char)
    }
    // EXIF usa "YYYY:MM:DD HH:MM:SS" — normalizar a ISO antes de construir el Date
    const normalized = str
      .replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')
      .replace(' ', 'T')
    const date = new Date(normalized)
    if (isNaN(date.getTime())) return undefined
    return date.toISOString()
  } catch {
    return undefined
  }
}

function parseGPS(
  view: DataView, offset: number, littleEndian: boolean, tiffOffset: number
): { lat: number; lng: number } | undefined {
  try {
    if (offset >= view.byteLength) return undefined
    const numEntries = view.getUint16(offset, littleEndian)
    let latRef = 'N', lngRef = 'E'
    let lat: number | undefined, lng: number | undefined

    for (let i = 0; i < numEntries; i++) {
      const e = offset + 2 + i * 12
      if (e + 12 > view.byteLength) break
      const tag = view.getUint16(e, littleEndian)

      if (tag === 0x0001) latRef = String.fromCharCode(view.getUint8(e + 8))
      if (tag === 0x0003) lngRef = String.fromCharCode(view.getUint8(e + 8))
      if (tag === 0x0002) lat = readGPSCoord(view, e, littleEndian, tiffOffset)
      if (tag === 0x0004) lng = readGPSCoord(view, e, littleEndian, tiffOffset)
    }

    if (lat === undefined || lng === undefined) return undefined
    return {
      lat: latRef === 'S' ? -lat : lat,
      lng: lngRef === 'W' ? -lng : lng,
    }
  } catch {
    return undefined
  }
}

function readGPSCoord(view: DataView, entry: number, littleEndian: boolean, tiffOffset: number): number {
  // valOffset es relativo al TIFF header — sumar tiffOffset para obtener posición absoluta
  const valOffset = tiffOffset + view.getUint32(entry + 8, littleEndian)
  const d = view.getUint32(valOffset, littleEndian) / view.getUint32(valOffset + 4, littleEndian)
  const m = view.getUint32(valOffset + 8, littleEndian) / view.getUint32(valOffset + 12, littleEndian)
  const s = view.getUint32(valOffset + 16, littleEndian) / view.getUint32(valOffset + 20, littleEndian)
  return d + m / 60 + s / 3600
}
