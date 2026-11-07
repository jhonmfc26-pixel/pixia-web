import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/core/middleware/rateLimiter'
import { normalizeRadicado } from '@/lib/pqr'
import { findPqrForCustomer } from '@/lib/pqrData'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

/** Seguimiento de un radicado: pide radicado + correo (los dos deben coincidir). */
export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, '/api/pqr')
  if (limited) return limited
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 }) }

  const radicado = normalizeRadicado(String(body.radicado ?? ''))
  const email = String(body.email ?? '').trim().toLowerCase()
  if (!/^PQR-\d{8}-[A-Z0-9]{6}$/.test(radicado) || !email) {
    return NextResponse.json({ error: 'Revisa el número de radicado (PQR-AAAAMMDD-XXXXXX) y el correo.' }, { status: 400 })
  }
  try {
    const found = await findPqrForCustomer(radicado, email)
    // Mismo mensaje si no existe o si el correo no coincide: no revelar radicados ajenos.
    if (!found) return NextResponse.json({ error: 'No encontramos un radicado con ese número y ese correo.' }, { status: 404 })
    return NextResponse.json({ pqr: found })
  } catch (err) {
    console.error('[pqr] seguimiento:', err)
    return NextResponse.json({ error: 'Error consultando el radicado. Inténtalo de nuevo.' }, { status: 500 })
  }
}
