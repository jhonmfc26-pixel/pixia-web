export interface ExifData {
  takenAt?: Date
  gps?: { lat: number; lng: number }
  width?: number
  height?: number
  orientation?: number
}

export async function readExif(file: File): Promise<ExifData> {
  try {
    const buffer = await file.arrayBuffer()
    const view = new DataView(buffer)

    if (view.getUint16(0) !== 0xFFD8) return {}

    let offset = 2
    while (offset < view.byteLength - 2) {
      const marker = view.getUint16(offset)
      const length = view.getUint16(offset + 2)

      if (marker === 0xFFE1) {
        const exifHeader = view.getUint32(offset + 4)
        if (exifHeader === 0x45786966) {
          return parseExifIFD(view, offset + 10)
        }
      }

      if (marker === 0xFFDA) break
      offset += 2 + length
    }

    return {}
  } catch {
    return {}
  }
}

function parseExifIFD(view: DataView, tiffOffset: number): ExifData {
  try {
    const byteOrder = view.getUint16(tiffOffset)
    const littleEndian = byteOrder === 0x4949

    const ifdOffset = view.getUint32(tiffOffset + 4, littleEndian)
    const ifdStart = tiffOffset + ifdOffset

    if (ifdStart >= view.byteLength) return {}

    const numEntries = view.getUint16(ifdStart, littleEndian)
    let takenAt: Date | undefined
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
        takenAt = parseExifDate(view, tiffOffset + strOffset)
      }
    }

    if (exifOffset) {
      const subIFD = tiffOffset + exifOffset
      if (subIFD < view.byteLength) {
        const subEntries = view.getUint16(subIFD, littleEndian)
        for (let i = 0; i < subEntries; i++) {
          const entryOffset = subIFD + 2 + i * 12
          if (entryOffset + 12 > view.byteLength) break
          const tag = view.getUint16(entryOffset, littleEndian)
          if (tag === 0x9003) {
            const strOffset = view.getUint32(entryOffset + 8, littleEndian)
            takenAt = parseExifDate(view, tiffOffset + strOffset)
            break
          }
        }
      }
    }

    let gps: { lat: number; lng: number } | undefined
    if (gpsOffset) gps = parseGPS(view, tiffOffset + gpsOffset, littleEndian)

    return { takenAt, gps }
  } catch {
    return {}
  }
}

function parseExifDate(view: DataView, offset: number): Date | undefined {
  try {
    let str = ''
    for (let i = 0; i < 19; i++) {
      const char = view.getUint8(offset + i)
      if (char === 0) break
      str += String.fromCharCode(char)
    }
    const match = str.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/)
    if (!match) return undefined
    return new Date(
      parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]),
      parseInt(match[4]), parseInt(match[5]), parseInt(match[6])
    )
  } catch {
    return undefined
  }
}

function parseGPS(
  view: DataView, offset: number, littleEndian: boolean
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
      if (tag === 0x0002) lat = readGPSCoord(view, e, littleEndian)
      if (tag === 0x0004) lng = readGPSCoord(view, e, littleEndian)
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

function readGPSCoord(view: DataView, entry: number, littleEndian: boolean): number {
  const valOffset = view.getUint32(entry + 8, littleEndian)
  const d = view.getUint32(valOffset, littleEndian) / view.getUint32(valOffset + 4, littleEndian)
  const m = view.getUint32(valOffset + 8, littleEndian) / view.getUint32(valOffset + 12, littleEndian)
  const s = view.getUint32(valOffset + 16, littleEndian) / view.getUint32(valOffset + 20, littleEndian)
  return d + m / 60 + s / 3600
}
