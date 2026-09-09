-- Migración a contenedor Playwright (Cloud Run) — coexiste con el Worker CF
-- mientras se valida. pdf_engine dice quién generó el job ('worker' | 'container')
-- — hace falta para saber con qué secreto firmar la URL de descarga (cada
-- motor valida su propio token en su propio /download, ver el comentario
-- largo en services/pdf-render-container/src/server.ts y
-- workers/pdf-render/src/index.ts).
-- Correr UNA VEZ en el SQL editor de Supabase.

ALTER TABLE pdf_generation_jobs
  ADD COLUMN IF NOT EXISTS pdf_engine TEXT;
