// Web Worker — sin imports, auto-contenido. Procesa múltiples mensajes.
// Usa OffscreenCanvas + createImageBitmap (no Image() — no existe en workers).

/**
 * Dos versiones de cada foto (2026-11-12):
 *  - IMPRENTA (la que va a R2 como original y usa el PDF): hasta 6000 px de
 *    lado mayor. Antes se reducía a 3000 px y una foto que cruza la doble
 *    página de 30×30 (60 cm) quedaba a ~127 dpi: se veía suave impresa. Con
 *    6000 px una foto de celular (4032 px) se sube entera.
 *  - VISOR: 1800 px, liviana, para pasar páginas sin decodificar fotos de
 *    12 MP en el celular. El visor y el editor usan esta; el PDF nunca.
 */
const MAX_DIMENSION = 6000
const QUALITY = 0.92
const DISPLAY_DIMENSION = 1800
const DISPLAY_QUALITY = 0.82
/** Debajo de este peso el archivo original se sube tal cual como versión de imprenta. */
const SKIP_THRESHOLD = 8 * 1024 * 1024

interface WorkerInput {
  id: string
  fileBuffer: ArrayBuffer
  fileType: string
  fileName: string
}

interface WorkerSuccess {
  id: string
  blob: Blob
  /** Versión liviana para el visor; sin valor si la foto ya es chica. */
  displayBlob?: Blob
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
    const sourceBlob = new Blob([fileBuffer], { type: fileType })
    const bitmap = await createImageBitmap(sourceBlob)
    const srcW = bitmap.width
    const srcH = bitmap.height

    const scaled = (max: number) => {
      const long = Math.max(srcW, srcH)
      const k = long > max ? max / long : 1
      return { w: Math.round(srcW * k), h: Math.round(srcH * k) }
    }
    const render = async (w: number, h: number, quality: number) => {
      const canvas = new OffscreenCanvas(w, h)
      const offCtx = canvas.getContext('2d')
      if (!offCtx) throw new Error('OffscreenCanvas getContext failed')
      offCtx.drawImage(bitmap, 0, 0, w, h)
      return canvas.convertToBlob({ type: 'image/jpeg', quality })
    }

    // Imprenta: el original si no es enorme; si no, 6000 px.
    const big = Math.max(srcW, srcH) > MAX_DIMENSION || fileBuffer.byteLength > SKIP_THRESHOLD
    const printSize = big ? scaled(MAX_DIMENSION) : { w: srcW, h: srcH }
    const blob = big ? await render(printSize.w, printSize.h, QUALITY) : sourceBlob

    // Visor: solo si la foto es más grande que eso.
    const displayBlob = Math.max(srcW, srcH) > DISPLAY_DIMENSION
      ? await render(scaled(DISPLAY_DIMENSION).w, scaled(DISPLAY_DIMENSION).h, DISPLAY_QUALITY)
      : undefined
    bitmap.close()

    const result: WorkerSuccess = {
      id,
      blob,
      displayBlob,
      sizeBefore: fileBuffer.byteLength,
      sizeAfter: blob.size,
      savedRatio: big ? 1 - blob.size / fileBuffer.byteLength : 0,
      width: printSize.w,
      height: printSize.h,
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
