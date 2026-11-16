import { NextRequest, NextResponse } from 'next/server'
import { validateWebhookSignature, fetchTransactionStatus } from '@/lib/wompi'
import { applyVerifiedTransaction } from '@/lib/paymentSync'

export const runtime = 'edge'

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

  // 5. Aplicar al pedido (misma lógica que la página de confirmación y el barrido).
  const result = await applyVerifiedTransaction(verified)
  return NextResponse.json(result.body, { status: result.status })
}
