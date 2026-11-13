import { supabaseAdmin } from '@/lib/supabase'

/**
 * Encola la generación del PDF de impresión de una orden pagada (ver
 * supabase/pdf_jobs_trigger.sql). NO genera nada: solo deja el job en
 * 'pendiente' para que el barrido del contenedor (POST /process-pending,
 * llamado por Cloud Scheduler) lo tome.
 *
 * - overwrite=true  → primera aprobación de la orden: el álbum que se pagó es
 *   el definitivo, así que se reemplaza cualquier job previo (p.ej. uno de
 *   una prueba manual con la ruta dev) y se arranca de cero.
 * - overwrite=false → reintento del webhook sobre una orden ya aprobada: solo
 *   encola si el álbum todavía no tiene job de una orden. Nunca pisa un job
 *   que ya está generándose o listo, ni el de otra orden del mismo álbum.
 */
export async function enqueuePdfJob(params: {
  blueprintId: string
  orderReference: string
  overwrite: boolean
}): Promise<{ ok: true; enqueued: boolean } | { ok: false; error: string }> {
  const { blueprintId, orderReference, overwrite } = params

  if (!overwrite) {
    const { data: existing, error: readError } = await supabaseAdmin
      .from('pdf_generation_jobs')
      .select('order_reference')
      .eq('blueprint_id', blueprintId)
      .maybeSingle()
    if (readError) return { ok: false, error: readError.message }
    // Ya hay job de esta orden, o de OTRA orden pagada del mismo álbum (pago
    // doble): no se pisa. Solo se reemplaza un job sin orden (prueba manual).
    if (existing?.order_reference) return { ok: true, enqueued: false }
  }

  const { error } = await supabaseAdmin.from('pdf_generation_jobs').upsert(
    {
      blueprint_id: blueprintId,
      order_reference: orderReference,
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
  if (error) return { ok: false, error: error.message }
  return { ok: true, enqueued: true }
}
