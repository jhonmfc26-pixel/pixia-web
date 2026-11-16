import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { formatOfBook } from '@/lib/formats'
import { syncOrderWithWompi } from '@/lib/paymentSync'
import { rateLimit } from '@/core/middleware/rateLimiter'

export const runtime = 'edge'

function maskEmail(email: string): string {
  const at = email.indexOf('@')
  if (at < 1) return '***'
  return `${email[0]}***@${email.slice(at + 1)}`
}

const REFERENCE = /^PIXIA-[A-Z0-9]{1,16}-\d{10,16}$/

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  try {
    const { reference } = await params
    if (!REFERENCE.test(reference ?? '')) {
      return NextResponse.json({ error: 'Referencia inválida' }, { status: 400 })
    }
    return await publicOrder(reference)
  } catch (err) {
    console.error('[orders/[reference]] exception:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * POST: «¿ya se confirmó mi pago?». Si el pedido sigue pendiente, se le
 * pregunta a Wompi y se aplica lo que responda; después devuelve lo mismo que
 * el GET. Lo usan la página de confirmación (con el ?id= que Wompi pone al
 * volver de pagar) y el barrido del contenedor, para que un pago no dependa
 * solo de que llegue el aviso de Wompi.
 *
 * Body opcional: { transactionId }.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  const limited = await rateLimit(req, '/api/orders/verify')
  if (limited) return limited
  try {
    const { reference } = await params
    if (!REFERENCE.test(reference ?? '')) {
      return NextResponse.json({ error: 'Referencia inválida' }, { status: 400 })
    }
    const body = await req.json().catch(() => ({})) as { transactionId?: unknown }
    const transactionId = typeof body?.transactionId === 'string' ? body.transactionId : null
    const outcome = await syncOrderWithWompi(reference, transactionId)
    if (outcome === 'sin-pedido') return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    const res = await publicOrder(reference)
    res.headers.set('X-Pixia-Sync', outcome)
    return res
  } catch (err) {
    console.error('[orders/[reference]] POST exception:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

async function publicOrder(reference: string): Promise<NextResponse> {
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
      paid_at,
      book_id,
      album_format:book_snapshot->>format
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
      // Para el botón "Ver mi álbum". El álbum en sí sigue protegido: solo
      // lo abre su dueño con sesión (RLS de blueprints).
      book_id: order.book_id,
      // Solo el tamaño, no el álbum: "Álbum pequeño 20 × 20 cm" en la confirmación.
      format_label: `${formatOfBook(order.album_format).name} ${formatOfBook(order.album_format).sizeLabel}`,
    },
  })
}
