import { getRequestContext } from '@cloudflare/next-on-pages'

/**
 * Pide al contenedor que procese la cola YA (POST /process-pending), en vez
 * de esperar al barrido de Cloud Scheduler (cada 5 min). No bloquea la
 * respuesta: en Cloudflare usa waitUntil para que el pedido siga vivo después
 * de responder. Devuelve false si falta configuración — el barrido programado
 * igual lo toma.
 */
export function kickPdfSweep(): boolean {
  const base = process.env.PDF_CONTAINER_URL
  const secret = process.env.PDF_CONTAINER_SECRET
  if (!base || !secret) return false

  const run = fetch(new URL('/process-pending', base), {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
  })
    .then(r => { if (!r.ok) console.error('[admin] /process-pending respondió', r.status) })
    .catch(err => console.error('[admin] no se pudo llamar a /process-pending:', err))

  try {
    getRequestContext().ctx.waitUntil(run)
  } catch {
    // `next dev` local: no hay contexto de Cloudflare; la promesa corre igual.
  }
  return true
}
