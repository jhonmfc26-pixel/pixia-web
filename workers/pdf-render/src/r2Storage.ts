/**
 * Archivos (páginas + PDF final) en R2 privado — Brick 3. Reemplaza el uso
 * anterior de Supabase Storage (bloqueado por el tope de 50MB/archivo del
 * plan Free — un álbum de 36 páginas mergea a 100MB+). El estado del job
 * (progreso/status) sigue en Supabase, ver jobs.ts — acá solo van bytes.
 *
 * Signed URLs: NO son presigned URLs de S3 (eso necesitaría un Access
 * Key/Secret de R2 nuevos, un tipo de credencial más). En cambio, la URL
 * lleva un token HMAC-SHA256 propio (mismo PDF_RENDER_SECRET que ya
 * comparten app↔worker para autenticar /render-*) sobre `key|exp` — el
 * worker la valida en GET /download y streamea el objeto desde R2. Mismo
 * resultado práctico (expira, sin ella no hay acceso, nunca hay URL pública
 * permanente) con un solo tipo de secreto en vez de dos.
 */
export function createR2Storage(bucket: R2Bucket, downloadSecret: string, workerBaseUrl: string) {
  return {
    /**
     * Input del job (structure/photos/format/baseUrl, o cover/coverPhoto)
     * persistido UNA vez al arrancar — el Cron Trigger lo relee en cada tick
     * para saber qué renderizar, ya que no hay ninguna llamada HTTP "viva"
     * manteniendo esos datos en memoria entre ticks.
     */
    async saveJobInput(blueprintId: string, kind: 'interior' | 'cover', input: unknown): Promise<void> {
      const key = `${blueprintId}/${kind}/job-input.json`
      const body = new TextEncoder().encode(JSON.stringify(input))
      await bucket.put(key, body, { httpMetadata: { contentType: 'application/json' } })
    },

    async loadJobInput<T>(blueprintId: string, kind: 'interior' | 'cover'): Promise<T | null> {
      const key = `${blueprintId}/${kind}/job-input.json`
      const obj = await bucket.get(key)
      if (!obj) return null
      return JSON.parse(await obj.text()) as T
    },

    async uploadPagePdf(blueprintId: string, kind: 'interior' | 'cover', index: number, pdf: Uint8Array): Promise<string> {
      const key = `${blueprintId}/${kind}/page-${String(index).padStart(4, '0')}.pdf`
      await bucket.put(key, pdf, { httpMetadata: { contentType: 'application/pdf' } })
      return key
    },

    async downloadPagePdf(key: string): Promise<Uint8Array> {
      const obj = await bucket.get(key)
      if (!obj) throw new Error(`R2: objeto no encontrado (${key})`)
      return new Uint8Array(await obj.arrayBuffer())
    },

    /** Sube bytes a una key arbitraria — usado por el merge en sub-lotes (merge-part-N.pdf), no sigue el patrón page-NNNN. */
    async uploadRaw(key: string, bytes: Uint8Array): Promise<string> {
      await bucket.put(key, bytes, { httpMetadata: { contentType: 'application/pdf' } })
      return key
    },

    async deletePagePdf(key: string): Promise<void> {
      await bucket.delete(key)
    },

    async uploadFinalPdf(blueprintId: string, kind: 'interior' | 'cover', pdf: Uint8Array): Promise<string> {
      const key = `${blueprintId}/${kind}/final.pdf`
      await bucket.put(key, pdf, { httpMetadata: { contentType: 'application/pdf' } })
      return key
    },

    async signedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
      const exp = Math.floor(Date.now() / 1000) + expiresInSeconds
      const sig = await hmacSignBase64Url(downloadSecret, `${key}|${exp}`)
      const url = new URL('/download', workerBaseUrl)
      url.searchParams.set('key', key)
      url.searchParams.set('exp', String(exp))
      url.searchParams.set('sig', sig)
      return url.toString()
    },
  }
}

export async function verifyDownloadToken(secret: string, key: string, exp: string | null, sig: string | null): Promise<boolean> {
  if (!exp || !sig) return false
  const expNum = Number(exp)
  if (!Number.isFinite(expNum) || expNum < Math.floor(Date.now() / 1000)) return false
  const expected = await hmacSignBase64Url(secret, `${key}|${exp}`)
  return timingSafeEqual(expected, sig)
}

async function hmacSignBase64Url(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message))
  let binary = ''
  for (const byte of new Uint8Array(sigBuf)) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
