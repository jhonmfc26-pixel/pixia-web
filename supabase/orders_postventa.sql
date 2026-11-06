-- Estados post-venta del pedido: en impresión → enviado → entregado.
--
-- El admin los cambia desde /admin/pedidos/<ref> y al cliente le llega un
-- correo en cada paso (lib/email.ts → sendOrderStatusEmail). El cliente ve el
-- estado y la guía en su álbum (/book/<id>).
--
-- print_status (ya existía; el webhook lo deja en 'paid' al aprobar el pago):
--   paid      → pagado, preparando el archivo para la imprenta
--   printing  → en impresión
--   shipped   → enviado (con transportadora y número de guía)
--   delivered → entregado
--
-- Ejecutar UNA VEZ en el SQL editor de Supabase ANTES de desplegar el PR.
-- Es idempotente (se puede correr dos veces sin problema).

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS printing_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipped_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipping_carrier TEXT,
  ADD COLUMN IF NOT EXISTS tracking_number  TEXT,
  ADD COLUMN IF NOT EXISTS tracking_url     TEXT;

-- Si existiera algún CHECK viejo sobre print_status que no conozca los
-- estados nuevos, se reemplaza (se busca por definición, no por nombre).
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'orders'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%print_status%'
  LOOP
    EXECUTE format('ALTER TABLE orders DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_print_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_print_status_check
  CHECK (print_status IS NULL OR print_status IN ('paid', 'printing', 'shipped', 'delivered'))
  NOT VALID; -- no revisa filas viejas (por si alguna quedó con otro valor); sí las nuevas

-- Lo mismo para blueprints.status (el álbum del cliente refleja el estado).
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'blueprints'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE blueprints DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

-- Para listar en el admin los pedidos por estado.
CREATE INDEX IF NOT EXISTS idx_orders_print_status ON orders (print_status);
