-- Almacenamiento: reportes de uso y limpieza (ver lib/retention.ts y
-- services/pdf-render-container/src/storage.ts).
--
-- Ejecutar UNA VEZ en el SQL editor de Supabase ANTES de desplegar el PR.
-- Es idempotente (se puede correr dos veces sin problema).

-- 1. Un reporte por corrida (diaria, o cuando el admin pide medir).
CREATE TABLE IF NOT EXISTS storage_reports (
  id                 BIGSERIAL PRIMARY KEY,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  mode               TEXT NOT NULL,                 -- 'prueba' (no borra) | 'aplicada'
  photos_bytes       BIGINT DEFAULT 0,
  photos_objects     INTEGER DEFAULT 0,
  pdfs_bytes         BIGINT DEFAULT 0,
  pdfs_objects       INTEGER DEFAULT 0,
  to_delete_bytes    BIGINT DEFAULT 0,              -- lo que la política manda borrar
  to_delete_objects  INTEGER DEFAULT 0,
  deleted_bytes      BIGINT DEFAULT 0,              -- lo que se borró (solo en 'aplicada')
  deleted_objects    INTEGER DEFAULT 0,
  deleted_blueprints INTEGER DEFAULT 0,
  purged_orders      INTEGER DEFAULT 0,
  budget_bytes       BIGINT,
  details            JSONB DEFAULT '{}'::jsonb,
  error              TEXT
);
CREATE INDEX IF NOT EXISTS storage_reports_created_at_idx ON storage_reports (created_at DESC);

-- Solo el servidor (service role) la lee y escribe; sin políticas = nadie más.
ALTER TABLE storage_reports ENABLE ROW LEVEL SECURITY;

-- 2. Cuándo se borraron las fotos y el PDF de un pedido (30 días después de
--    la entrega). La fila del pedido se conserva por normas contables.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS assets_purged_at TIMESTAMPTZ;

-- Verificación (debe devolver 1 fila con la columna nueva):
SELECT column_name FROM information_schema.columns
WHERE table_name = 'orders' AND column_name = 'assets_purged_at';
