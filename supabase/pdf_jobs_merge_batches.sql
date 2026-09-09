-- Brick 3: progreso del merge en sub-lotes (evita mantener el álbum entero
-- en memoria de una — ver el comentario largo en workers/pdf-render/src/index.ts).
-- Correr UNA VEZ en el SQL editor de Supabase, después de pdf_jobs.sql.

ALTER TABLE pdf_generation_jobs
  ADD COLUMN IF NOT EXISTS interior_merge_batches_done INTEGER NOT NULL DEFAULT 0;

-- interior_path / cover_path ahora guardan una KEY de R2 (ej.
-- "<blueprintId>/interior/final.pdf"), no una ruta de Supabase Storage — el
-- tipo de columna (TEXT) no cambia, solo lo que significa el valor. No hace
-- falta migrar filas existentes: los jobs viejos apuntaban a Supabase
-- Storage y ya no son válidos de todos modos (el bucket 'pdfs' de Supabase
-- queda sin uso desde este brick — se puede borrar a mano si se quiere,
-- no lo hace este script).
