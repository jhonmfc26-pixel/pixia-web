'use client'
/**
 * Miniatura + puntaje de cada foto del paso 2, decodificando la foto una sola
 * vez y fuera del hilo principal (quickAnalysisWorker.ts).
 *
 * - Una sola pasada por foto: la grilla (miniatura temprana) y el análisis
 *   piden lo mismo y comparten el resultado.
 * - Dos workers y una cola: nunca se decodifican decenas de fotos de 12 MP a
 *   la vez (en un iPhone eso puede cerrar la pestaña por memoria).
 * - Sin workers (navegadores viejos), o si el worker ve la foto de lado, lo
 *   hace el hilo principal, de a una foto y con una sola decodificación.
 */
import { defaultScore } from './photoScorer'
import {
  THUMB_QUALITY, ANALYSIS_QUALITY, thumbSize, scoreSampleSize, scoreSample, analysisSize, type QuickAnalysis,
} from './quickAnalysisShared'

export type { QuickAnalysis } from './quickAnalysisShared'

const POOL_SIZE = 2
const WORKER_TIMEOUT_MS = 30_000

const memo = new WeakMap<File, Promise<QuickAnalysis>>()

/** Miniatura y puntaje de `file`. Se calcula una sola vez por archivo. */
export function quickAnalysis(file: File): Promise<QuickAnalysis> {
  let p = memo.get(file)
  if (!p) {
    p = run(file)
    memo.set(file, p)
    // Si falla, que un próximo intento (otra tanda) pueda volver a probar.
    p.catch(() => memo.delete(file))
  }
  return p
}

async function run(file: File): Promise<QuickAnalysis> {
  const { width, height, img } = await loadImage(file)
  const size = analysisSize(width, height)
  if (workersAvailable()) {
    try {
      const r = await inWorker(file, width, height)
      if (r) {
        releaseImage(img)
        const url = URL.createObjectURL(r.analysisCopy)
        try {
          return { width: size.w, height: size.h, thumbnail: r.thumbnail, score: await scoreCopy(await loadSrc(url), width, height) }
        } finally { URL.revokeObjectURL(url) }
      }
    } catch (err) {
      console.warn('[quickAnalysis] worker falló, sigue en la página:', file.name, err)
    }
  }
  return onMainThread(img, width, height, size)
}

/**
 * Carga la foto en una <img> solo para leer sus dimensiones ya orientadas:
 * el navegador no la decodifica entera mientras no se dibuje.
 */
function loadImage(file: File): Promise<{ width: number; height: number; img: HTMLImageElement }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    const timeout = setTimeout(() => { URL.revokeObjectURL(url); reject(new Error(`no cargó: ${file.name}`)) }, 15_000)
    img.onload = () => {
      clearTimeout(timeout)
      const width = img.naturalWidth, height = img.naturalHeight
      if (!width || !height) { URL.revokeObjectURL(url); reject(new Error(`sin dimensiones: ${file.name}`)); return }
      // La URL sigue viva por si hace falta el respaldo; se libera al terminar.
      img.dataset.blobUrl = url
      resolve({ width, height, img })
    }
    img.onerror = () => { clearTimeout(timeout); URL.revokeObjectURL(url); reject(new Error(`no se pudo leer: ${file.name}`)) }
    img.src = url
  })
}

function releaseImage(img: HTMLImageElement) {
  const url = img.dataset.blobUrl
  if (url) { URL.revokeObjectURL(url); delete img.dataset.blobUrl }
  img.removeAttribute('src')
}

// ── Workers ─────────────────────────────────────────────────────────────────

interface WorkerResult {
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
        const { id, thumbnail, analysisCopy, mismatch, error } = e.data || {}
        const job = pending.get(id)
        if (!job) return
        pending.delete(id)
        clearTimeout(job.timer)
        if (error) job.reject(new Error(error))
        else if (mismatch) job.resolve(null)
        else job.resolve({ thumbnail: thumbnail ?? null, analysisCopy })
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

function inWorker(file: File, width: number, height: number) {
  const workers = getPool()
  const id = `qa-${counter++}`
  const worker = workers[counter % workers.length]
  return new Promise<WorkerResult | null>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (pending.delete(id)) reject(new Error('tiempo agotado'))
    }, WORKER_TIMEOUT_MS)
    pending.set(id, { resolve, reject, timer })
    worker.postMessage({ id, file, width, height })
  })
}

// ── Respaldo en el hilo principal: de a una foto ────────────────────────────

let mainQueue: Promise<unknown> = Promise.resolve()

function onMainThread(img: HTMLImageElement, width: number, height: number, size: { w: number; h: number }): Promise<QuickAnalysis> {
  const job = mainQueue.then(async () => {
    try {
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
        score = await scoreCopy(await loadSrc(midCanvas.toDataURL('image/jpeg', ANALYSIS_QUALITY)), width, height)
      } catch { /* puntaje neutro */ }

      return { width: size.w, height: size.h, thumbnail, score }
    } finally {
      releaseImage(img)
    }
  })
  mainQueue = job.catch(() => undefined)
  return job
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
  }
}
