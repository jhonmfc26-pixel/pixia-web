import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Estado del job de generación de PDF, en pdf_generation_jobs (ver
 * supabase/pdf_jobs.sql) — keyed por blueprint_id, no por orden: así la
 * ruta dev puede probar cualquier álbum sin necesitar una orden real.
 * En producción (bricks futuros), se linkea vía orders.blueprint_id.
 *
 * SOLO estado/progreso — los ARCHIVOS (páginas, job-input, PDF final) viven
 * en R2 privado desde Brick 3 (ver r2Storage.ts), no acá. Supabase Storage
 * quedó descartado para archivos: el plan Free tiene un tope de 50MB por
 * archivo, insuficiente para el PDF final de un álbum (100MB+).
 */
export function createJobsClient(supabaseUrl: string, serviceRoleKey: string) {
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  return new JobsClient(supabase)
}

export interface InteriorSection {
  key: string
  pageStart: number
  pageEnd: number
}

const MAX_ATTEMPTS = 3

class JobsClient {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Ningún caller de esta clase revisaba el `{ error }` que devuelve
   * supabase-js (no lanza excepciones por sí solo) — un upsert/update contra
   * una columna que no existe todavía en la tabla real (ej. pdf_engine antes
   * de correr pdf_jobs_engine.sql) fallaba en silencio, sin aparecer en
   * ningún log. Eso es justo lo que dejó correr el Cron Trigger en loop
   * varios días sin que nadie lo notara (interior_sections nunca se pudo
   * grabar, así que el job nunca se veía "completo"). Logueamos cualquier
   * error acá, aunque no cambiemos el flujo de control.
   */
  private logIfError(op: string, error: { message: string } | null) {
    if (error) console.error(`[pdf-render] Supabase ${op} falló:`, error.message)
  }

  /**
   * Arranca (o reinicia) SOLO la parte de interior — no toca cover_done/
   * cover_path: interior y cubierta se disparan independiente uno del otro
   * (ver ?which=interior|cover|both en la ruta dev), un upsert que
   * pisara los dos campos del otro lado perdería su progreso si ya estaba
   * listo (bug real, encontrado en la validación en vivo).
   */
  async startInteriorJob(blueprintId: string, interiorPagesTotal: number) {
    const { error } = await this.supabase.from('pdf_generation_jobs').upsert(
      {
        blueprint_id: blueprintId,
        status: 'generando_pdf',
        interior_pages_done: 0,
        interior_pages_total: interiorPagesTotal,
        interior_merge_batches_done: 0,
        interior_sections: null,
        pdf_engine: 'worker',
        error_message: null,
        attempt_count: 0,
      },
      { onConflict: 'blueprint_id' },
    )
    this.logIfError('startInteriorJob', error)
  }

  async startCoverJob(blueprintId: string) {
    const { error } = await this.supabase.from('pdf_generation_jobs').upsert(
      {
        blueprint_id: blueprintId,
        pdf_engine: 'worker',
        status: 'generando_pdf',
        cover_done: false,
        cover_path: null,
        error_message: null,
        attempt_count: 0,
      },
      { onConflict: 'blueprint_id' },
    )
    this.logIfError('startCoverJob', error)
  }

  async getJob(blueprintId: string) {
    const { data } = await this.supabase.from('pdf_generation_jobs').select('*').eq('blueprint_id', blueprintId).single()
    return data
  }

  async bumpInteriorProgress(blueprintId: string, pagesDone: number) {
    const { error } = await this.supabase.from('pdf_generation_jobs').update({ interior_pages_done: pagesDone }).eq('blueprint_id', blueprintId)
    this.logIfError('bumpInteriorProgress', error)
  }

  async bumpMergeProgress(blueprintId: string, batchesDone: number) {
    const { error } = await this.supabase.from('pdf_generation_jobs').update({ interior_merge_batches_done: batchesDone }).eq('blueprint_id', blueprintId)
    this.logIfError('bumpMergeProgress', error)
  }

  /**
   * El interior se entrega en SECCIONES (no un único PDF) — el combine final
   * de un álbum grande a un solo archivo revienta el límite de memoria del
   * Worker (pdf-lib no tiene streaming, ver comentario largo en index.ts).
   * Cada sección ya cabe cómoda en memoria por construcción (MERGE_BATCH_SIZE).
   */
  async markInteriorReady(blueprintId: string, sections: InteriorSection[]) {
    const { error } = await this.supabase.from('pdf_generation_jobs').update({ interior_sections: sections }).eq('blueprint_id', blueprintId)
    this.logIfError('markInteriorReady', error)
    await this.maybeComplete(blueprintId)
  }

  async markCoverReady(blueprintId: string, path: string) {
    const { error } = await this.supabase.from('pdf_generation_jobs').update({ cover_done: true, cover_path: path }).eq('blueprint_id', blueprintId)
    this.logIfError('markCoverReady', error)
    await this.maybeComplete(blueprintId)
  }

  /** pdf_listo solo cuando interior Y cubierta están listos. */
  private async maybeComplete(blueprintId: string) {
    const job = await this.getJob(blueprintId)
    if (job && job.interior_sections && job.cover_done) {
      const { error } = await this.supabase.from('pdf_generation_jobs').update({ status: 'pdf_listo' }).eq('blueprint_id', blueprintId)
      this.logIfError('maybeComplete', error)
    }
  }

  async markError(blueprintId: string, message: string) {
    const job = await this.getJob(blueprintId)
    const attempts = (job?.attempt_count ?? 0) + 1
    const { error } = await this.supabase
      .from('pdf_generation_jobs')
      .update({
        status: attempts >= MAX_ATTEMPTS ? 'error_generacion' : 'generando_pdf',
        error_message: message,
        attempt_count: attempts,
      })
      .eq('blueprint_id', blueprintId)
    this.logIfError('markError', error)
  }

  /**
   * Todos los jobs activos DEL WORKER — el Cron Trigger es quien los hace
   * avanzar (ver index.ts). Filtra pdf_engine explícitamente: sin esto, el
   * cron recogía CUALQUIER fila en 'generando_pdf' sin importar quién la
   * inició, incluidas las del contenedor Playwright — como el contenedor
   * nunca escribe interior_sections, el Worker las creía "nunca completas" y
   * las reprocesaba cada minuto para siempre (incidente real: un job quedó
   * así ~9 días, subiendo una sección basura nueva a R2 en cada tick). Los
   * jobs viejos sin pdf_engine (de antes de que existiera la columna) siguen
   * cayendo acá — is.null — para no perder jobs legítimos del Worker.
   */
  async getActiveJobs() {
    const { data, error } = await this.supabase
      .from('pdf_generation_jobs')
      .select('*')
      .eq('status', 'generando_pdf')
      .lt('attempt_count', MAX_ATTEMPTS)
      .or('pdf_engine.eq.worker,pdf_engine.is.null')
    this.logIfError('getActiveJobs', error)
    return data ?? []
  }
}
