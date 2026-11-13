import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/core/middleware/rateLimiter'
import { detectImageType, signedR2Put } from '@/lib/r2Upload'

export const runtime = 'edge'

const MAX_FILE_BYTES = 25 * 1024 * 1024  // 25 MB
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
// El id de la foto forma parte de la ruta del archivo: solo caracteres seguros.
const PHOTO_ID = /^[A-Za-z0-9_-]{1,64}$/
/** R2 responde 412 cuando la clave ya existe y la subida pedía «solo si es nueva». */
const ALREADY_EXISTS = 412

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

    if (typeof photoId !== 'string' || !PHOTO_ID.test(photoId)) {
      return NextResponse.json({ error: 'photoId inválido' }, { status: 400 })
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

    // Una foto subida no se vuelve a escribir. La ruta no pide sesión, y el id
    // de sesión y el de la foto van en la dirección pública de la imagen: sin
    // esto cualquiera podría reemplazar una foto ajena antes de que se imprima.
    // Si ya existe (un reintento del mismo navegador cuya primera respuesta se
    // perdió) se responde como subida, con la que ya estaba.
    let r2Res = await signedR2Put(endpoint, bucket, key, buffer, detectedType, accessKeyId, secretAccessKey, { onlyIfNew: true })
    if (!r2Res.ok && r2Res.status !== ALREADY_EXISTS && r2Res.status < 500) {
      // R2 rechazó la subida condicional por otra razón: antes que dejar al
      // cliente sin poder subir fotos, se intenta sin la condición. Si este
      // mensaje aparece en los logs hay que revisarlo.
      console.error('[Upload] R2 no aceptó la subida condicional, se reintenta sin condición:', r2Res.status, await r2Res.text())
      r2Res = await signedR2Put(endpoint, bucket, key, buffer, detectedType, accessKeyId, secretAccessKey)
    }

    if (!r2Res.ok && r2Res.status !== ALREADY_EXISTS) {
      const errText = await r2Res.text()
      console.error('[Upload] R2 error:', r2Res.status, errText)
      return NextResponse.json({ error: 'R2 upload failed' }, { status: 502 })
    }

    const url = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`

    // Versión liviana para el visor (opcional): misma sesión, carpeta display/.
    // Si falla, no pasa nada: el visor usa la original.
    let displayUrl: string | undefined
    const display = formData.get('display')
    if (display instanceof File && display.size > 0 && display.size <= MAX_FILE_BYTES) {
      const dBuf = await display.arrayBuffer()
      const dType = detectImageType(dBuf)
      if (dType) {
        const dKey = `users/${sessionId}/display/${photoId}.jpg`
        const dRes = await signedR2Put(endpoint, bucket, dKey, dBuf, dType, accessKeyId, secretAccessKey, { onlyIfNew: true })
        if (dRes.ok || dRes.status === ALREADY_EXISTS) displayUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${dKey}`
        else console.error('[Upload] R2 display error:', dRes.status)
      }
    }
    return NextResponse.json({ url, key, photoId, displayUrl })

  } catch (error) {
    console.error('[Upload] Error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
