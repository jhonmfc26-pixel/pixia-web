-- Trigger de producción pagado → PDF (cola + barrido).
--
-- Flujo:
--   1. Webhook de Wompi aprueba la orden → inserta el job como 'pendiente'
--      (app/api/orders/webhook/route.ts). No llama al contenedor: si lo
--      hiciera y fallara, Wompi no reintenta (la orden ya quedó approved y la
--      idempotencia salta) y el PDF se perdería.
--   2. Cloud Scheduler llama cada 5 min a POST /process-pending del
--      contenedor, que reclama UN job con claim_next_pdf_job() y lo genera.
--   3. Si falla, vuelve a intentarse en el siguiente barrido. Al llegar a
--      MAX intentos queda en 'fallo' y el contenedor manda alerta por email.
--
-- Estados:
--   pendiente        → encolado por el webhook, nadie lo tomó todavía
--   generando_pdf    → reclamado, generándose (o colgado si claimed_at es viejo)
--   pdf_listo        → interior + cubierta subidos a R2
--   error_generacion → falló, se reintenta en el próximo barrido
--   fallo            → agotó los intentos — requiere intervención manual
--
-- Ejecutar UNA VEZ en el SQL editor de Supabase. Es idempotente.

ALTER TABLE pdf_generation_jobs
  ADD COLUMN IF NOT EXISTS order_reference TEXT,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS alerted_at TIMESTAMPTZ;

-- Borra TODO CHECK sobre status, se llame como se llame (el de pdf_jobs.sql
-- debería llamarse pdf_generation_jobs_status_check, pero si en producción
-- quedó con otro nombre, un DROP por nombre fallaría en silencio y el CHECK
-- viejo seguiría rechazando 'pendiente').
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'pdf_generation_jobs'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE pdf_generation_jobs DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE pdf_generation_jobs ADD CONSTRAINT pdf_generation_jobs_status_check
  CHECK (status IN ('pendiente', 'generando_pdf', 'pdf_listo', 'error_generacion', 'fallo'));

CREATE INDEX IF NOT EXISTS pdf_generation_jobs_queue_idx
  ON pdf_generation_jobs (status, created_at);

-- Reclamo ATÓMICO del siguiente job a procesar. FOR UPDATE SKIP LOCKED
-- garantiza que dos barridos simultáneos (p.ej. Cloud Scheduler reintentando
-- mientras el anterior sigue corriendo) nunca tomen el mismo job.
--
-- attempt_count = cuántas veces se RECLAMÓ el job (se suma al reclamar, no al
-- fallar). Así un álbum que tumba el contenedor a mitad de render (muere sin
-- poder marcar error) también consume intentos y no queda en loop infinito.
--
-- Toma, en orden de antigüedad, solo si attempt_count < p_max_attempts:
--   - 'pendiente'
--   - 'error_generacion'
--   - 'generando_pdf' con claimed_at más viejo que p_stuck_minutes (el
--     contenedor murió a mitad de render). Solo jobs con claimed_at: los
--     generados a mano por la ruta dev no tienen y no se tocan.
--
-- Solo jobs con order_reference: la cola es para órdenes pagadas, no para
-- las pruebas manuales de la ruta dev (que también escriben en esta tabla).
CREATE OR REPLACE FUNCTION claim_next_pdf_job(p_max_attempts INTEGER, p_stuck_minutes INTEGER)
RETURNS SETOF pdf_generation_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE pdf_generation_jobs j
     SET status = 'generando_pdf',
         claimed_at = NOW(),
         attempt_count = j.attempt_count + 1,
         pdf_engine = 'container'
   WHERE j.blueprint_id = (
     SELECT c.blueprint_id
       FROM pdf_generation_jobs c
      WHERE c.order_reference IS NOT NULL
        AND c.attempt_count < p_max_attempts
        AND (
              c.status IN ('pendiente', 'error_generacion')
          OR (c.status = 'generando_pdf' AND c.claimed_at IS NOT NULL
              AND c.claimed_at < NOW() - make_interval(mins => p_stuck_minutes))
        )
      ORDER BY c.created_at
      LIMIT 1
      FOR UPDATE SKIP LOCKED
   )
  RETURNING j.*;
END;
$$;

-- Pasa a 'fallo' los jobs que agotaron los intentos y siguen sin PDF:
--   - 'error_generacion' con attempt_count >= p_max_attempts (normalmente el
--     contenedor ya los marca 'fallo' directo; esto cubre si esa escritura
--     falló)
--   - 'generando_pdf' colgados (claimed_at viejo) en su último intento
-- Devuelve las filas afectadas para que el contenedor mande la alerta.
CREATE OR REPLACE FUNCTION expire_exhausted_pdf_jobs(p_max_attempts INTEGER, p_stuck_minutes INTEGER)
RETURNS SETOF pdf_generation_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE pdf_generation_jobs j
     SET status = 'fallo',
         error_message = COALESCE(j.error_message, 'El contenedor se cayó durante la generación (job colgado)')
   WHERE j.order_reference IS NOT NULL
     AND j.attempt_count >= p_max_attempts
     AND (
           j.status = 'error_generacion'
       OR (j.status = 'generando_pdf' AND j.claimed_at IS NOT NULL
           AND j.claimed_at < NOW() - make_interval(mins => p_stuck_minutes))
     )
  RETURNING j.*;
END;
$$;

-- Solo el service role puede tocar la cola.
REVOKE ALL ON FUNCTION claim_next_pdf_job(INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_next_pdf_job(INTEGER, INTEGER) TO service_role;
REVOKE ALL ON FUNCTION expire_exhausted_pdf_jobs(INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION expire_exhausted_pdf_jobs(INTEGER, INTEGER) TO service_role;
