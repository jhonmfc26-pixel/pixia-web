import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { validateWebhookSignature, fetchTransactionStatus } from '@/lib/wompi'
import { sendOrderConfirmation } from '@/lib/email'

export const runtime = 'edge'

function mapWompiStatus(wompiStatus: string): string {
  const map: Record<string, string> = {
    APPROVED: 'approved',
    DECLINED: 'declined',
    VOIDED: 'voided',
    ERROR: 'error',
    PENDING: 'pending',
  }
  return map[wompiStatus] || 'error'
}

export async function POST(req: NextRequest) {
  let payload: {
    event?: string
    data?: { transaction?: {
      id?: string
      reference?: string
      status?: string
      amount_in_cents?: number
      payment_method_type?: string
      finalized_at?: string
    } }
    timestamp?: number
    signature?: { checksum?: string; properties?: string[] }
    environment?: string
  }

  try {
    payload = await req.json()
  } catch (err) {
    console.error('[webhook] Payload inválido:', err)
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  // 1. Validar firma HMAC
  const isValid = await validateWebhookSignature({
    signature: payload.signature,
    timestamp: payload.timestamp,
    data: payload.data as Record<string, unknown> | undefined,
  })

  if (!isValid) {
    console.error('[webhook] Firma inválida - posible webhook falso')
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
  }

  // 2. Solo procesar transaction.updated
  if (payload.event !== 'transaction.updated') {
    console.log('[webhook] Evento ignorado:', payload.event)
    return NextResponse.json({ received: true }, { status: 200 })
  }

  const transaction = payload.data?.transaction
  if (!transaction?.reference || !transaction?.id || !transaction?.status) {
    console.error('[webhook] Datos de transacción incompletos')
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
  }

  // 3. Verificar status real con la API de Wompi (defense in depth)
  const verified = await fetchTransactionStatus(transaction.id)
  if (!verified) {
    console.error('[webhook] No se pudo verificar transacción con Wompi:', transaction.id)
    return NextResponse.json({ error: 'No se pudo verificar' }, { status: 502 })
  }

  // 4. Validar que el reference coincide
  if (verified.reference !== transaction.reference) {
    console.error('[webhook] Reference mismatch:', {
      payload: transaction.reference,
      api: verified.reference,
    })
    return NextResponse.json({ error: 'Reference mismatch' }, { status: 400 })
  }

  // 5. Buscar la orden en DB
  const { data: existingOrder, error: findError } = await supabaseAdmin
    .from('orders')
    .select('id, reference, payment_status, total_cop')
    .eq('reference', verified.reference)
    .single()

  if (findError || !existingOrder) {
    console.error('[webhook] Orden no encontrada:', verified.reference, findError)
    // 200 para evitar reintentos infinitos de Wompi
    return NextResponse.json({ received: true, warning: 'Orden no encontrada' }, { status: 200 })
  }

  // 6. Validar monto (defensa contra tampering)
  const expectedCents = existingOrder.total_cop * 100
  if (verified.amount_in_cents !== expectedCents) {
    console.error('[webhook] Monto mismatch:', {
      payload: verified.amount_in_cents,
      expected: expectedCents,
    })
    return NextResponse.json({ error: 'Monto mismatch' }, { status: 400 })
  }

  // 7. Idempotencia: no actualizar si ya está en el estado final
  const newStatus = mapWompiStatus(verified.status)
  if (existingOrder.payment_status === newStatus) {
    console.log('[webhook] Orden ya está en estado', newStatus, '- skip')
    return NextResponse.json({ received: true, status: 'already-processed' }, { status: 200 })
  }

  // 8. Actualizar orden
  const updates: Record<string, unknown> = {
    payment_status: newStatus,
    wompi_transaction_id: verified.id,
    wompi_payment_method: verified.payment_method_type || null,
  }

  if (newStatus === 'approved') {
    updates.paid_at = new Date().toISOString()
    updates.print_status = 'paid'
  }

  const { error: updateError } = await supabaseAdmin
    .from('orders')
    .update(updates)
    .eq('reference', verified.reference)

  if (updateError) {
    console.error('[webhook] Error actualizando orden:', updateError)
    return NextResponse.json({ error: 'Error en DB' }, { status: 500 })
  }

  console.log('[webhook] Orden actualizada:', verified.reference, '→', newStatus)

  // Enviar email de confirmación (no bloqueante - si falla no afecta el pago)
  if (newStatus === 'approved') {
    const { data: fullOrder } = await supabaseAdmin
      .from('orders')
      .select('reference, customer_name, customer_email, total_cop, pages_total, shipping_address, shipping_city, shipping_state')
      .eq('reference', verified.reference)
      .single()

    if (fullOrder) {
      sendOrderConfirmation({
        reference: fullOrder.reference,
        customerName: fullOrder.customer_name,
        customerEmail: fullOrder.customer_email,
        totalCop: fullOrder.total_cop,
        pagesTotal: fullOrder.pages_total,
        shippingAddress: fullOrder.shipping_address,
        shippingCity: fullOrder.shipping_city,
        shippingState: fullOrder.shipping_state,
      }).catch(err => {
        console.error('[webhook] Email falló (no afecta orden):', err)
      })
    }
  }

  return NextResponse.json({ received: true, status: newStatus }, { status: 200 })
}
