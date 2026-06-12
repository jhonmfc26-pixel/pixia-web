import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/core/middleware/rateLimiter'

export const runtime = 'edge'

const MAX_FILE_BYTES = 25 * 1024 * 1024  // 25 MB
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function detectImageType(buffer: ArrayBuffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
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

async function signedR2Put(
  endpoint: string,
  bucket: string,
  key: string,
  body: ArrayBuffer,
  contentType: string,
  accessKeyId: string,
  secretAccessKey: string,
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
    },
    body,
  })
}

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, '/api/upload')
  if (limited) return limited

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const sessionId = formData.get('sessionId') as string
    const photoId = formData.get('photoId') as string

    if (!file || !sessionId || !photoId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // Validar formato UUID v4 del sessionId
    if (!UUID_V4.test(sessionId)) {
      return NextResponse.json({ error: 'sessionId inválido' }, { status: 400 })
    }

    // Validar tamaño antes de leer el buffer completo
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'Archivo demasiado grande (máx 25 MB)' }, { status: 413 })
    }

    const buffer = await file.arrayBuffer()

    // Validar tipo real por magic bytes — no confiar en file.type del cliente
    const detectedType = detectImageType(buffer)
    if (!detectedType) {
      return NextResponse.json({ error: 'Tipo de archivo no soportado' }, { status: 415 })
    }

    const endpoint = process.env.R2_ENDPOINT!
    const bucket = process.env.R2_BUCKET!
    const accessKeyId = process.env.R2_ACCESS_KEY_ID!
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY!

    const key = `users/${sessionId}/original/${photoId}.jpg`

    const r2Res = await signedR2Put(endpoint, bucket, key, buffer, detectedType, accessKeyId, secretAccessKey)

    if (!r2Res.ok) {
      const errText = await r2Res.text()
      console.error('[Upload] R2 error:', r2Res.status, errText)
      return NextResponse.json({ error: 'R2 upload failed', detail: errText }, { status: 502 })
    }

    const url = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`
    return NextResponse.json({ url, key, photoId })

  } catch (error) {
    console.error('[Upload] Error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
