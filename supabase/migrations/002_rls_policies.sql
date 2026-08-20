-- ============================================================
-- PLATAFORMA MULTI-TENANT DE PEDIDOS
-- Migración 002: Row Level Security Policies
-- 
-- Estrategia:
-- - Datos públicos (catálogo, horarios): lectura libre filtrada por tenant
-- - Datos privados (pedidos, pagos, config interna): solo empleados del tenant
-- - Creación de pedidos: abierta (clientes crean pedidos sin login)
-- - Tracking: acceso público por token
-- ============================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TENANTS
-- Lectura pública (necesario para resolver slug → tenant)
-- Escritura solo service_role
-- ============================================================
CREATE POLICY "tenants_select_public" ON tenants
  FOR SELECT USING (is_active = true);

CREATE POLICY "tenants_all_service" ON tenants
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- TENANT_CONFIG
-- Lectura pública (colores, branding se muestran en la tienda)
-- Los campos sensibles (whatsapp_api_token) se filtran en la API
-- Escritura solo empleados del tenant
-- ============================================================
CREATE POLICY "tenant_config_select_public" ON tenant_config
  FOR SELECT USING (
    tenant_id IN (SELECT id FROM tenants WHERE is_active = true)
  );

CREATE POLICY "tenant_config_modify_employees" ON tenant_config
  FOR ALL USING (is_employee_of_tenant(tenant_id))
  WITH CHECK (is_employee_of_tenant(tenant_id));

CREATE POLICY "tenant_config_service" ON tenant_config
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- CURRENCIES
-- Lectura pública (se muestran precios en la tienda)
-- Escritura solo empleados del tenant
-- ============================================================
CREATE POLICY "currencies_select_public" ON currencies
  FOR SELECT USING (
    is_active = true AND tenant_id IN (SELECT id FROM tenants WHERE is_active = true)
  );

CREATE POLICY "currencies_modify_employees" ON currencies
  FOR ALL USING (is_employee_of_tenant(tenant_id))
  WITH CHECK (is_employee_of_tenant(tenant_id));

CREATE POLICY "currencies_service" ON currencies
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- EXCHANGE_RATES
-- Lectura pública (necesario para mostrar precios convertidos)
-- Escritura solo empleados del tenant
-- ============================================================
CREATE POLICY "exchange_rates_select_public" ON exchange_rates
  FOR SELECT USING (
    is_active = true AND tenant_id IN (SELECT id FROM tenants WHERE is_active = true)
  );

CREATE POLICY "exchange_rates_modify_employees" ON exchange_rates
  FOR ALL USING (is_employee_of_tenant(tenant_id))
  WITH CHECK (is_employee_of_tenant(tenant_id));

CREATE POLICY "exchange_rates_service" ON exchange_rates
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- PAYMENT_METHODS
-- Lectura pública (clientes ven los métodos disponibles)
-- Escritura solo empleados del tenant
-- ============================================================
CREATE POLICY "payment_methods_select_public" ON payment_methods
  FOR SELECT USING (
    is_active = true AND tenant_id IN (SELECT id FROM tenants WHERE is_active = true)
  );

CREATE POLICY "payment_methods_modify_employees" ON payment_methods
  FOR ALL USING (is_employee_of_tenant(tenant_id))
  WITH CHECK (is_employee_of_tenant(tenant_id));

CREATE POLICY "payment_methods_service" ON payment_methods
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- CATEGORIES
-- Lectura pública (catálogo visible)
-- Escritura solo empleados del tenant
-- ============================================================
CREATE POLICY "categories_select_public" ON categories
  FOR SELECT USING (
    is_active = true AND tenant_id IN (SELECT id FROM tenants WHERE is_active = true)
  );

CREATE POLICY "categories_modify_employees" ON categories
  FOR ALL USING (is_employee_of_tenant(tenant_id))
  WITH CHECK (is_employee_of_tenant(tenant_id));

CREATE POLICY "categories_service" ON categories
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- PRODUCTS
-- Lectura pública (catálogo visible)
-- Escritura solo empleados del tenant
-- ============================================================
CREATE POLICY "products_select_public" ON products
  FOR SELECT USING (
    is_active = true AND tenant_id IN (SELECT id FROM tenants WHERE is_active = true)
  );

CREATE POLICY "products_modify_employees" ON products
  FOR ALL USING (is_employee_of_tenant(tenant_id))
  WITH CHECK (is_employee_of_tenant(tenant_id));

CREATE POLICY "products_service" ON products
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- BUSINESS_HOURS
-- Lectura pública (clientes ven horarios)
-- Escritura solo empleados del tenant
-- ============================================================
CREATE POLICY "business_hours_select_public" ON business_hours
  FOR SELECT USING (
    tenant_id IN (SELECT id FROM tenants WHERE is_active = true)
  );

CREATE POLICY "business_hours_modify_employees" ON business_hours
  FOR ALL USING (is_employee_of_tenant(tenant_id))
  WITH CHECK (is_employee_of_tenant(tenant_id));

CREATE POLICY "business_hours_service" ON business_hours
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- EMPLOYEES
-- Solo lectura por el propio empleado o empleados del mismo tenant
-- Escritura vía service_role o admin del tenant
-- ============================================================
CREATE POLICY "employees_select_own_tenant" ON employees
  FOR SELECT USING (is_employee_of_tenant(tenant_id));

CREATE POLICY "employees_insert_service" ON employees
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "employees_update_own" ON employees
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "employees_service" ON employees
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- ORDERS
-- Creación pública (clientes hacen pedidos sin login)
-- Lectura: empleados del tenant ven todos los pedidos del tenant
-- Lectura pública: solo por tracking_token (via API con service_role)
-- Actualización: solo empleados del tenant
-- ============================================================
CREATE POLICY "orders_insert_public" ON orders
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT id FROM tenants WHERE is_active = true)
  );

CREATE POLICY "orders_select_employees" ON orders
  FOR SELECT USING (is_employee_of_tenant(tenant_id));

CREATE POLICY "orders_update_employees" ON orders
  FOR UPDATE USING (is_employee_of_tenant(tenant_id));

CREATE POLICY "orders_service" ON orders
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- ORDER_ITEMS
-- Misma lógica que orders
-- ============================================================
CREATE POLICY "order_items_insert_public" ON order_items
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT id FROM tenants WHERE is_active = true)
  );

CREATE POLICY "order_items_select_employees" ON order_items
  FOR SELECT USING (is_employee_of_tenant(tenant_id));

CREATE POLICY "order_items_service" ON order_items
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- ORDER_PAYMENTS
-- Creación pública (clientes suben comprobantes)
-- Lectura/actualización: empleados del tenant
-- ============================================================
CREATE POLICY "order_payments_insert_public" ON order_payments
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT id FROM tenants WHERE is_active = true)
  );

CREATE POLICY "order_payments_select_employees" ON order_payments
  FOR SELECT USING (is_employee_of_tenant(tenant_id));

CREATE POLICY "order_payments_update_employees" ON order_payments
  FOR UPDATE USING (is_employee_of_tenant(tenant_id));

CREATE POLICY "order_payments_service" ON order_payments
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- ORDER_STATUS_HISTORY
-- Lectura: empleados + público vía tracking (se maneja en API)
-- Escritura: empleados del tenant
-- ============================================================
CREATE POLICY "order_status_history_insert_employees" ON order_status_history
  FOR INSERT WITH CHECK (is_employee_of_tenant(tenant_id));

CREATE POLICY "order_status_history_select_employees" ON order_status_history
  FOR SELECT USING (is_employee_of_tenant(tenant_id));

CREATE POLICY "order_status_history_service" ON order_status_history
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- STORAGE POLICIES (para comprobantes de pago y fotos de productos)
-- Se crean los buckets necesarios
-- ============================================================

-- Nota: Los buckets se crean via Supabase Dashboard o API.
-- Aquí dejamos la referencia de las policies necesarias:
--
-- Bucket: product-images
--   SELECT: público
--   INSERT/UPDATE/DELETE: solo empleados autenticados
--
-- Bucket: payment-proofs  
--   SELECT: solo empleados autenticados
--   INSERT: público (clientes suben comprobantes)
--   DELETE: solo empleados autenticados
--
-- Bucket: tenant-assets (logos, favicons)
--   SELECT: público
--   INSERT/UPDATE/DELETE: solo empleados autenticados
