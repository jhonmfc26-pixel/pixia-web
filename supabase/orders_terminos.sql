-- Constancia de aceptación de los Términos y condiciones y de la Política de
-- datos en cada pedido (Ley 1480 de 2011, Ley 527 de 1999, Ley 1581 de 2012:
-- hay que poder probar qué aceptó el cliente y cuándo).
--
-- La API /api/orders/create rechaza el pedido si el cliente no aceptó la
-- versión vigente (lib/legal.ts → TERMS_VERSION) y guarda aquí versión, fecha
-- e IP.
--
-- Ejecutar UNA VEZ en el SQL editor de Supabase ANTES de desplegar el PR.
-- Es idempotente.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS terms_version     TEXT,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_accepted_ip TEXT;
