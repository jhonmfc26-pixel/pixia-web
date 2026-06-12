// Web Worker — sin imports, auto-contenido. Procesa múltiples mensajes.
// Usa OffscreenCanvas + createImageBitmap (no Image() — no existe en workers).

const MAX_DIMENSION = 3000
const QUALITY = 0.85
const SKIP_THRESHOLD = 1.5 * 1024 * 1024

interface WorkerInput {
  id: string
  fileBuffer: ArrayBuffer
  fileType: string
  fileName: string
}

interface WorkerSuccess {
  id: string
  blob: Blob
  sizeBefore: number
  sizeAfter: number
  savedRatio: number
  width: number
  height: number
}

interface WorkerError {
  id: string
  error: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctx = self as any

ctx.onmessage = async (e: MessageEvent<WorkerInput>) => {
  const { id, fileBuffer, fileType, fileName } = e.data

  try {
    // Skip si ya es pequeño — devolver el blob original sin tocar
    if (fileBuffer.byteLength < SKIP_THRESHOLD) {
      const originalBlob = new Blob([fileBuffer], { type: fileType })
      const result: WorkerSuccess = {
        id,
        blob: originalBlob,
        sizeBefore: fileBuffer.byteLength,
        sizeAfter: fileBuffer.byteLength,
        savedRatio: 0,
        width: 0,
        height: 0,
      }
      ctx.postMessage(result)
      return
    }

    const sourceBlob = new Blob([fileBuffer], { type: fileType })
    const bitmap = await createImageBitmap(sourceBlob)

    let { width, height } = bitmap
    if (width > height && width > MAX_DIMENSION) {
      height = Math.round((height * MAX_DIMENSION) / width)
      width = MAX_DIMENSION
    } else if (height > MAX_DIMENSION) {
      width = Math.round((width * MAX_DIMENSION) / height)
      height = MAX_DIMENSION
    }

    const canvas = new OffscreenCanvas(width, height)
    const offCtx = canvas.getContext('2d')
    if (!offCtx) throw new Error('OffscreenCanvas getContext failed')
    offCtx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const compressedBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: QUALITY })

    const result: WorkerSuccess = {
      id,
      blob: compressedBlob,
      sizeBefore: fileBuffer.byteLength,
      sizeAfter: compressedBlob.size,
      savedRatio: 1 - compressedBlob.size / fileBuffer.byteLength,
      width,
      height,
    }
    ctx.postMessage(result)
  } catch (err) {
    const result: WorkerError = {
      id,
      error: err instanceof Error ? err.message : `worker error: ${fileName}`,
    }
    ctx.postMessage(result)
  }
}
