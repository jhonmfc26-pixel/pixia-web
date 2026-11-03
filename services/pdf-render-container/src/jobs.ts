import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Estado del job de generación de PDF, en pdf_generation_jobs (ver
 * supabase/pdf_jobs.sql) — MISMA tabla que usa el Worker CF (coexisten
 * mientras se valida este contenedor, ver ticket de migración). El
 * contenedor genera el interior en UNA sola pasada (sin sección/merge), así
 * que usa interior_path (un solo archivo) — los campos de progreso por
 * lotes (interior_pages_done, interior_merge_batches_done,
 * interior_sections) son del flujo del Worker CF, el contenedor no los toca.
 */
export interface QueueJob {
  blueprint_id: string
  order_reference: string | null
  status: string
  attempt_count: number
  error_message: string | null
  claimed_at: string | null
}

export interface OrderRef {
  reference: string
  book_id: string
}

/**
 * Órdenes aprobadas sin job. Un álbum con job de OTRA orden no se toca (no
 * pisamos un job ajeno en curso); uno con job sin orden (prueba de la ruta
 * dev) sí se encola, porque esa prueba no es el PDF de la orden pagada.
 */
export function findOrdersMissingJob(orders: OrderRef[], jobByBook: Map<string, string | null>): OrderRef[] {
  return orders.filter((o) => {
    if (!jobByBook.has(o.book_id)) return true
    return jobByBook.get(o.book_id) == null
  })
}

export function createJobsClient(supabaseUrl: string, serviceRoleKey: string) {
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  return new JobsClient(supabase)
}

export class JobsClient {
  constructor(private supabase: SupabaseClient) {}

  /**
   * supabase-js no lanza excepciones por sí solo — devuelve { error } y sigue
   * corriendo. Un upsert/update contra una columna que todavía no existe en
   * la tabla real (pasó con pdf_engine: la migración pdf_jobs_engine.sql
   * nunca se había corrido) fallaba en silencio, sin log — así se disparó un
   * incidente real donde el Worker CF reprocesaba un job de este contenedor
   * en loop por días porque nunca vio el motor correcto. Logueamos cualquier
   * error acá para que esto sea visible la próxima vez.
   */
  private logIfError(op: string, error: { message: string } | null) {
    if (error) console.error(`[pdf-render-container] Supabase ${op} falló:`, error.message)
  }

  async startInteriorJob(blueprintId: string) {
    const { error } = await this.supabase.from('pdf_generation_jobs').upsert(
      { blueprint_id: blueprintId, status: 'generando_pdf', interior_path: null, pdf_engine: 'container', error_message: null, attempt_count: 0 },
      { onConflict: 'blueprint_id' },
    )
    this.logIfError('startInteriorJob', error)
  }

  async startCoverJob(blueprintId: string) {
    const { error } = await this.supabase.from('pdf_generation_jobs').upsert(
      { blueprint_id: blueprintId, status: 'generando_pdf', cover_done: false, cover_path: null, pdf_engine: 'container', error_message: null, attempt_count: 0 },
      { onConflict: 'blueprint_id' },
    )
    this.logIfError('startCoverJob', error)
  }

  async getJob(blueprintId: string) {
    const { data } = await this.supabase.from('pdf_generation_jobs').select('*').eq('blueprint_id', blueprintId).single()
    return data
  }

  async markInteriorReady(blueprintId: string, path: string) {
    const { error } = await this.supabase.from('pdf_generation_jobs').update({ interior_path: path }).eq('blueprint_id', blueprintId)
    this.logIfError('markInteriorReady', error)
    await this.maybeComplete(blueprintId)
  }

  async markCoverReady(blueprintId: string, path: string) {
    const { error } = await this.supabase.from('pdf_generation_jobs').update({ cover_done: true, cover_path: path }).eq('blueprint_id', blueprintId)
    this.logIfError('markCoverReady', error)
    await this.maybeComplete(blueprintId)
  }

  private async maybeComplete(blueprintId: string) {
    const job = await this.getJob(blueprintId)
    if (job && job.interior_path && job.cover_done) {
      const { error } = await this.supabase.from('pdf_generation_jobs').update({ status: 'pdf_listo' }).eq('blueprint_id', blueprintId)
      this.logIfError('maybeComplete', error)
    }
  }

  // ── Cola de producción (ver supabase/pdf_jobs_trigger.sql y queue.ts) ──

  /** Reclama atómicamente el siguiente job de una orden pagada. null si no hay. */
  async claimNext(maxAttempts: number, stuckMinutes: number): Promise<QueueJob | null> {
    const { data, error } = await this.supabase.rpc('claim_next_pdf_job', { p_max_attempts: maxAttempts, p_stuck_minutes: stuckMinutes })
    if (error) throw new Error(`claim_next_pdf_job falló: ${error.message}`)
    const rows = (data ?? []) as QueueJob[]
    return rows[0] ?? null
  }

  /** Pasa a 'fallo' los jobs que agotaron intentos. Devuelve los afectados. */
  async expireExhausted(maxAttempts: number, stuckMinutes: number): Promise<QueueJob[]> {
    const { data, error } = await this.supabase.rpc('expire_exhausted_pdf_jobs', { p_max_attempts: maxAttempts, p_stuck_minutes: stuckMinutes })
    if (error) throw new Error(`expire_exhausted_pdf_jobs falló: ${error.message}`)
    return (data ?? []) as QueueJob[]
  }

  /** Jobs en 'fallo' cuya alerta todavía no salió (p.ej. Resend falló la vez anterior). */
  async listUnalertedFailures(): Promise<QueueJob[]> {
    const { data, error } = await this.supabase
      .from('pdf_generation_jobs')
      .select('*')
      .eq('status', 'fallo')
      .is('alerted_at', null)
      .not('order_reference', 'is', null)
    if (error) throw new Error(`listUnalertedFailures falló: ${error.message}`)
    return (data ?? []) as QueueJob[]
  }

  /**
   * Falla de un job de la cola. attempt_count ya se sumó al reclamar, así
   * que acá NO se incrementa (a diferencia de markError, que usa la ruta dev).
   */
  async markQueueFailure(blueprintId: string, message: string, final: boolean) {
    const { error } = await this.supabase
      .from('pdf_generation_jobs')
      .update({ status: final ? 'fallo' : 'error_generacion', error_message: message })
      .eq('blueprint_id', blueprintId)
    this.logIfError('markQueueFailure', error)
  }

  async markAlerted(blueprintId: string) {
    const { error } = await this.supabase.from('pdf_generation_jobs').update({ alerted_at: new Date().toISOString() }).eq('blueprint_id', blueprintId)
    this.logIfError('markAlerted', error)
  }

  async loadBlueprint(blueprintId: string): Promise<unknown> {
    const { data, error } = await this.supabase.from('blueprints').select('*').eq('id', blueprintId).single()
    if (error || !data) throw new Error(`Álbum "${blueprintId}" no encontrado en Supabase: ${error?.message ?? 'sin datos'}`)
    return data
  }

  /**
   * Segunda red de seguridad: órdenes aprobadas en los últimos `days` días
   * cuyo álbum no tiene job de esa orden (el webhook no pudo encolar y Wompi
   * tampoco reintentó). Las encola en 'pendiente'. Devuelve las referencias.
   */
  async reconcileApprovedOrders(days: number): Promise<string[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const { data: orders, error } = await this.supabase
      .from('orders')
      .select('reference, book_id')
      .eq('payment_status', 'approved')
      .not('book_id', 'is', null)
      .gte('paid_at', since)
    if (error) throw new Error(`reconcile (orders) falló: ${error.message}`)
    if (!orders || orders.length === 0) return []

    const bookIds = orders.map((o) => o.book_id as string)
    const { data: jobs, error: jobsError } = await this.supabase
      .from('pdf_generation_jobs')
      .select('blueprint_id, order_reference')
      .in('blueprint_id', bookIds)
    if (jobsError) throw new Error(`reconcile (jobs) falló: ${jobsError.message}`)
    const jobByBook = new Map((jobs ?? []).map((j) => [j.blueprint_id as string, j.order_reference as string | null]))

    const enqueued: string[] = []
    for (const order of findOrdersMissingJob(orders as OrderRef[], jobByBook)) {
      const { error: upsertError } = await this.supabase.from('pdf_generation_jobs').upsert(
        {
          blueprint_id: order.book_id,
          order_reference: order.reference,
          status: 'pendiente',
          pdf_engine: 'container',
          attempt_count: 0,
          error_message: null,
          claimed_at: null,
          alerted_at: null,
          interior_path: null,
          cover_path: null,
          cover_done: false,
        },
        { onConflict: 'blueprint_id' },
      )
      if (upsertError) console.error(`[pdf-render-container] reconcile: no se pudo encolar ${order.reference}:`, upsertError.message)
      else enqueued.push(order.reference)
    }
    return enqueued
  }

  async markError(blueprintId: string, message: string) {
    const job = await this.getJob(blueprintId)
    const attempts = (job?.attempt_count ?? 0) + 1
    const { error } = await this.supabase
      .from('pdf_generation_jobs')
      .update({ status: 'error_generacion', error_message: message, attempt_count: attempts })
      .eq('blueprint_id', blueprintId)
    this.logIfError('markError', error)
  }
}
