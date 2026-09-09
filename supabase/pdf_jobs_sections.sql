-- Brick 3 (fix del OOM en el merge final): el interior se entrega en
-- SECCIONES (cada una ya cabe cómoda en los 128MB del Worker), no como un
-- único PDF de 114MB — ese combine final es justo lo que reventaba, sin
-- importar cuánto se sub-lotee el camino hasta ahí: el .save() de pdf-lib
-- no tiene streaming, necesita el documento COMPLETO en memoria.
--
-- interior_path queda sin usarse para el interior (se mantiene la columna
-- por compatibilidad, pero el chequeo de "listo" pasa a interior_sections).
-- Correr UNA VEZ en el SQL editor de Supabase, después de pdf_jobs.sql y
-- pdf_jobs_merge_batches.sql.

ALTER TABLE pdf_generation_jobs
  ADD COLUMN IF NOT EXISTS interior_sections JSONB;
