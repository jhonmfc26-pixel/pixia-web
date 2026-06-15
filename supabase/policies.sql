-- =============================================================================
-- Pixia RLS Policies — fuente de verdad única
-- Aplicar en Supabase SQL Editor cada vez que se modifiquen.
-- El service_role bypassa RLS por diseño — NO crear políticas para él.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Borrar políticas abiertas antiguas (idempotente)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow anonymous update sessions"   ON sessions;
DROP POLICY IF EXISTS "Allow anonymous select sessions"   ON sessions;
DROP POLICY IF EXISTS "Allow anonymous insert sessions"   ON sessions;
DROP POLICY IF EXISTS "Allow anonymous insert events"     ON funnel_events;
DROP POLICY IF EXISTS "Allow anonymous select blueprints" ON blueprints;
DROP POLICY IF EXISTS "Allow anonymous insert blueprints" ON blueprints;

-- -----------------------------------------------------------------------------
-- 2. RLS activo en las 5 tablas (idempotente)
-- -----------------------------------------------------------------------------
ALTER TABLE blueprints   ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE funnel_events ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 3. Políticas de lectura para usuarios autenticados
--    INSERT / UPDATE / DELETE: sin política → denegado para anon/authenticated.
--    El backend usa service_role y no necesita políticas.
-- -----------------------------------------------------------------------------

-- blueprints: cada usuario solo ve los suyos
CREATE POLICY "users read own blueprints" ON blueprints
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- orders: cada usuario solo ve las suyas
CREATE POLICY "users read own orders" ON orders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- photos: visible solo si el blueprint padre pertenece al usuario
CREATE POLICY "users read own photos" ON photos
  FOR SELECT TO authenticated
  USING (
    blueprint_id IN (
      SELECT id FROM blueprints WHERE user_id = auth.uid()
    )
  );

-- sessions y funnel_events: cerradas a clientes — solo backend (service_role).
-- No se crean políticas: toda operación desde el navegador queda denegada.

-- -----------------------------------------------------------------------------
-- 4. Verificación — ejecutar después de aplicar y pegar resultado aquí
-- -----------------------------------------------------------------------------
-- SELECT tablename, policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
--
-- Resultado esperado: exactamente 3 filas
--   blueprints | users read own blueprints | SELECT | {authenticated}
--   orders     | users read own orders     | SELECT | {authenticated}
--   photos     | users read own photos     | SELECT | {authenticated}
