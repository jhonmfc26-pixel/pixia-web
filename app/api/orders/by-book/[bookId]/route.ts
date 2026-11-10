import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

/**
 * Estado del pedido de un álbum, para que el cliente lo vea en /book/<id>:
 * preparando → en impresión → en camino (transportadora + guía) → entregado.
 *
 * Solo el dueño: se valida el token de Supabase y que la orden sea suya.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ bookId: string }> }) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { bookId } = await params
  const { data, error } = await supabaseAdmin
    .from('orders')
    // '*' y no una lista: assets_purged_at (supabase/almacenamiento.sql) puede no existir todavía.
    .select('*')
    .eq('book_id', bookId)
    .eq('payment_status', 'approved')
    .order('paid_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  // Dueño = misma cuenta, o el mismo correo con el que se pagó.
  const owner = data && (data.user_id === user.id || (!!user.email && data.customer_email?.toLowerCase() === user.email.toLowerCase()))
  if (!data || !owner) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  return NextResponse.json({
    order: {
      reference: data.reference,
      print_status: data.print_status ?? 'paid',
      paid_at: data.paid_at,
      printing_at: data.printing_at,
      shipped_at: data.shipped_at,
      delivered_at: data.delivered_at,
      shipping_carrier: data.shipping_carrier,
      tracking_number: data.tracking_number,
      tracking_url: data.tracking_url,
      shipping_city: data.shipping_city,
      // Fotos y PDF borrados por la política de conservación (30 días después de la entrega).
      assets_purged_at: data.assets_purged_at ?? null,
    },
  })
}
