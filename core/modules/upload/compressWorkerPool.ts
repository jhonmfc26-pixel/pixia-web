import { compressForUpload } from './compressForUpload'

const POOL_SIZE = 2
const TIMEOUT_MS = 15_000

interface WorkerResult {
  blob: Blob
  sizeBefore: number
  sizeAfter: number
  savedRatio: number
}

interface PendingJob {
  resolve: (result: WorkerResult) => void
  reject: (err: Error) => void
  timeoutId: ReturnType<typeof setTimeout>
}

// Pool-level state: inicializado lazily, una sola vez por sesión de página
let pool: Worker[] = []
let jobCounter = 0
const pendingJobs = new Map<string, PendingJob>()

function supportsWorkerCompression(): boolean {
  return (
    typeof Worker !== 'undefined' &&
    typeof OffscreenCanvas !== 'undefined' &&
    typeof createImageBitmap !== 'undefined'
  )
}

function handleWorkerMessage(e: MessageEvent) {
  const { id, blob, sizeBefore, sizeAfter, savedRatio, error } = e.data
  const job = pendingJobs.get(id)
  if (!job) return
  pendingJobs.delete(id)
  clearTimeout(job.timeoutId)

  if (error) {
    job.reject(new Error(error))
  } else {
    job.resolve({ blob, sizeBefore, sizeAfter, savedRatio })
  }
}

function handleWorkerError(e: ErrorEvent) {
  // Error en el worker (sintaxis, etc.) — rechazar todos los jobs pendientes de ese worker
  console.error('[CompressWorker] Worker error:', e.message)
}

function getPool(): Worker[] {
  if (pool.length === 0) {
    for (let i = 0; i < POOL_SIZE; i++) {
      const worker = new Worker(
        new URL('./compressWorker.ts', import.meta.url),
        { type: 'module' }
      )
      worker.onmessage = handleWorkerMessage
      worker.onerror = handleWorkerError
      pool.push(worker)
    }
  }
  return pool
}

/**
 * Comprime un File usando un Web Worker del pool (OffscreenCanvas, off-thread).
 * Si el browser no soporta OffscreenCanvas, hace fallback al main thread.
 */
export async function compressInWorker(file: File): Promise<WorkerResult> {
  // Fallback al main thread si el browser no soporta la API del worker
  if (!supportsWorkerCompression()) {
    const result = await compressForUpload(file)
    return {
      blob: result.blob,
      sizeBefore: result.sizeBefore,
      sizeAfter: result.sizeAfter,
      savedRatio: result.savedRatio,
    }
  }

  const workers = getPool()
  const workerIdx = jobCounter % workers.length
  const worker = workers[workerIdx]
  const id = `job-${jobCounter++}`

  // Leer como ArrayBuffer para transferencia zero-copy al worker
  const fileBuffer = await file.arrayBuffer()

  return new Promise<WorkerResult>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      if (pendingJobs.has(id)) {
        pendingJobs.delete(id)
        reject(new Error(`Worker timeout (15s): ${file.name}`))
      }
    }, TIMEOUT_MS)

    pendingJobs.set(id, { resolve, reject, timeoutId })

    // Transferir el buffer zero-copy (el buffer queda detached en el main thread)
    worker.postMessage(
      { id, fileBuffer, fileType: file.type, fileName: file.name },
      [fileBuffer]
    )
  })
}
