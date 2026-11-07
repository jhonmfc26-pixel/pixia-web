import { NextResponse, type NextRequest } from 'next/server'
import { isAdminRequest } from '@/lib/admin/auth'
import { isPqrStatus } from '@/lib/pqr'
import { updatePqr } from '@/lib/pqrData'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

/** POST del formulario de respuesta en /admin/pqr/<radicado>. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ radicado: string }> }) {
  if (!(await isAdminRequest(req.headers))) return new NextResponse('No encontrado', { status: 404 })
  const origin = req.headers.get('origin')
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  if (origin && host && new URL(origin).host !== host) return new NextResponse('Origen no permitido', { status: 403 })

  const { radicado } = await params
  const rad = decodeURIComponent(radicado)
  const form = await req.formData()
  const status = form.get('status')
  const back = new URLSearchParams()

  if (!isPqrStatus(status)) back.set('error', 'Estado inválido')
  else {
    const r = await updatePqr(rad, {
      status,
      response: String(form.get('response') ?? ''),
      internalNotes: String(form.get('internalNotes') ?? ''),
      notify: form.get('notify') === 'on',
    })
    if (!r.ok) back.set('error', r.error)
    else if (r.emailError) back.set('error', `Guardado, pero el correo al cliente falló: ${r.emailError}`)
    else back.set('ok', r.emailed ? 'respondido' : 'guardado')
  }
  return new NextResponse(null, { status: 303, headers: { location: `/admin/pqr/${encodeURIComponent(rad)}?${back}` } })
}
