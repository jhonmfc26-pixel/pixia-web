/**
 * Acceso a pqr_tickets (solo servidor, service role). Ver supabase/pqr.sql.
 */
import { supabaseAdmin } from '@/lib/supabase'
import { formatDateEs } from '@/lib/businessDays'
import {
  PQR_TYPES, formatBogotaDateTime, generateRadicado, pqrDeadline,
  type PqrInput, type PqrStatus, type PqrType,
} from '@/lib/pqr'
import { sendPqrReceivedEmails, sendPqrResponseEmail, type PqrEmailData } from '@/lib/email'

export interface PqrRow {
  id: string
  radicado: string
  type: PqrType
  status: PqrStatus
  name: string
  email: string
  phone: string | null
  order_reference: string | null
  message: string
  user_id: string | null
  due_date: string
  response: string | null
  responded_at: string | null
  internal_notes: string | null
  created_at: string
  updated_at: string
}

const dueLabel = (due: string) => formatDateEs(new Date(`${due}T00:00:00Z`))

function emailData(row: PqrRow): PqrEmailData {
  return {
    radicado: row.radicado,
    name: row.name,
    email: row.email,
    typeLabel: PQR_TYPES[row.type]?.label ?? row.type,
    createdAtLabel: formatBogotaDateTime(row.created_at),
    dueDateLabel: dueLabel(row.due_date),
    message: row.message,
    response: row.response,
  }
}

/** Radica la solicitud y envía la constancia. Reintenta si el radicado choca (improbable). */
export async function createPqr(input: PqrInput, meta: { userId: string | null; ip: string | null }) {
  const now = new Date()
  const due = pqrDeadline(input.type, now).toISOString().slice(0, 10)
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabaseAdmin
      .from('pqr_tickets')
      .insert({
        radicado: generateRadicado(now),
        type: input.type,
        name: input.name,
        email: input.email,
        phone: input.phone,
        order_reference: input.orderReference,
        message: input.message,
        user_id: meta.userId,
        ip: meta.ip,
        due_date: due,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select('*')
      .single()
    if (error?.code === '23505') continue // radicado repetido → otro código
    if (error || !data) throw new Error(error?.message ?? 'No se pudo radicar')
    const row = data as PqrRow
    const sent = await sendPqrReceivedEmails(emailData(row))
    return { row, emailed: sent.ok, createdAtLabel: formatBogotaDateTime(row.created_at), dueDateLabel: dueLabel(row.due_date) }
  }
  throw new Error('No se pudo generar un radicado único')
}

/** Seguimiento público: hay que conocer el radicado Y el correo. */
export async function findPqrForCustomer(radicado: string, email: string) {
  const { data, error } = await supabaseAdmin
    .from('pqr_tickets')
    .select('radicado, type, status, email, created_at, due_date, response, responded_at')
    .eq('radicado', radicado)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data || data.email.toLowerCase() !== email.toLowerCase()) return null
  return {
    radicado: data.radicado as string,
    typeLabel: PQR_TYPES[data.type as PqrType]?.label ?? data.type,
    status: data.status as PqrStatus,
    createdAtLabel: formatBogotaDateTime(data.created_at),
    dueDateLabel: dueLabel(data.due_date),
    response: data.status === 'respondido' ? (data.response as string | null) : null,
    respondedAtLabel: data.responded_at ? formatBogotaDateTime(data.responded_at) : null,
  }
}

export async function listPqr(): Promise<PqrRow[]> {
  const { data, error } = await supabaseAdmin
    .from('pqr_tickets').select('*').order('created_at', { ascending: false }).limit(300)
  if (error) throw new Error(error.message)
  return (data ?? []) as PqrRow[]
}

export async function getPqr(radicado: string): Promise<PqrRow | null> {
  const { data, error } = await supabaseAdmin.from('pqr_tickets').select('*').eq('radicado', radicado).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as PqrRow) ?? null
}

/**
 * Actualiza estado/notas y, si se marca "respondido" con respuesta, la envía
 * al cliente. Una respuesta ya enviada no se reemplaza (queda como constancia).
 */
export async function updatePqr(
  radicado: string,
  patch: { status: PqrStatus; response: string; internalNotes: string; notify: boolean },
): Promise<{ ok: true; emailed: boolean; emailError?: string } | { ok: false; error: string }> {
  const row = await getPqr(radicado)
  if (!row) return { ok: false, error: 'Radicado no encontrado' }
  if (row.status === 'respondido' && patch.status !== 'respondido') {
    return { ok: false, error: 'Ya fue respondido: no se puede reabrir (crea uno nuevo si el cliente vuelve a escribir).' }
  }

  const updates: Record<string, unknown> = { status: patch.status, internal_notes: patch.internalNotes || null, updated_at: new Date().toISOString() }
  const answering = patch.status === 'respondido' && row.status !== 'respondido'
  if (answering) {
    const response = patch.response.trim()
    if (response.length < 10) return { ok: false, error: 'Escribe la respuesta para el cliente (mínimo 10 caracteres).' }
    updates.response = response
    updates.responded_at = new Date().toISOString()
  }

  const { error } = await supabaseAdmin.from('pqr_tickets').update(updates).eq('radicado', radicado)
  if (error) return { ok: false, error: error.message }

  if (!answering || !patch.notify) return { ok: true, emailed: false }
  const sent = await sendPqrResponseEmail(emailData({ ...row, response: updates.response as string }))
  return sent.ok ? { ok: true, emailed: true } : { ok: true, emailed: false, emailError: sent.error }
}
