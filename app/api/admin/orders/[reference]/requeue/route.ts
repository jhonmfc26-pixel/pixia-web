import { NextResponse, type NextRequest } from 'next/server'
import { isAdminRequest } from '@/lib/admin/auth'
import { requeuePdf } from '@/lib/admin/data'
import { kickPdfSweep } from '@/lib/admin/sweep'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

/** POST desde el botón "Reintentar / Regenerar PDF" del detalle del pedido. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ reference: string }> }) {
  if (!(await isAdminRequest(req.headers))) return new NextResponse('No encontrado', { status: 404 })

  // Defensa CSRF: el form vive en este mismo sitio. Se compara contra el
  // header Host (no nextUrl.origin, que detrás de Cloudflare puede diferir).
  const origin = req.headers.get('origin')
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  if (origin && host && new URL(origin).host !== host) return new NextResponse('Origen no permitido', { status: 403 })

  const { reference } = await params
  const ref = decodeURIComponent(reference)
  // Redirección relativa al mismo host por el que entró el admin.
  const back = new URLSearchParams()
  const result = await requeuePdf(ref)
  if (result.ok) back.set('ok', kickPdfSweep() ? 'reencolado' : 'reencolado-cola')
  else back.set('error', result.error)
  return new NextResponse(null, {
    status: 303,
    headers: { location: `/admin/pedidos/${encodeURIComponent(ref)}?${back}` },
  })
}
