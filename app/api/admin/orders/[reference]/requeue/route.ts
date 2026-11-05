import { NextResponse, type NextRequest } from 'next/server'
import { isAdminRequest } from '@/lib/admin/auth'
import { requeuePdf } from '@/lib/admin/data'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

/** POST desde el botón "Reintentar / Regenerar PDF" del detalle del pedido. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ reference: string }> }) {
  if (!(await isAdminRequest(req.headers))) return new NextResponse('No encontrado', { status: 404 })

  // Defensa CSRF: el form vive en este mismo origen.
  const origin = req.headers.get('origin')
  if (origin && origin !== req.nextUrl.origin) return new NextResponse('Origen no permitido', { status: 403 })

  const { reference } = await params
  const ref = decodeURIComponent(reference)
  const back = new URL(`/admin/pedidos/${encodeURIComponent(ref)}`, req.nextUrl.origin)

  const result = await requeuePdf(ref)
  if (result.ok) back.searchParams.set('ok', 'reencolado')
  else back.searchParams.set('error', result.error)
  return NextResponse.redirect(back, 303)
}
