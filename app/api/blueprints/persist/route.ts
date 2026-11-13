import { isOrdered } from '@/core/modules/album/orderLock'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { AlbumBlueprint } from '@/core/contracts/AlbumBlueprint'

export const runtime = 'edge'

const MAX_BODY_BYTES = 4 * 1024 * 1024

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
  }

  // Un álbum de 100 fotos pesa unos cientos de KB. Más que esto es un álbum
  // con fotos incrustadas (sin subir) o basura: no se guarda.
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'El álbum es demasiado grande para guardarlo' }, { status: 413 })
  }

  let blueprint: AlbumBlueprint
  let sessionId: string
  try {
    const body = await req.json() as { blueprint: AlbumBlueprint; sessionId: string }
    blueprint = body.blueprint
    sessionId = body.sessionId
    if (!blueprint?.id || typeof blueprint.id !== 'string') throw new Error('blueprint.id requerido')
    if (!Array.isArray(blueprint.spreads) || !blueprint.cover || !blueprint.occasion) throw new Error('blueprint incompleto')
  } catch (parseErr) {
    console.error('[persist] Body inválido:', parseErr instanceof Error ? parseErr.message : parseErr)
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  // Ownership: quien llama debe ser dueño del blueprint que intenta
  // escribir. supabaseAdmin bypassa RLS (por diseño, para poder escribir),
  // así que esta comprobación es la ÚNICA barrera contra que un usuario
  // autenticado sobrescriba/tome posesión del álbum de otro conociendo su
  // UUID (viaja en la URL, no es secreto). user_id se toma SIEMPRE del
  // token (user.id) — el body nunca decide de quién es un blueprint.
  const { data: existing, error: ownershipError } = await supabaseAdmin
    .from('blueprints')
    .select('user_id, status')
    .eq('id', blueprint.id)
    .maybeSingle()

  if (ownershipError) {
    console.error('[persist] Error verificando ownership:', ownershipError)
    return NextResponse.json({ error: 'No se pudo verificar el álbum' }, { status: 500 })
  }

  if (existing?.user_id && existing.user_id !== user.id) {
    console.warn('[persist] Intento de escritura sobre blueprint ajeno — solicitante:', user.id)
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  // Pagado = congelado: lo que está en la fila es lo que se imprime.
  if (isOrdered(existing?.status)) {
    return NextResponse.json({ error: 'Este álbum ya fue pedido y no se puede modificar' }, { status: 409 })
  }
  // Sin existing → primer guardado (creación legítima).
  // Con existing.user_id nulo → fila huérfana (nunca reclamada); se permite
  // reclamarla, no habilita nada que no fuera ya posible (nadie más era dueño).

  const insertPayload: Record<string, unknown> = {
    id: blueprint.id,
    user_id: user.id,
    session_id: sessionId,
    // El estado nunca lo decide el navegador: acá solo se guardan borradores
    // (un álbum pedido ya se rechazó arriba). 'ordered' lo pone el webhook.
    status: blueprint.status === 'preview' ? 'preview' : 'draft',
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
    ...(blueprint.structure ? { structure: blueprint.structure } : {}),
  }
  const { error: upsertError } = await supabaseAdmin
    .from('blueprints')
    .upsert(insertPayload, { onConflict: 'id' })

  if (upsertError) {
    console.error('[persist] Error en upsert:', upsertError.message)
    return NextResponse.json({ error: 'No se pudo guardar el álbum' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, blueprintId: blueprint.id })
}
