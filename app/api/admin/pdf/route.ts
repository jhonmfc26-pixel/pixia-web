import { NextResponse, type NextRequest } from 'next/server'
import { isAdminRequest } from '@/lib/admin/auth'
import { getOrder, signPdfDownloadUrl } from '@/lib/admin/data'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/pdf?ref=PIXIA-...&which=interior|cover
 * Firma un link de descarga fresco (10 min) y redirige al contenedor, que
 * valida la firma y redirige a R2. El secreto nunca sale del servidor.
 */
export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req.headers))) return new NextResponse('No encontrado', { status: 404 })

  const ref = req.nextUrl.searchParams.get('ref')
  const which = req.nextUrl.searchParams.get('which')
  if (!ref || (which !== 'interior' && which !== 'cover')) {
    return new NextResponse('Parámetros inválidos', { status: 400 })
  }

  const o = await getOrder(ref)
  if (!o) return new NextResponse('Pedido no encontrado', { status: 404 })
  const key = which === 'interior' ? o.job?.interior_path : o.job?.cover_path
  if (o.pdf !== 'listo' || !key) return new NextResponse('El PDF de este pedido todavía no está listo', { status: 409 })

  const url = await signPdfDownloadUrl(key)
  if (!url) {
    console.error('[admin/pdf] Falta PDF_CONTAINER_URL o PDF_CONTAINER_SECRET')
    return new NextResponse('Descargas no configuradas (PDF_CONTAINER_URL / PDF_CONTAINER_SECRET)', { status: 500 })
  }
  return NextResponse.redirect(url, 302)
}
