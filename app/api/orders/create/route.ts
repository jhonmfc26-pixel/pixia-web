import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { generateIntegrityHash, calculateOrderTotal, generateOrderReference } from '@/lib/wompi'
import { rateLimit } from '@/core/middleware/rateLimiter'
import { normalizeBook } from '@/core/modules/album/normalizeBook'

export const runtime = 'edge'

interface CreateOrderRequest {
  bookId: string
  bookSnapshot: unknown   // AlbumBlueprint completo
  sessionId?: string
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
  const limited = await rateLimit(req, '/api/orders')
  if (limited) return limited

  // Extraer user_id del JWT si viene — no bloquea si falta o es inválido
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  let userId: string | null = null
  if (token) {
    const { data, error } = await supabaseAdmin.auth.getUser(token)
    if (!error && data?.user) userId = data.user.id
  }

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
        user_id: userId,
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

    // Upsert de seguridad: si el blueprint no fue guardado en el callback
    // (ej. el usuario fue directo al checkout sin magic link previo), lo
    // guardamos aquí con el user_id ya conocido.
    if (userId && body.bookSnapshot) {
      try {
        const blueprint = normalizeBook(body.bookSnapshot, body.bookId)
        console.log('[orders/create] Intentando upsert blueprint con id:', body.bookId, 'userId:', userId)
        console.log('[orders/create] Shape del blueprint normalizado:', {
          id: blueprint.id,
          occasion: blueprint.occasion,
          hasCover: !!blueprint.cover,
          hasSpreads: Array.isArray(blueprint.spreads),
          spreadsCount: blueprint.spreads?.length,
        })
        const { error: bpError } = await supabaseAdmin
          .from('blueprints')
          .upsert({
            id: blueprint.id,
            user_id: userId,
            session_id: body.sessionId ?? blueprint.sessionId ?? '',
            status: blueprint.status ?? 'draft',
            occasion: blueprint.occasion,
            format: blueprint.format,
            style: blueprint.style,
            page_count: blueprint.pageCount,
            cover: blueprint.cover,
            spreads: blueprint.spreads,
            narrative: blueprint.narrative,
            ai_generated: blueprint.aiGenerated ?? false,
            version: blueprint.version ?? 1,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' })
        if (bpError) throw bpError
      } catch (err: unknown) {
        const e = err as { message?: string; code?: string; details?: string; hint?: string; stack?: string }
        console.error('[orders/create] ERROR UPSERT BLUEPRINT:', {
          message: e?.message,
          code: e?.code,
          details: e?.details,
          hint: e?.hint,
          stack: e?.stack?.split('\n').slice(0, 3),
        })
        // No bloquear la orden — el blueprint es valor agregado, no crítico
      }
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
