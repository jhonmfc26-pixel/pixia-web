import { TERMS_VERSION } from '@/lib/legal'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { generateIntegrityHash, calculateOrderTotal, generateOrderReference } from '@/lib/wompi'
import { PAGES_INCLUDED } from '@/lib/formats'
import { rateLimit } from '@/core/middleware/rateLimiter'
import { blueprintInsertColumns, matchesWhatClientSaw, resolveOrderAlbum, type StoredBlueprint } from '@/lib/orderAlbum'

export const runtime = 'edge'

interface CreateOrderRequest {
  bookId: string
  bookSnapshot: unknown   // AlbumBlueprint completo (solo se usa si el álbum todavía no está guardado)
  sessionId?: string
  /** Páginas que el checkout le mostró al cliente: tienen que coincidir con las que se cobran. */
  pagesTotal: number
  /** Versión de los términos que el cliente aceptó en el checkout. */
  termsVersion?: string
  /** Páginas que el cliente confirmó cuando su álbum tiene menos de las incluidas. */
  fewerPagesAck?: number
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

  // Sin sesión no hay orden: el álbum tiene que quedar guardado en la cuenta de
  // quien paga (es lo que se imprime). userId sale SIEMPRE del token, nunca del body.
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Inicia sesión para continuar con el pago.' }, { status: 401 })
  const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !auth?.user) {
    return NextResponse.json({ error: 'Tu sesión expiró. Inicia sesión de nuevo para pagar.' }, { status: 401 })
  }
  const userId = auth.user.id

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
    // Aceptación expresa de los términos vigentes (no se cobra sin ella).
    if (body.termsVersion !== TERMS_VERSION) {
      return NextResponse.json({ error: 'Debes aceptar los términos y condiciones vigentes. Recarga la página e inténtalo de nuevo.' }, { status: 400 })
    }

    // El álbum guardado en la cuenta. Falla cerrado: si la consulta revienta no
    // se sigue — mejor un 500 que cobrar sin saber de quién es ni qué contiene.
    const { data: row, error: rowError } = await supabaseAdmin
      .from('blueprints').select('*').eq('id', body.bookId).maybeSingle()
    if (rowError) {
      console.error('[orders/create] Error leyendo el blueprint:', rowError.message)
      return NextResponse.json({ error: 'No se pudo verificar el álbum' }, { status: 500 })
    }

    // El álbum que se cobra se arma en el servidor (ver lib/orderAlbum.ts):
    // dueño, que no esté ya pagado, páginas reales, formato y fotos subidas.
    // Si ya está guardado manda la fila; lo que envía el navegador solo sirve
    // para un álbum que todavía no se guardó nunca.
    const album = resolveOrderAlbum({ row: row as StoredBlueprint | null, snapshot: body.bookSnapshot, bookId: body.bookId, userId })
    if (!album.ok) {
      if (album.status === 403) console.warn('[orders/create] Intento de crear orden sobre blueprint ajeno — solicitante:', userId)
      return NextResponse.json({ error: album.error }, { status: album.status })
    }
    const { snapshot, pages: realPageCount, format: albumFormat } = album

    // Lo que el cliente vio en el checkout es lo que se cobra. Si el álbum
    // cambió desde que abrió la página (otra pestaña), que la recargue.
    const clientFormat = (body.bookSnapshot as { format?: unknown } | null)?.format
    if (!matchesWhatClientSaw(album, { pagesTotal: body.pagesTotal, format: clientFormat })) {
      return NextResponse.json({ error: 'Tu álbum cambió desde que abriste esta página. Recárgala para ver el precio actualizado.' }, { status: 409 })
    }
    // Menos páginas de las incluidas: el precio es el mismo y el cliente tuvo
    // que confirmarlo en el checkout con ESTE número de páginas.
    if (realPageCount < PAGES_INCLUDED && body.fewerPagesAck !== realPageCount) {
      return NextResponse.json({ error: `Confirma que tu álbum tiene ${realPageCount} páginas antes de pagar. Recarga la página si cambiaste el álbum.` }, { status: 400 })
    }
    const pricing = calculateOrderTotal(realPageCount, albumFormat.id)

    // Primero el álbum, después la orden: una orden sin álbum guardado no se
    // puede imprimir. Si esto falla no se crea nada y el cliente no paga.
    //  - Álbum nuevo: se guarda completo, a nombre de quien paga.
    //  - Álbum sin dueño: se reescribe con esta copia y pasa a ser de quien paga.
    //  - Álbum ya guardado en su cuenta: NO se reescribe su contenido; solo se
    //    fija la estructura cobrada (por si faltaba o era inválida).
    const now = new Date().toISOString()
    const columns = blueprintInsertColumns(snapshot, { userId, sessionId: body.sessionId ?? '' })
    const blueprints = supabaseAdmin.from('blueprints')
    const write =
      album.save === 'create' ? await blueprints.insert({ ...columns, updated_at: now })
      : album.save === 'claim' ? await blueprints.update({ ...columns, updated_at: now }).eq('id', body.bookId).is('user_id', null)
      : await blueprints.update({ structure: snapshot.structure, updated_at: now }).eq('id', body.bookId).eq('user_id', userId)
    if (write.error) {
      console.error('[orders/create] No se pudo guardar el álbum:', write.error.message)
      return NextResponse.json({ error: 'No pudimos guardar tu álbum. Inténtalo de nuevo en un momento.' }, { status: 500 })
    }

    const reference = generateOrderReference(body.bookId)

    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .insert({
        reference,
        book_id: body.bookId,
        // La copia exacta que se cobró, armada en el servidor. Al aprobarse el
        // pago el álbum se congela con ella (webhook → frozenBlueprintColumns).
        book_snapshot: snapshot,
        user_id: userId,
        customer_email: body.customer.email,
        customer_phone: body.customer.phone,
        customer_name: body.customer.name,
        shipping_address: body.shipping.address,
        shipping_city: body.shipping.city,
        shipping_state: body.shipping.state,
        shipping_postal_code: body.shipping.postalCode || null,
        shipping_notes: body.shipping.notes || null,
        // Constancia de la aceptación (supabase/orders_terminos.sql).
        terms_version: TERMS_VERSION,
        terms_accepted_at: new Date().toISOString(),
        terms_accepted_ip: req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        base_price_cop: pricing.basePriceCop,
        pages_included: pricing.pagesIncluded,
        pages_total: realPageCount,
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
