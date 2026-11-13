-- Catálogo de portadas (2026-11-12): diseños que se suben desde /admin/portadas
-- y aparecen en el paso 3 y en el estudio de portada, por ocasión y país.
-- Idempotente: se puede correr más de una vez.

CREATE TABLE IF NOT EXISTS cover_designs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  name          TEXT NOT NULL,
  -- boda | viaje | bebe-mensual | aniversario | familia | mascota
  occasion      TEXT NOT NULL,
  -- Solo viajes: país del diseño ('Perú', 'México'...). NULL = cualquier destino.
  country       TEXT,
  art_url       TEXT NOT NULL,
  art_width     INTEGER,
  art_height    INTEGER,
  -- poster | centered | framed (dibujo sobre color) | full (arte de tapa completa)
  layout        TEXT NOT NULL DEFAULT 'poster',
  bg            TEXT NOT NULL DEFAULT '#F3ECE0',
  fg            TEXT NOT NULL DEFAULT '#2A2420',
  accent        TEXT,
  font_id       TEXT NOT NULL DEFAULT 'bebas',
  text_position TEXT NOT NULL DEFAULT 'top',
  text_align    TEXT NOT NULL DEFAULT 'center',
  active        BOOLEAN NOT NULL DEFAULT true,
  sort          INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS cover_designs_occasion_idx ON cover_designs (occasion, active, sort);

-- Solo el servidor (service role) lee y escribe; la web pública lo pide por /api/cover-designs.
ALTER TABLE cover_designs ENABLE ROW LEVEL SECURITY;

-- Verificación
SELECT count(*) AS disenos FROM cover_designs;
