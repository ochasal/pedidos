/**
 * Super-Admin: Gestión de Tenants
 * GET    /api/platform/tenants - Listar todos los tenants
 * POST   /api/platform/tenants - Crear nuevo tenant + owner
 * PUT    /api/platform/tenants?id=xxx - Actualizar tenant
 * PATCH  /api/platform/tenants?id=xxx - Toggle activo/inactivo
 */
const { apiHandler, success, error: errorRes } = require('../_lib/response');
const { withPlatformAdmin } = require('../_lib/platform-auth');
const { getServiceClient } = require('../_lib/supabase');

module.exports = apiHandler(async (req, res) => {
  return withPlatformAdmin(req, res, handler);
});

async function handler(req, res) {
  const supabase = getServiceClient();
  const url = new URL(req.url, `http://${req.headers.host}`);
  const id = url.searchParams.get('id');

  switch (req.method) {
    case 'GET': {
      const { data: tenants, error } = await supabase
        .from('tenants')
        .select(`
          *,
          tenant_config (primary_color, logo_url, tagline),
          employees (id, name, role, is_active)
        `)
        .order('created_at', { ascending: false });

      if (error) return res.status(500).json({ error: 'Error cargando tenants' });

      // Enriquecer con conteo de pedidos
      const enriched = await Promise.all(tenants.map(async (t) => {
        const { count } = await supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', t.id);

        return {
          ...t,
          orders_count: count || 0,
          employees_count: t.employees?.filter(e => e.is_active).length || 0,
          employees: undefined
        };
      }));

      return success(res, { tenants: enriched });
    }

    case 'POST': {
      const body = req.body;

      if (!body.slug || !body.name) {
        return errorRes(res, 'slug y name son requeridos');
      }

      // Validar slug
      const slugRegex = /^[a-z0-9-]+$/;
      if (!slugRegex.test(body.slug)) {
        return errorRes(res, 'El slug solo puede contener letras minúsculas, números y guiones');
      }

      // Verificar slug único
      const { data: existing } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', body.slug)
        .single();

      if (existing) {
        return errorRes(res, 'Este slug ya está en uso');
      }

      // Crear tenant
      const { data: tenant, error: tenantErr } = await supabase
        .from('tenants')
        .insert({ slug: body.slug, name: body.name, is_active: true })
        .select()
        .single();

      if (tenantErr) {
        console.error('Error creando tenant:', tenantErr);
        return res.status(500).json({ error: 'Error creando tenant' });
      }

      // Crear config inicial
      const { error: cfgErr } = await supabase
        .from('tenant_config')
        .insert({
          tenant_id: tenant.id,
          primary_color: body.primary_color || '#2563eb',
          tagline: body.tagline || '',
          delivery_enabled: true,
          pickup_enabled: true,
          require_full_payment_before_delivery: true,
          allow_cash_without_prepayment: true,
          auto_close_after_hours: true
        });

      if (cfgErr) console.error('Error creando config:', cfgErr);

      // Si se proporcionó email de owner, crear usuario + employee
      if (body.owner_email && body.owner_name) {
        let userId = null;

        // Intentar crear usuario
        const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
          email: body.owner_email,
          password: body.owner_password || generatePassword(),
          email_confirm: true
        });

        if (authErr) {
          // Si ya existe, buscar su ID
          if (authErr.message.includes('already been registered')) {
            const { data: { users } } = await supabase.auth.admin.listUsers();
            const found = users.find(u => u.email === body.owner_email);
            if (found) userId = found.id;
          }
        } else {
          userId = authData.user.id;
        }

        if (userId) {
          await supabase.from('employees').insert({
            tenant_id: tenant.id,
            user_id: userId,
            name: body.owner_name,
            role: 'owner',
            is_active: true
          });
        }
      }

      // Crear moneda base por defecto (USD)
      await supabase.from('currencies').insert({
        tenant_id: tenant.id,
        code: 'USD',
        name: 'Dólar Estadounidense',
        symbol: '$',
        is_base: true,
        is_active: true
      });

      return success(res, { tenant }, 201);
    }

    case 'PUT': {
      if (!id) return errorRes(res, 'ID requerido');
      const body = req.body;

      const updateData = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.is_active !== undefined) updateData.is_active = body.is_active;

      const { data, error } = await supabase
        .from('tenants')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) return res.status(500).json({ error: 'Error actualizando tenant' });
      return success(res, { tenant: data });
    }

    case 'PATCH': {
      if (!id) return errorRes(res, 'ID requerido');

      const { data: current } = await supabase
        .from('tenants')
        .select('is_active')
        .eq('id', id)
        .single();

      if (!current) return res.status(404).json({ error: 'Tenant no encontrado' });

      const { data, error } = await supabase
        .from('tenants')
        .update({ is_active: !current.is_active })
        .eq('id', id)
        .select()
        .single();

      if (error) return res.status(500).json({ error: 'Error actualizando tenant' });
      return success(res, { tenant: data });
    }

    default:
      return res.status(405).json({ error: 'Método no permitido' });
  }
}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  let pass = '';
  for (let i = 0; i < 14; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}
