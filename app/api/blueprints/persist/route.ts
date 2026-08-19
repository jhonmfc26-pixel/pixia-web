import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { AlbumBlueprint } from '@/core/contracts/AlbumBlueprint'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  console.log('[persist] token recibido:', token?.slice(0, 20))
  if (!token) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  console.log('[persist] userId:', user?.id ?? null, 'authError:', authError?.message ?? null)
  if (authError || !user) {
    return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
  }

  let blueprint: AlbumBlueprint
  let sessionId: string
  try {
    const body = await req.json() as { blueprint: AlbumBlueprint; sessionId: string }
    console.log('[persist] body keys:', Object.keys(body))
    blueprint = body.blueprint
    sessionId = body.sessionId
    console.log('[persist] blueprint.id:', blueprint?.id, 'sessionId:', sessionId)
    if (!blueprint?.id) throw new Error('blueprint.id requerido')
  } catch (parseErr) {
    console.error('[persist] Error parseando body:', parseErr)
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const insertPayload: Record<string, unknown> = {
    id: blueprint.id,
    user_id: user.id,
    session_id: sessionId,
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
    // TODO: requiere columna `structure JSONB` en la tabla blueprints de Supabase.
    // Si la columna no existe, el upsert falla — el llamador (auth/callback) captura el error.
    ...(blueprint.structure ? { structure: blueprint.structure } : {}),
  }
  console.log('[persist] payload (primeros 500 chars):', JSON.stringify(insertPayload).slice(0, 500))

  const { error: upsertError } = await supabaseAdmin
    .from('blueprints')
    .upsert(insertPayload, { onConflict: 'id' })

  if (upsertError) {
    console.error('[persist] ERROR COMPLETO upsert:', upsertError)
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, blueprintId: blueprint.id })
}
