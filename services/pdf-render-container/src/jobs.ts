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
export function createJobsClient(supabaseUrl: string, serviceRoleKey: string) {
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  return new JobsClient(supabase)
}

class JobsClient {
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
