// Web Worker del análisis del paso 2: decodifica cada foto UNA vez, fuera del
// hilo principal, y saca de ahí la miniatura de la grilla y la copia de
// análisis de la que sale el puntaje. Una foto a la vez por worker.
// Antes cada foto de 12 MP se decodificaba entera tres veces en el hilo
// principal (miniatura temprana, copia de 800 px para medir, miniatura otra
// vez): con 40 fotos la pantalla quedaba congelada casi un minuto en un
// celular medio.
import {
  THUMB_QUALITY, ANALYSIS_QUALITY, thumbSize, analysisSize,
} from './quickAnalysisShared'

interface Job {
  id: string
  file: File
  /** Dimensiones de la foto ya orientada (según la vio una <img> en la página). */
  width: number
  height: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctx = self as any

/**
 * JPEG de 2×1 px con orientación EXIF 6 (girar 90°). Si el navegador aplica
 * la orientación al decodificar aquí, sale de 1×2. Si no (Safari viejo), las
 * fotos de celular saldrían de lado: entonces todo va al respaldo del hilo
 * principal, que las ve igual que la página.
 */
const ORIENTED_PROBE =
  '/9j/4QAiRXhpZgAASUkqAAgAAAABABIBAwABAAAABgAAAAAAAAD/2wBDABsSFBcUERsXFhceHBsgKEIrKCUlKFE6PTBCYFVlZF9VXVtqeJmBanGQc1tdhbWGkJ6jq62rZ4C8ybqmx5moq6T/2wBDARweHigjKE4rK06kbl1upKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKSkpKT/wAARCAABAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAT/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABAb/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCAANSP/9k='
let orientationOk: Promise<boolean> | null = null
function appliesOrientation(): Promise<boolean> {
  if (!orientationOk) {
    orientationOk = (async () => {
      const bytes = Uint8Array.from(atob(ORIENTED_PROBE), c => c.charCodeAt(0))
      const b = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }), { imageOrientation: 'from-image' })
      const ok = b.width === 1 && b.height === 2
      b.close()
      return ok
    })().catch(() => false)
  }
  return orientationOk
}

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

function canvas2d(w: number, h: number, willReadFrequently = false) {
  const c = new OffscreenCanvas(w, h)
  const c2d = c.getContext('2d', { willReadFrequently }) as OffscreenCanvasRenderingContext2D | null
  if (!c2d) throw new Error('OffscreenCanvas sin contexto 2d')
  return { c, c2d }
}

ctx.onmessage = async (e: MessageEvent<Job>) => {
  const { id, file, width, height } = e.data
  const opened: ImageBitmap[] = []
  try {
    if (!(await appliesOrientation())) {
      ctx.postMessage({ id, mismatch: true })
      return
    }
    const a = analysisSize(width, height)
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    opened.push(bitmap)

    // Copia de análisis de 800 px, como siempre. Se decodifica la foto entera
    // (no ya reducida): así la copia sale idéntica a la de antes y el puntaje
    // no cambia.
    const mid = canvas2d(a.w, a.h)
    mid.c2d.drawImage(bitmap, 0, 0, a.w, a.h)

    const t = thumbSize(width, height)
    const thumb = canvas2d(t.w, t.h)
    thumb.c2d.drawImage(mid.c, 0, 0, t.w, t.h)
    const thumbnail = await toDataUrl(await thumb.c.convertToBlob({ type: 'image/jpeg', quality: THUMB_QUALITY }))

    // El puntaje se mide sobre esa copia guardada en JPEG (calidad 0,75), como
    // siempre. La última reducción (a 200 px) y la medición las hace la página
    // (quickAnalysis.ts): así el navegador la reduce igual que antes y el
    // puntaje sale idéntico; es poco trabajo.
    const analysisCopy = await mid.c.convertToBlob({ type: 'image/jpeg', quality: ANALYSIS_QUALITY })

    ctx.postMessage({ id, thumbnail, analysisCopy })
  } catch (err) {
    ctx.postMessage({ id, error: err instanceof Error ? err.message : 'error en el worker' })
  } finally {
    opened.forEach(b => b.close())
  }
}
