-- Peticiones, quejas y reclamos (PQR) con número de radicado.
--
-- La Ley 2439 de 2024 (reforma al Estatuto del Consumidor) exige que cada
-- reclamación quede radicada con número, fecha y hora, y que el consumidor
-- pueda hacerle seguimiento. El cliente radica en /soporte, consulta en
-- /soporte/seguimiento y el admin responde en /admin/pqr.
--
-- Solo el service role (las APIs del servidor) lee y escribe: RLS activado y
-- sin políticas = nadie más.
--
-- Ejecutar UNA VEZ en el SQL editor de Supabase ANTES de desplegar el PR.
-- Es idempotente.

CREATE TABLE IF NOT EXISTS pqr_tickets (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  radicado         TEXT NOT NULL UNIQUE,
  type             TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'recibido'
                   CHECK (status IN ('recibido', 'en_tramite', 'respondido')),
  name             TEXT NOT NULL,
  email            TEXT NOT NULL,
  phone            TEXT,
  order_reference  TEXT,
  message          TEXT NOT NULL,
  user_id          UUID,
  ip               TEXT,
  due_date         DATE NOT NULL,            -- último día hábil para responder
  response         TEXT,                     -- respuesta enviada al cliente
  responded_at     TIMESTAMPTZ,
  internal_notes   TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pqr_status_due ON pqr_tickets (status, due_date);
CREATE INDEX IF NOT EXISTS idx_pqr_email ON pqr_tickets (lower(email));
CREATE INDEX IF NOT EXISTS idx_pqr_created ON pqr_tickets (created_at DESC);

ALTER TABLE pqr_tickets ENABLE ROW LEVEL SECURITY;
