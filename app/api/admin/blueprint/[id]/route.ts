import { NextResponse, type NextRequest } from 'next/server'
import { isAdminRequest } from '@/lib/admin/auth'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/blueprint/[id] — el álbum completo, para que el admin lo
 * abra en el visor (/book/[id]?admin=1) sin ser el dueño. El visor normal
 * carga con la sesión de Supabase del cliente (RLS) y desde el admin no la hay.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest(req.headers))) return new NextResponse('No encontrado', { status: 404 })
  const { id } = await params
  const { data, error } = await supabaseAdmin.from('blueprints').select('*').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Álbum no encontrado' }, { status: 404 })
  return NextResponse.json(data, { headers: { 'cache-control': 'no-store' } })
}
