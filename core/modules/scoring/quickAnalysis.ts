'use client'
/**
 * Miniatura + puntaje de cada foto del paso 2, decodificando la foto una sola
 * vez y fuera del hilo principal (quickAnalysisWorker.ts).
 *
 * - Una sola pasada por foto: la grilla (miniatura temprana) y el análisis
 *   piden lo mismo y comparten el resultado.
 * - MEMORIA: como mucho POOL_SIZE fotos en proceso a la vez, en todo el
 *   módulo. La grilla pide las 100 miniaturas de golpe; si cada pedido
 *   cargara su foto en una <img> mientras espera turno, un iPhone decodifica
 *   decenas de fotos de 12 MP a la vez, se queda sin memoria y Safari
 *   recarga la pestaña (el cliente vuelve al paso 1). Por eso las fotos
 *   esperan en una cola SIN cargarse, y en el camino del worker la página no
 *   las carga nunca: el worker mide la foto él mismo.
 * - Sin workers (navegadores viejos), o si el navegador no aplica la
 *   orientación EXIF dentro del worker, lo hace la página: de a una foto, y
 *   la <img> se suelta apenas termina.
 */
import { defaultScore } from './photoScorer'
import {
  THUMB_QUALITY, ANALYSIS_QUALITY, thumbSize, scoreSampleSize, scoreSample, analysisSize, type QuickAnalysis,
} from './quickAnalysisShared'

export type { QuickAnalysis } from './quickAnalysisShared'

/** iPhone y iPad (incluido el iPad que se presenta como Mac): menos memoria por pestaña. */
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/** Fotos en proceso a la vez (cada una ocupa ~50 MB decodificada). */
const POOL_SIZE = isIOS() ? 1 : 2
const WORKER_TIMEOUT_MS = 30_000

const memo = new WeakMap<File, Promise<QuickAnalysis>>()

/** Miniatura y puntaje de `file`. Se calcula una sola vez por archivo. */
export function quickAnalysis(file: File): Promise<QuickAnalysis> {
  let p = memo.get(file)
  if (!p) {
    p = limited(() => run(file))
    memo.set(file, p)
    // Si falla, que un próximo intento (otra tanda) pueda volver a probar.
    p.catch(() => memo.delete(file))
  }
  return p
}

// ── Cola: a lo sumo POOL_SIZE fotos en proceso ──────────────────────────────

let active = 0
const waiting: Array<() => void> = []

async function limited<T>(job: () => Promise<T>): Promise<T> {
  if (active >= POOL_SIZE) await new Promise<void>(resolve => waiting.push(resolve))
  active++
  try {
    return await job()
  } finally {
    active--
    waiting.shift()?.()
  }
}

async function run(file: File): Promise<QuickAnalysis> {
  if (workersAvailable()) {
    try {
      const r = await inWorker(file)
      if (r) {
        const size = analysisSize(r.width, r.height)
        const url = URL.createObjectURL(r.analysisCopy)
        try {
          return { width: size.w, height: size.h, thumbnail: r.thumbnail, score: await scoreCopy(await loadSrc(url), r.width, r.height) }
        } finally { URL.revokeObjectURL(url) }
      }
    } catch (err) {
      console.warn('[quickAnalysis] worker falló, sigue en la página:', file.name, err)
    }
  }
  return onMainThread(file)
}

// ── Workers ─────────────────────────────────────────────────────────────────

interface WorkerResult {
  /** Medidas de la foto ya orientada. */
  width: number
  height: number
  thumbnail: string | null
  /** Copia de análisis de 800 px en JPEG 0,75: de ella sale el puntaje. */
  analysisCopy: Blob
}

interface Pending {
  resolve: (r: WorkerResult | null) => void
  reject: (e: Error) => void
  timer: ReturnType<typeof setTimeout>
}

let pool: Worker[] | null = null
let broken = false
let counter = 0
const pending = new Map<string, Pending>()

function workersAvailable(): boolean {
  return !broken && typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap !== 'undefined'
}

function getPool(): Worker[] {
  if (!pool) {
    pool = []
    for (let i = 0; i < POOL_SIZE; i++) {
      const w = new Worker(new URL('./quickAnalysisWorker.ts', import.meta.url), { type: 'module' })
      w.onmessage = (e: MessageEvent) => {
        const { id, width, height, thumbnail, analysisCopy, mismatch, error } = e.data || {}
        const job = pending.get(id)
        if (!job) return
        pending.delete(id)
        clearTimeout(job.timer)
        if (error) job.reject(new Error(error))
        else if (mismatch) job.resolve(null)
        else if (!width || !height) job.reject(new Error('sin medidas'))
        else job.resolve({ width, height, thumbnail: thumbnail ?? null, analysisCopy })
      }
      w.onerror = (e) => {
        // El worker no arrancó (o se cayó): todo pasa al respaldo.
        console.warn('[quickAnalysis] worker caído:', e.message)
        broken = true
        for (const [id, job] of pending) { clearTimeout(job.timer); job.reject(new Error('worker caído')); pending.delete(id) }
      }
      pool.push(w)
    }
  }
  return pool
}

function inWorker(file: File) {
  const workers = getPool()
  const id = `qa-${counter++}`
  const worker = workers[counter % workers.length]
  return new Promise<WorkerResult | null>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (pending.delete(id)) reject(new Error('tiempo agotado'))
    }, WORKER_TIMEOUT_MS)
    pending.set(id, { resolve, reject, timer })
    worker.postMessage({ id, file })
  })
}

// ── Respaldo en el hilo principal ───────────────────────────────────────────

/** Una foto a la vez (la cola de arriba ya limita); la <img> se suelta al terminar. */
async function onMainThread(file: File): Promise<QuickAnalysis> {
  const url = URL.createObjectURL(file)
  const img = new window.Image()
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`no cargó: ${file.name}`)), 15_000)
      img.onload = () => { clearTimeout(timeout); resolve() }
      img.onerror = () => { clearTimeout(timeout); reject(new Error(`no se pudo leer: ${file.name}`)) }
      img.src = url
    })
    const width = img.naturalWidth, height = img.naturalHeight
    if (!width || !height) throw new Error(`sin dimensiones: ${file.name}`)
    const size = analysisSize(width, height)

    let thumbnail: string | null = null
    try {
      const t = thumbSize(width, height)
      const c = document.createElement('canvas')
      c.width = t.w; c.height = t.h
      c.getContext('2d')!.drawImage(img, 0, 0, t.w, t.h)
      thumbnail = c.toDataURL('image/jpeg', THUMB_QUALITY)
    } catch { /* sin miniatura: la grilla muestra el esqueleto */ }

    let score = defaultScore()
    try {
      // Igual que siempre: copia JPEG de 800 px y de ahí la medición.
      const midCanvas = document.createElement('canvas')
      midCanvas.width = size.w; midCanvas.height = size.h
      midCanvas.getContext('2d')!.drawImage(img, 0, 0, size.w, size.h)
      const copy = midCanvas.toDataURL('image/jpeg', ANALYSIS_QUALITY)
      midCanvas.width = 0; midCanvas.height = 0
      score = await scoreCopy(await loadSrc(copy), width, height)
    } catch { /* puntaje neutro */ }

    return { width: size.w, height: size.h, thumbnail, score }
  } finally {
    URL.revokeObjectURL(url)
    img.removeAttribute('src')
  }
}

function loadSrc(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('copia de análisis ilegible'))
    img.src = src
  })
}

/**
 * Puntaje a partir de la copia de análisis (800 px, JPEG 0,75), reducida a
 * 200 px con una <img> como siempre: el navegador la reduce igual que antes y
 * el resultado no cambia. Es una imagen chica: unos pocos milisegundos.
 */
async function scoreCopy(copy: HTMLImageElement, width: number, height: number) {
  try {
    const s = scoreSampleSize(width, height)
    const c = document.createElement('canvas')
    c.width = s.w; c.height = s.h
    const cx = c.getContext('2d', { willReadFrequently: true })!
    cx.drawImage(copy, 0, 0, s.w, s.h)
    return scoreSample(cx.getImageData(0, 0, s.w, s.h).data, s.w, s.h, width, height)
  } catch {
    return defaultScore()
  } finally {
    copy.removeAttribute('src')
  }
}
