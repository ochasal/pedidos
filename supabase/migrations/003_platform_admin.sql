-- ============================================================
-- PLATAFORMA MULTI-TENANT DE PEDIDOS
-- Migración 003: Super-Admin de Plataforma
-- ============================================================

-- Tabla: platform_admins
-- Usuarios con acceso al panel de plataforma (super-admins)
-- NO están vinculados a ningún tenant
CREATE TABLE platform_admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Índice
CREATE INDEX idx_platform_admins_user ON platform_admins(user_id);

-- Trigger updated_at
CREATE TRIGGER tr_platform_admins_updated_at 
  BEFORE UPDATE ON platform_admins 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

-- Solo service_role puede leer/escribir platform_admins
CREATE POLICY "platform_admins_service_only" ON platform_admins
  FOR ALL USING (auth.role() = 'service_role');

-- Función helper: verificar si el usuario actual es platform admin
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM platform_admins 
    WHERE user_id = auth.uid() AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- STORAGE BUCKETS
-- Crear buckets necesarios para la plataforma
-- (ejecutar también desde Supabase Dashboard si es necesario)
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('product-images', 'product-images', true),
  ('payment-proofs', 'payment-proofs', false),
  ('tenant-assets', 'tenant-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: product-images (público lectura, auth escritura)
CREATE POLICY "product_images_select_public" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "product_images_insert_auth" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');

CREATE POLICY "product_images_update_auth" ON storage.objects
  FOR UPDATE USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');

CREATE POLICY "product_images_delete_auth" ON storage.objects
  FOR DELETE USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');

-- Storage policies: payment-proofs (público insert, auth lectura)
CREATE POLICY "payment_proofs_insert_public" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'payment-proofs');

CREATE POLICY "payment_proofs_select_auth" ON storage.objects
  FOR SELECT USING (bucket_id = 'payment-proofs' AND auth.role() = 'authenticated');

-- Storage policies: tenant-assets (público lectura, auth escritura)
CREATE POLICY "tenant_assets_select_public" ON storage.objects
  FOR SELECT USING (bucket_id = 'tenant-assets');

CREATE POLICY "tenant_assets_insert_auth" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'tenant-assets' AND auth.role() = 'authenticated');

CREATE POLICY "tenant_assets_update_auth" ON storage.objects
  FOR UPDATE USING (bucket_id = 'tenant-assets' AND auth.role() = 'authenticated');
