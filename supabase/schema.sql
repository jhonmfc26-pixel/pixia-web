-- Sesiones anónimas
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_key TEXT UNIQUE NOT NULL,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  converted BOOLEAN DEFAULT FALSE,
  funnel_stage TEXT DEFAULT 'session_started'
);

-- Blueprints (álbumes)
CREATE TABLE blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  user_id UUID,
  status TEXT DEFAULT 'draft',
  occasion TEXT NOT NULL,
  format TEXT DEFAULT '30x30',
  style TEXT DEFAULT 'con-margen',
  page_count INTEGER DEFAULT 20,
  cover JSONB DEFAULT '{}',
  spreads JSONB DEFAULT '[]',
  narrative JSONB DEFAULT '{}',
  ai_generated BOOLEAN DEFAULT FALSE,
  purchase_id TEXT,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fotos subidas
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID REFERENCES blueprints(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  width INTEGER,
  height INTEGER,
  orientation TEXT,
  score JSONB DEFAULT '{}',
  taken_at TIMESTAMPTZ,
  original_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pedidos
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID REFERENCES blueprints(id),
  session_id TEXT NOT NULL,
  user_id UUID,
  status TEXT DEFAULT 'pending',
  format TEXT NOT NULL,
  page_count INTEGER NOT NULL,
  base_price INTEGER NOT NULL,
  addons JSONB DEFAULT '[]',
  total_price INTEGER NOT NULL,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  shipping_address JSONB DEFAULT '{}',
  wompi_transaction_id TEXT,
  print_partner_id TEXT,
  tracking_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Eventos del funnel
CREATE TABLE funnel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  blueprint_id UUID,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_blueprints_session ON blueprints(session_id);
CREATE INDEX idx_photos_blueprint ON photos(blueprint_id);
CREATE INDEX idx_orders_session ON orders(session_id);
CREATE INDEX idx_funnel_session ON funnel_events(session_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER blueprints_updated_at
  BEFORE UPDATE ON blueprints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
