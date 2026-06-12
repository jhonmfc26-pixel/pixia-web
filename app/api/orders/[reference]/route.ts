import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'edge'

function maskEmail(email: string): string {
  const at = email.indexOf('@')
  if (at < 1) return '***'
  return `${email[0]}***@${email.slice(at + 1)}`
}

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

    return NextResponse.json({
      order: {
        reference: order.reference,
        customer_email_masked: maskEmail(order.customer_email),
        total_cop: order.total_cop,
        pages_total: order.pages_total,
        payment_status: order.payment_status,
        print_status: order.print_status,
        created_at: order.created_at,
        paid_at: order.paid_at,
      },
    })
  } catch (err) {
    console.error('[orders/[reference]] exception:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
