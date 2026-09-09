import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import crypto from 'node:crypto'

/**
 * R2 privado (pixia-pdfs-private) vía la API S3-compatible — a diferencia
 * del Worker de Cloudflare (workers/pdf-render/, que usaba el binding R2
 * nativo, sin credenciales), un contenedor fuera de Cloudflare NO tiene
 * acceso a bindings — necesita Access Key/Secret reales, mismo mecanismo
 * que ya usa app/api/upload/route.ts para el bucket PÚBLICO de fotos (pero
 * acá con credenciales propias, escopeadas SOLO a este bucket privado).
 *
 * Signed URLs: mismo esquema HMAC-SHA256 propio que r2Storage.ts del Worker
 * CF (no presigned URLs de S3 — así la app puede seguir firmando la URL
 * localmente con el mismo PDF_CONTAINER_SECRET compartido, sin necesitar
 * también las credenciales S3 del bucket). El download real pasa por
 * GET /download acá, que valida el token y streamea desde R2.
 */
export function createR2Client(config: { endpoint: string; bucket: string; accessKeyId: string; secretAccessKey: string }) {
  const s3 = new S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  })

  return {
    async upload(key: string, bytes: Uint8Array, contentType: string): Promise<string> {
      await s3.send(new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: bytes, ContentType: contentType }))
      return key
    },

    async download(key: string): Promise<Uint8Array> {
      const res = await s3.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }))
      if (!res.Body) throw new Error(`R2: objeto sin body (${key})`)
      const bytes = await res.Body.transformToByteArray()
      return bytes
    },
  }
}

export function signDownloadUrl(secret: string, containerBaseUrl: string, key: string, expiresInSeconds = 3600): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds
  const sig = hmacBase64Url(secret, `${key}|${exp}`)
  const url = new URL('/download', containerBaseUrl)
  url.searchParams.set('key', key)
  url.searchParams.set('exp', String(exp))
  url.searchParams.set('sig', sig)
  return url.toString()
}

export function verifyDownloadToken(secret: string, key: string, exp: string | undefined, sig: string | undefined): boolean {
  if (!exp || !sig) return false
  const expNum = Number(exp)
  if (!Number.isFinite(expNum) || expNum < Math.floor(Date.now() / 1000)) return false
  const expected = hmacBase64Url(secret, `${key}|${exp}`)
  return timingSafeEqualStr(expected, sig)
}

function hmacBase64Url(secret: string, message: string): string {
  const sig = crypto.createHmac('sha256', secret).update(message).digest('base64')
  return sig.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
}
