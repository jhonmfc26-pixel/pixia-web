/**
 * Aplicar a un pedido el estado de su pago en Wompi.
 *
 * Hay tres caminos por los que Pixia se entera de un pago, y los tres pasan
 * por aquí, con la misma lógica y las mismas protecciones:
 *  1. El aviso (webhook) de Wompi — app/api/orders/webhook.
 *  2. La página de confirmación, cuando el cliente vuelve de pagar
 *     (POST /api/orders/<referencia>).
 *  3. El barrido del contenedor de PDF, que revisa pedidos que se quedaron
 *     «pendientes» (por si el aviso de Wompi nunca llegó).
 *
 * La transacción siempre se lee de la API de Wompi con la llave privada: lo
 * que mande el navegador o el aviso nunca se toma como cierto.
 */
import { formatOfBook } from '@/lib/formats'
import { supabaseAdmin } from '@/lib/supabase'
import { fetchTransactionStatus, findTransactionByReference, type WompiTransactionStatus } from '@/lib/wompi'
import { sendOrderConfirmation, sendTeamAlert } from '@/lib/email'
import { enqueuePdfJob } from '@/lib/pdfQueue'
import { frozenBlueprintColumns } from '@/lib/orderAlbum'
import { isOrdered } from '@/core/modules/album/orderLock'

export function mapWompiStatus(wompiStatus: string): string {
  const map: Record<string, string> = {
    APPROVED: 'approved',
    DECLINED: 'declined',
    VOIDED: 'voided',
    ERROR: 'error',
    PENDING: 'pending',
  }
  return map[wompiStatus] || 'error'
}

/** Resultado con la forma de una respuesta HTTP (el webhook la devuelve tal cual a Wompi). */
export interface PaymentResult {
  status: number
  body: Record<string, unknown>
}
const reply = (body: Record<string, unknown>, init: { status: number }): PaymentResult => ({ status: init.status, body })

/**
 * Aplica una transacción YA LEÍDA DE LA API DE WOMPI al pedido de su referencia.
 * Idempotente: se puede llamar las veces que sea (reintentos de Wompi, la
 * página de confirmación y el barrido a la vez) sin duplicar correos ni PDF.
 */
export async function applyVerifiedTransaction(verified: WompiTransactionStatus): Promise<PaymentResult> {
  // 5. Buscar la orden en DB
  const { data: existingOrder, error: findError } = await supabaseAdmin
    .from('orders')
    .select('id, reference, payment_status, total_cop, book_id')
    .eq('reference', verified.reference)
    .single()

  if (findError || !existingOrder) {
    console.error('[pago] Orden no encontrada:', verified.reference, findError)
    // 200 para evitar reintentos infinitos de Wompi
    return reply({ received: true, warning: 'Orden no encontrada' }, { status: 200 })
  }

  // 6. Validar monto (defensa contra tampering)
  const expectedCents = existingOrder.total_cop * 100
  if (verified.amount_in_cents !== expectedCents) {
    console.error('[pago] Monto mismatch:', {
      payload: verified.amount_in_cents,
      expected: expectedCents,
    })
    return reply({ error: 'Monto mismatch' }, { status: 400 })
  }

  // 7. Idempotencia: no actualizar si ya está en el estado final
  const newStatus = mapWompiStatus(verified.status)
  if (existingOrder.payment_status === newStatus) {
    // Reintento sobre una orden ya aprobada: si la vez anterior no se pudo
    // congelar el álbum o encolar el PDF (por eso respondimos 500 y Wompi
    // reintenta), este es el momento de recuperarlo. Nunca pisa lo ya hecho.
    if (newStatus === 'approved' && existingOrder.book_id) {
      const ready = await prepareForPrint(existingOrder.book_id, verified.reference, { firstTime: false })
      if (!ready) return reply({ error: 'No se pudo preparar el pedido para imprimir' }, { status: 500 })
    }
    console.log('[pago] Orden ya está en estado', newStatus, '- skip')
    return reply({ received: true, status: 'already-processed' }, { status: 200 })
  }

  // Un pago aprobado no retrocede: solo puede pasar a anulado (reembolso).
  if (existingOrder.payment_status === 'approved' && newStatus !== 'voided') {
    console.warn('[pago] Orden aprobada, se ignora el cambio a', newStatus, '-', verified.reference)
    return reply({ received: true, status: 'already-approved' }, { status: 200 })
  }

  // 8. Actualizar orden — solo si sigue en el estado que leímos. Si dos avisos
  // del mismo pago llegan a la vez, uno solo pasa de acá: el otro no vuelve a
  // encolar el PDF ni a mandar el correo.
  const updates: Record<string, unknown> = {
    payment_status: newStatus,
    wompi_transaction_id: verified.id,
    wompi_payment_method: verified.payment_method_type || null,
  }

  if (newStatus === 'approved') {
    updates.paid_at = new Date().toISOString()
    updates.print_status = 'paid'
  }

  const { data: changed, error: updateError } = await supabaseAdmin
    .from('orders')
    .update(updates)
    .eq('reference', verified.reference)
    .eq('payment_status', existingOrder.payment_status)
    .select('id')

  if (updateError) {
    console.error('[pago] Error actualizando orden:', updateError)
    return reply({ error: 'Error en DB' }, { status: 500 })
  }
  if (!changed || changed.length === 0) {
    console.log('[pago] Otro aviso ya procesó esta orden - skip:', verified.reference)
    return reply({ received: true, status: 'already-processed' }, { status: 200 })
  }

  console.log('[pago] Orden actualizada:', verified.reference, '→', newStatus)

  // Pago que estaba aprobado y Wompi anuló (reembolso): que nadie lo mande a imprimir.
  if (existingOrder.payment_status === 'approved' && newStatus === 'voided') {
    await sendTeamAlert(`Pago anulado · ${verified.reference}`, [
      `Wompi anuló el pago del pedido ${verified.reference}, que ya estaba aprobado.`,
      'Si todavía no se imprimió, no lo envíes a la imprenta.',
    ])
  }

  // Pago aprobado: congelar el álbum y encolar su PDF. Solo encola — la
  // generación la hace el barrido del contenedor (POST /process-pending). Si
  // algo de esto falla, igual mandamos el email (el pago es real) pero
  // respondemos 500 para que Wompi reintente y el bloque de idempotencia de
  // arriba lo recupere. El barrido además reconcilia órdenes aprobadas sin job.
  let prepareFailed = false
  if (newStatus === 'approved') {
    if (!existingOrder.book_id) {
      console.error('[pago] Orden aprobada SIN book_id — no se puede generar PDF:', verified.reference)
    } else {
      prepareFailed = !(await prepareForPrint(existingOrder.book_id, verified.reference, { firstTime: true }))
    }
  }

  if (newStatus === 'approved') {
    const { data: fullOrder } = await supabaseAdmin
      .from('orders')
      .select('reference, customer_name, customer_email, total_cop, pages_total, shipping_address, shipping_city, shipping_state, album_format:book_snapshot->>format')
      .eq('reference', verified.reference)
      .single()

    if (fullOrder) {
      try {
        // AWAIT: en Cloudflare Workers el dispatch-and-forget no funciona,
        // el worker termina antes de que la promise resuelva
        await sendOrderConfirmation({
          reference: fullOrder.reference,
          customerName: fullOrder.customer_name,
          customerEmail: fullOrder.customer_email,
          totalCop: fullOrder.total_cop,
          pagesTotal: fullOrder.pages_total,
          formatLabel: `${formatOfBook(fullOrder.album_format).name} ${formatOfBook(fullOrder.album_format).sizeLabel}`,
          shippingAddress: fullOrder.shipping_address,
          shippingCity: fullOrder.shipping_city,
          shippingState: fullOrder.shipping_state,
        })
      } catch (err) {
        // Si el email falla, lo loggeamos pero NO afectamos el éxito del webhook.
        // El pago YA fue procesado, la orden YA está aprobada en DB.
        console.error('[pago] Email falló (no afecta orden):', err)
      }
    } else {
      console.warn('[pago] No se pudo cargar orden para email:', verified.reference)
    }
  }

  if (prepareFailed) {
    return reply({ error: 'Orden aprobada pero no se pudo preparar para imprimir' }, { status: 500 })
  }

  return reply({ received: true, status: newStatus }, { status: 200 })
}

/** Formato de los ids de transacción de Wompi (p. ej. 1234-1610641025-49201). */
const TRANSACTION_ID = /^[A-Za-z0-9-]{1,64}$/

export type SyncOutcome =
  | 'sin-pedido'          // la referencia no existe
  | 'ya-resuelto'         // el pedido ya no estaba pendiente: no se consulta a Wompi
  | 'sin-transaccion'     // Wompi todavía no tiene una transacción para esta referencia
  | 'no-se-pudo-consultar'// Wompi no respondió o la transacción no corresponde
  | 'actualizado'         // se aplicó lo que dice Wompi (puede seguir pendiente)

/**
 * Pregunta a Wompi por el pago de un pedido que sigue «pendiente» y aplica lo
 * que responda. `transactionId` es el que Wompi pone en la URL de regreso
 * (?id=…); si no se tiene, se busca la transacción por la referencia.
 *
 * Seguro de exponer al público: solo consulta a Wompi con la llave privada y
 * aplica lo que Wompi diga sobre ESA referencia. Un id de transacción de otro
 * pedido se descarta.
 */
export async function syncOrderWithWompi(reference: string, transactionId?: string | null): Promise<SyncOutcome> {
  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('payment_status, created_at, wompi_transaction_id')
    .eq('reference', reference)
    .maybeSingle()
  if (error) {
    console.error('[pago] No se pudo leer el pedido', reference, '-', error.message)
    return 'no-se-pudo-consultar'
  }
  if (!order) return 'sin-pedido'
  if (order.payment_status !== 'pending') return 'ya-resuelto'

  const knownId = [transactionId, order.wompi_transaction_id].find((id): id is string => typeof id === 'string' && TRANSACTION_ID.test(id))
  const tx = knownId
    ? await fetchTransactionStatus(knownId)
    : await findTransactionByReference(reference)
  if (tx === undefined) return 'sin-transaccion'
  if (!tx) return 'no-se-pudo-consultar'
  if (tx.reference !== reference) {
    console.warn('[pago] La transacción', tx.id, 'es de otra referencia:', tx.reference, '≠', reference)
    return 'no-se-pudo-consultar'
  }

  const result = await applyVerifiedTransaction(tx)
  if (result.status >= 400) {
    console.error('[pago] No se pudo aplicar la transacción', tx.id, 'a', reference, '-', result.body)
    return 'no-se-pudo-consultar'
  }
  // Sigue pendiente (PSE en curso): se guarda el id para la próxima consulta.
  if (tx.status === 'PENDING' && !order.wompi_transaction_id) {
    await supabaseAdmin.from('orders').update({ wompi_transaction_id: tx.id }).eq('reference', reference).eq('payment_status', 'pending')
  }
  return 'actualizado'
}

/**
 * Deja listo para imprimir el álbum de un pedido recién aprobado: lo congela
 * con la copia que se cobró y encola su PDF. Se puede llamar varias veces (los
 * reintentos de Wompi): nunca repite ni pisa lo que ya quedó hecho.
 *
 * Devuelve false si algo falló y hay que reintentar.
 */
async function prepareForPrint(bookId: string, reference: string, opts: { firstTime: boolean }): Promise<boolean> {
  // ¿Hay otro pedido pagado ANTES de este mismo álbum? Entonces este es un
  // pago doble: el álbum y su PDF son los del primero y no se tocan; se avisa
  // al equipo para devolver la plata.
  const { data: paidOrders, error: paidError } = await supabaseAdmin
    .from('orders')
    .select('reference')
    .eq('book_id', bookId)
    .eq('payment_status', 'approved')
    .order('paid_at', { ascending: true })
    .limit(1)
  if (paidError) {
    console.error('[pago] No se pudieron leer los pedidos del álbum', bookId, '-', paidError.message)
    return false
  }
  const first = paidOrders?.[0]?.reference
  if (first && first !== reference) {
    console.error('[pago] PAGO DOBLE del álbum', bookId, '-', reference, 'y', first)
    if (opts.firstTime) {
      await sendTeamAlert(`Pago doble del mismo álbum · ${reference}`, [
        `El álbum ${bookId} ya tenía un pedido pagado (${first}) y entró otro pago: ${reference}.`,
        'Se imprime una sola vez (el primer pedido). Revisa en /admin y devuelve el segundo pago desde Wompi.',
      ])
    }
    return true
  }

  if (!(await freezeBlueprint(bookId, reference))) return false

  const queued = await enqueuePdfJob({ blueprintId: bookId, orderReference: reference, overwrite: opts.firstTime })
  if (!queued.ok) {
    console.error('[pago] No se pudo encolar el PDF:', reference, queued.error)
    return false
  }
  if (queued.enqueued) console.log('[pago] PDF encolado:', reference)
  return true
}

/**
 * Pagado = congelado, con la copia exacta que se cobró (orders.book_snapshot,
 * armada en el servidor al crear la orden — ver lib/orderAlbum.ts). Si el
 * cliente editó el álbum entre crear la orden y pagar, acá vuelve a lo que
 * pagó: nunca se imprimen más páginas ni otro tamaño que los cobrados.
 *
 * Un álbum que ya está congelado no se vuelve a tocar. Devuelve false si no
 * se pudo congelar (la orden igual quedó aprobada; Wompi reintenta).
 */
async function freezeBlueprint(bookId: string, reference: string): Promise<boolean> {
  try {
    const { data: current, error: readError } = await supabaseAdmin
      .from('blueprints').select('status').eq('id', bookId).maybeSingle()
    if (readError) throw new Error(readError.message)
    if (!current) throw new Error('el álbum no existe')
    if (isOrdered(current.status)) return true

    const { data: paid, error: orderError } = await supabaseAdmin
      .from('orders').select('book_snapshot').eq('reference', reference).single()
    if (orderError) throw new Error(orderError.message)
    const frozen = frozenBlueprintColumns(paid?.book_snapshot)
    if (!frozen) console.warn('[pago] Orden sin copia del álbum cobrado, solo se marca el estado:', reference)
    const { error } = await supabaseAdmin
      .from('blueprints')
      .update({ ...(frozen ?? {}), status: 'ordered', updated_at: new Date().toISOString() })
      .eq('id', bookId)
    if (error) throw new Error(error.message)
    return true
  } catch (err) {
    console.error('[pago] No se pudo congelar el álbum', bookId, '-', err)
    return false
  }
}
