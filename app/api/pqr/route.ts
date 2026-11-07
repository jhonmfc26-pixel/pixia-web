import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/core/middleware/rateLimiter'
import { supabaseAdmin } from '@/lib/supabase'
import { parsePqrInput } from '@/lib/pqr'
import { createPqr } from '@/lib/pqrData'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

/** Radicar una petición, queja o reclamo desde /soporte. */
export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, '/api/pqr')
  if (limited) return limited

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 }) }

  // Campo trampa: invisible para personas, los bots lo llenan.
  if (body.website) return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })

  const parsed = parsePqrInput(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  let userId: string | null = null
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (token) {
    const { data } = await supabaseAdmin.auth.getUser(token)
    userId = data?.user?.id ?? null
  }

  try {
    const { row, emailed, createdAtLabel, dueDateLabel } = await createPqr(parsed.value, {
      userId,
      ip: req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    })
    return NextResponse.json({ radicado: row.radicado, createdAtLabel, dueDateLabel, emailed })
  } catch (err) {
    console.error('[pqr] create:', err)
    return NextResponse.json({ error: `No pudimos radicar tu solicitud. Escríbenos a ${process.env.EMAIL_SUPPORT || 'soporte@pixiaa.com'}.` }, { status: 500 })
  }
}
