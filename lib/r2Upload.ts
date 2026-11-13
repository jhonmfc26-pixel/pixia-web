/**
 * Subida a R2 firmada con AWS Signature V4 usando Web Crypto (sirve en el
 * runtime edge de Cloudflare). La usan /api/upload (fotos de clientes) y el
 * admin de portadas (/api/admin/cover-designs).
 */

export function detectImageType(buffer: ArrayBuffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buffer.byteLength < 12) return null
  const b = new Uint8Array(buffer, 0, 12)
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'image/jpeg'
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'image/png'
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp'
  return null
}

// AWS Signature V4 using Web Crypto (edge-compatible)
async function hmacSHA256(key: BufferSource | CryptoKey, data: string): Promise<ArrayBuffer> {
  const cryptoKey = key instanceof CryptoKey ? key : await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data))
}

async function sha256Hex(data: BufferSource): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function getSigningKey(secretKey: string, date: string, region: string, service: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const kDate = await hmacSHA256(enc.encode('AWS4' + secretKey), date)
  const kRegion = await hmacSHA256(kDate, region)
  const kService = await hmacSHA256(kRegion, service)
  const kSigning = await hmacSHA256(kService, 'aws4_request')
  return crypto.subtle.importKey('raw', kSigning, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
}

export async function signedR2Put(
  endpoint: string,
  bucket: string,
  key: string,
  body: ArrayBuffer,
  contentType: string,
  accessKeyId: string,
  secretAccessKey: string,
  /**
   * onlyIfNew: la subida solo se acepta si la clave todavía no existe
   * (If-None-Match: *). Si ya existe, R2 responde 412 y no cambia nada.
   */
  opts: { onlyIfNew?: boolean } = {},
): Promise<Response> {
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z'
  const dateStamp = amzDate.slice(0, 8)
  const region = 'auto'
  const service = 's3'

  const url = new URL(`${endpoint}/${bucket}/${key}`)
  const host = url.hostname
  const path = `/${bucket}/${key}`

  const payloadHash = await sha256Hex(body)

  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`

  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date'

  const canonicalRequest = [
    'PUT',
    path,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(new TextEncoder().encode(canonicalRequest)),
  ].join('\n')

  const signingKey = await getSigningKey(secretAccessKey, dateStamp, region, service)
  const signature = toHex(await crypto.subtle.sign('HMAC', signingKey, new TextEncoder().encode(stringToSign)))

  const authHeader =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`

  return fetch(`${endpoint}/${bucket}/${key}`, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Host': host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      'Authorization': authHeader,
      // No va firmado (SigV4 solo exige host y x-amz-*): R2 lo evalúa igual.
      ...(opts.onlyIfNew ? { 'If-None-Match': '*' } : {}),
    },
    body,
  })
}
