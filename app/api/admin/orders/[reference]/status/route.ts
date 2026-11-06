import { NextResponse, type NextRequest } from 'next/server'
import { isAdminRequest } from '@/lib/admin/auth'
import { updatePrintStatus } from '@/lib/admin/data'
import { isPrintStatus } from '@/lib/orderStatus'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

/** POST desde el formulario "Estado del pedido" del detalle en el admin. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ reference: string }> }) {
  if (!(await isAdminRequest(req.headers))) return new NextResponse('No encontrado', { status: 404 })

  // Defensa CSRF — mismo criterio que /requeue.
  const origin = req.headers.get('origin')
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  if (origin && host && new URL(origin).host !== host) return new NextResponse('Origen no permitido', { status: 403 })

  const { reference } = await params
  const ref = decodeURIComponent(reference)
  const form = await req.formData()
  const to = form.get('status')
  const back = new URLSearchParams()

  if (!isPrintStatus(to)) {
    back.set('error', 'Estado inválido')
  } else {
    const result = await updatePrintStatus(ref, to, {
      carrier: String(form.get('carrier') ?? ''),
      trackingNumber: String(form.get('trackingNumber') ?? ''),
      trackingUrl: String(form.get('trackingUrl') ?? ''),
      notify: form.get('notify') === 'on',
    })
    if (!result.ok) back.set('error', result.error)
    else if (result.emailed) back.set('ok', 'estado-correo')
    else if (result.emailError) back.set('error', `Estado guardado, pero el correo al cliente falló: ${result.emailError}`)
    else back.set('ok', 'estado')
  }

  return new NextResponse(null, {
    status: 303,
    headers: { location: `/admin/pedidos/${encodeURIComponent(ref)}?${back}` },
  })
}
