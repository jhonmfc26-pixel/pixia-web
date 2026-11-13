import { NextResponse, type NextRequest } from 'next/server'
import { isAdminRequest } from '@/lib/admin/auth'
import { createDesign, setDesignActive } from '@/lib/admin/coverDesigns'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

/** Formularios de /admin/portadas: crear un diseño (con su imagen) y mostrar/ocultar. */
export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req.headers))) return new NextResponse('No encontrado', { status: 404 })
  const origin = req.headers.get('origin')
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  if (origin && host && new URL(origin).host !== host) return new NextResponse('Origen no permitido', { status: 403 })

  const form = await req.formData()
  const back = new URL('/admin/portadas', req.url)
  const action = String(form.get('action') ?? 'create')
  if (action === 'toggle') {
    const err = await setDesignActive(String(form.get('id')), form.get('active') === '1')
    if (err) back.searchParams.set('error', err)
    return NextResponse.redirect(back, 303)
  }
  const r = await createDesign(form)
  if (r.ok) back.searchParams.set('ok', '1')
  else back.searchParams.set('error', r.error)
  return NextResponse.redirect(back, 303)
}
