import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { generateIntegrityHash, calculateOrderTotal, generateOrderReference } from '@/lib/wompi'

export const runtime = 'edge'

interface CreateOrderRequest {
  bookId: string
  bookSnapshot: unknown   // AlbumBlueprint completo
  pagesTotal: number
  customer: {
    email: string
    phone: string
    name: string
  }
  shipping: {
    address: string
    city: string
    state: string
    postalCode?: string
    notes?: string
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateOrderRequest

    if (!body.bookId || !body.bookSnapshot || !body.pagesTotal) {
      return NextResponse.json({ error: 'Datos del libro incompletos' }, { status: 400 })
    }
    if (!body.customer?.email || !body.customer?.phone || !body.customer?.name) {
      return NextResponse.json({ error: 'Datos del cliente incompletos' }, { status: 400 })
    }
    if (!body.shipping?.address || !body.shipping?.city || !body.shipping?.state) {
      return NextResponse.json({ error: 'Dirección incompleta' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.customer.email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    // Calcular precio en el servidor (NO confiar en cliente)
    const pricing = calculateOrderTotal(body.pagesTotal)

    const reference = generateOrderReference(body.bookId)

    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .insert({
        reference,
        book_id: body.bookId,
        book_snapshot: body.bookSnapshot,
        customer_email: body.customer.email,
        customer_phone: body.customer.phone,
        customer_name: body.customer.name,
        shipping_address: body.shipping.address,
        shipping_city: body.shipping.city,
        shipping_state: body.shipping.state,
        shipping_postal_code: body.shipping.postalCode || null,
        shipping_notes: body.shipping.notes || null,
        base_price_cop: pricing.basePriceCop,
        pages_included: pricing.pagesIncluded,
        pages_total: body.pagesTotal,
        extra_pages_price_cop: pricing.extraPagesPriceCop,
        shipping_cop: pricing.shippingCop,
        total_cop: pricing.totalCop,
        payment_status: 'pending',
      })
      .select('id, reference, total_cop')
      .single()

    if (error || !order) {
      console.error('[orders/create] DB error:', error)
      return NextResponse.json({ error: 'No se pudo crear la orden' }, { status: 500 })
    }

    // Wompi requiere el monto en centavos
    const amountInCents = order.total_cop * 100

    const integrityHash = await generateIntegrityHash(reference, amountInCents, 'COP')

    return NextResponse.json({
      reference,
      orderId: order.id,
      amountInCents,
      currency: 'COP',
      publicKey: process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY,
      integrityHash,
      pricing,
    })
  } catch (err) {
    console.error('[orders/create] exception:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
