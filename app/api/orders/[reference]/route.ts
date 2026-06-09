import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'edge'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  try {
    const { reference } = await params

    if (!reference || !reference.startsWith('PIXIA-')) {
      return NextResponse.json({ error: 'Referencia inválida' }, { status: 400 })
    }

    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select(`
        reference,
        customer_name,
        customer_email,
        total_cop,
        pages_total,
        payment_status,
        print_status,
        created_at,
        paid_at
      `)
      .eq('reference', reference)
      .single()

    if (error || !order) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ order })
  } catch (err) {
    console.error('[orders/[reference]] exception:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
