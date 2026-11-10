import { NextResponse, type NextRequest } from 'next/server'
import { isAdminRequest } from '@/lib/admin/auth'
import { requestStorageMeasure } from '@/lib/admin/storage'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

/** POST del botón "Medir ahora" en /admin/almacenamiento (modo prueba: no borra nada). */
export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req.headers))) return new NextResponse('No encontrado', { status: 404 })
  const origin = req.headers.get('origin')
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  if (origin && host && new URL(origin).host !== host) return new NextResponse('Origen no permitido', { status: 403 })

  const r = await requestStorageMeasure()
  const back = new URL('/admin/almacenamiento', req.url)
  if (r.ok) back.searchParams.set('ok', '1')
  else back.searchParams.set('error', r.error)
  return NextResponse.redirect(back, 303)
}
