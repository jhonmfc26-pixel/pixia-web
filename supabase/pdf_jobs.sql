-- Base de estados para la generación asíncrona de PDF (Brick 4).
-- Tabla propia, separada de `orders`: la generación se dispara por
-- blueprint_id (álbum), no por orden — así la ruta dev puede probar
-- CUALQUIER álbum sin necesitar una orden real, y cuando el webhook de
-- Wompi dispare esto en producción, se linkea vía orders.blueprint_id.
--
-- Ejecutar UNA VEZ en el SQL editor de Supabase (no hay tooling de
-- migraciones en este proyecto — ver supabase/schema.sql y policies.sql,
-- que ya están desactualizados respecto al schema real en producción).

CREATE TABLE IF NOT EXISTS pdf_generation_jobs (
  blueprint_id UUID PRIMARY KEY REFERENCES blueprints(id),
  status TEXT NOT NULL DEFAULT 'generando_pdf'
    CHECK (status IN ('generando_pdf', 'pdf_listo', 'error_generacion')),
  interior_pages_done INTEGER NOT NULL DEFAULT 0,
  interior_pages_total INTEGER NOT NULL DEFAULT 0,
  cover_done BOOLEAN NOT NULL DEFAULT FALSE,
  interior_path TEXT,     -- object path en Storage bucket `pdfs` (privado) una vez completo
  cover_path TEXT,
  error_message TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_pdf_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pdf_generation_jobs_updated_at ON pdf_generation_jobs;
CREATE TRIGGER pdf_generation_jobs_updated_at
  BEFORE UPDATE ON pdf_generation_jobs
  FOR EACH ROW EXECUTE FUNCTION update_pdf_jobs_updated_at();

-- RLS estricta (mismo criterio que el resto del proyecto, ver policies.sql):
-- solo el service role (worker/backend) puede leer o escribir. Nada de
-- acceso anónimo/cliente — el estado se consulta a través de la ruta dev
-- (server-side) o, en producción, de una ruta de status equivalente.
ALTER TABLE pdf_generation_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role only" ON pdf_generation_jobs;
CREATE POLICY "service role only" ON pdf_generation_jobs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Bucket privado para los PDFs generados — temporal hasta que Brick 3
-- conecte R2 (mismo bucket S3-compatible que ya usan las fotos, ver
-- app/api/upload/route.ts). Se elige Supabase Storage acá porque el worker
-- ya necesita credenciales de Supabase para actualizar pdf_generation_jobs,
-- así que no suma un tercer secreto/proveedor solo para esto.
INSERT INTO storage.buckets (id, name, public)
VALUES ('pdfs', 'pdfs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "pdfs bucket service role only" ON storage.objects;
CREATE POLICY "pdfs bucket service role only" ON storage.objects
  FOR ALL
  USING (bucket_id = 'pdfs' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'pdfs' AND auth.role() = 'service_role');
