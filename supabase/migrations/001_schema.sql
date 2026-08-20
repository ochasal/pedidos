-- ============================================================
-- PLATAFORMA MULTI-TENANT DE PEDIDOS
-- Migración 001: Schema completo
-- ============================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLA: tenants
-- El ente principal. Cada negocio es un tenant.
-- ============================================================
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: tenant_config
-- Configuración parametrizable por tenant (branding, contacto, etc.)
-- ============================================================
CREATE TABLE tenant_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Branding
  logo_url TEXT,
  favicon_url TEXT,
  primary_color VARCHAR(7) DEFAULT '#2563eb',
  primary_color_dark VARCHAR(7) DEFAULT '#1d4ed8',
  accent_color VARCHAR(7) DEFAULT '#f59e0b',
  tagline VARCHAR(500),
  -- Contacto
  phone VARCHAR(50),
  whatsapp_number VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  -- Configuración de delivery
  delivery_enabled BOOLEAN DEFAULT true,
  pickup_enabled BOOLEAN DEFAULT true,
  min_order_amount DECIMAL(10,2) DEFAULT 0,
  delivery_fee DECIMAL(10,2) DEFAULT 0,
  -- Reglas de negocio
  require_full_payment_before_delivery BOOLEAN DEFAULT true,
  allow_cash_without_prepayment BOOLEAN DEFAULT true,
  auto_close_after_hours BOOLEAN DEFAULT true,
  -- WhatsApp notifications
  whatsapp_notifications_enabled BOOLEAN DEFAULT false,
  whatsapp_api_url TEXT,
  whatsapp_api_token TEXT,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- ============================================================
-- TABLA: currencies
-- Monedas disponibles por tenant (USD, VES, etc.)
-- ============================================================
CREATE TABLE currencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(10) NOT NULL,
  name VARCHAR(100) NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  is_base BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  decimal_places INTEGER DEFAULT 2,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, code)
);

-- ============================================================
-- TABLA: exchange_rates
-- Tasas de cambio dinámicas entre monedas del tenant
-- ============================================================
CREATE TABLE exchange_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_currency_id UUID NOT NULL REFERENCES currencies(id) ON DELETE CASCADE,
  to_currency_id UUID NOT NULL REFERENCES currencies(id) ON DELETE CASCADE,
  rate DECIMAL(18,8) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, from_currency_id, to_currency_id)
);

-- ============================================================
-- TABLA: payment_methods
-- Métodos de pago configurables con moneda asociada
-- ============================================================
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'cash', 'transfer', 'mobile_payment', 'zelle', 'crypto', etc.
  currency_id UUID NOT NULL REFERENCES currencies(id) ON DELETE RESTRICT,
  -- Detalles del método (banco, número de cuenta, etc.)
  details JSONB DEFAULT '{}',
  instructions TEXT,
  requires_proof BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: categories
-- Categorías de productos por tenant
-- ============================================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  image_url TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: products
-- Catálogo de productos por tenant
-- ============================================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  currency_id UUID NOT NULL REFERENCES currencies(id) ON DELETE RESTRICT,
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  -- Opciones/variantes como JSON flexible
  options JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: business_hours
-- Horarios de atención por día de la semana
-- ============================================================
CREATE TABLE business_hours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Domingo, 6=Sábado
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, day_of_week)
);

-- ============================================================
-- TABLA: employees
-- Usuarios del panel admin, vinculados a auth.users y al tenant
-- ============================================================
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'operator', -- 'owner', 'admin', 'operator'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, user_id)
);

-- ============================================================
-- TABLA: orders
-- Pedidos con tracking token público
-- ============================================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_number SERIAL,
  tracking_token VARCHAR(64) UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  -- Cliente
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50),
  customer_email VARCHAR(255),
  customer_address TEXT,
  -- Pedido
  status VARCHAR(50) NOT NULL DEFAULT 'recibido',
  order_type VARCHAR(20) NOT NULL DEFAULT 'delivery', -- 'delivery', 'pickup'
  notes TEXT,
  -- Totales (en moneda base del tenant)
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  -- Pago
  total_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_complete BOOLEAN DEFAULT false,
  -- Origen
  source VARCHAR(50) DEFAULT 'web', -- 'web', 'whatsapp', 'manual'
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN (
    'recibido', 'procesando_pago', 'en_preparacion', 
    'preparado', 'en_camino', 'completado', 'cancelado'
  )),
  CONSTRAINT valid_order_type CHECK (order_type IN ('delivery', 'pickup'))
);

-- ============================================================
-- TABLA: order_items
-- Ítems de cada pedido
-- ============================================================
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  product_price DECIMAL(10,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  subtotal DECIMAL(10,2) NOT NULL,
  options JSONB DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: order_payments
-- Pagos múltiples por pedido con comprobantes
-- ============================================================
CREATE TABLE order_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency_id UUID NOT NULL REFERENCES currencies(id) ON DELETE RESTRICT,
  -- Monto convertido a moneda base
  amount_in_base DECIMAL(10,2) NOT NULL,
  exchange_rate_used DECIMAL(18,8),
  -- Comprobante
  reference_number VARCHAR(255),
  proof_url TEXT,
  -- Estado
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'verified', 'rejected'
  verified_by UUID REFERENCES employees(id),
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_payment_status CHECK (status IN ('pending', 'verified', 'rejected'))
);

-- ============================================================
-- TABLA: order_status_history
-- Historial de cambios de estado del pedido
-- ============================================================
CREATE TABLE order_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  changed_by UUID REFERENCES employees(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES para performance
-- ============================================================
CREATE INDEX idx_tenant_config_tenant ON tenant_config(tenant_id);
CREATE INDEX idx_currencies_tenant ON currencies(tenant_id);
CREATE INDEX idx_exchange_rates_tenant ON exchange_rates(tenant_id);
CREATE INDEX idx_payment_methods_tenant ON payment_methods(tenant_id);
CREATE INDEX idx_categories_tenant ON categories(tenant_id);
CREATE INDEX idx_products_tenant ON products(tenant_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_business_hours_tenant ON business_hours(tenant_id);
CREATE INDEX idx_employees_tenant ON employees(tenant_id);
CREATE INDEX idx_employees_user ON employees(user_id);
CREATE INDEX idx_orders_tenant ON orders(tenant_id);
CREATE INDEX idx_orders_status ON orders(tenant_id, status);
CREATE INDEX idx_orders_tracking ON orders(tracking_token);
CREATE INDEX idx_orders_customer_phone ON orders(tenant_id, customer_phone);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_payments_order ON order_payments(order_id);
CREATE INDEX idx_order_status_history_order ON order_status_history(order_id);

-- ============================================================
-- FUNCIÓN: updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers de updated_at
CREATE TRIGGER tr_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_tenant_config_updated_at BEFORE UPDATE ON tenant_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_currencies_updated_at BEFORE UPDATE ON currencies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_exchange_rates_updated_at BEFORE UPDATE ON exchange_rates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_payment_methods_updated_at BEFORE UPDATE ON payment_methods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_business_hours_updated_at BEFORE UPDATE ON business_hours FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_employees_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_order_payments_updated_at BEFORE UPDATE ON order_payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- FUNCIÓN: Obtener tenant_id del usuario autenticado
-- Busca en la tabla employees a qué tenant pertenece
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT tenant_id FROM employees 
    WHERE user_id = auth.uid() AND is_active = true
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- FUNCIÓN: Verificar si el usuario es empleado del tenant
-- ============================================================
CREATE OR REPLACE FUNCTION is_employee_of_tenant(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM employees 
    WHERE user_id = auth.uid() 
      AND tenant_id = p_tenant_id 
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- SEED: Crear tenant Pastelven como primer tenant
-- ============================================================
INSERT INTO tenants (slug, name) VALUES ('pastelven', 'Pastelven');

INSERT INTO tenant_config (tenant_id, primary_color, primary_color_dark, accent_color, tagline, delivery_enabled, pickup_enabled)
SELECT id, '#e91e63', '#c2185b', '#ff9800', 'Los mejores pasteles de Venezuela', true, true
FROM tenants WHERE slug = 'pastelven';

-- Monedas para Pastelven
INSERT INTO currencies (tenant_id, code, name, symbol, is_base)
SELECT id, 'USD', 'Dólar Estadounidense', '$', true FROM tenants WHERE slug = 'pastelven';

INSERT INTO currencies (tenant_id, code, name, symbol, is_base)
SELECT id, 'VES', 'Bolívar', 'Bs.', false FROM tenants WHERE slug = 'pastelven';

-- Tasa de cambio inicial
INSERT INTO exchange_rates (tenant_id, from_currency_id, to_currency_id, rate)
SELECT 
  t.id,
  usd.id,
  ves.id,
  36.50
FROM tenants t
JOIN currencies usd ON usd.tenant_id = t.id AND usd.code = 'USD'
JOIN currencies ves ON ves.tenant_id = t.id AND ves.code = 'VES'
WHERE t.slug = 'pastelven';

-- Horarios de Pastelven (Lunes a Sábado 8am - 6pm)
INSERT INTO business_hours (tenant_id, day_of_week, open_time, close_time)
SELECT id, day, '08:00', '18:00'
FROM tenants, generate_series(1, 6) AS day
WHERE slug = 'pastelven';
