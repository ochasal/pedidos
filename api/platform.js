/**
 * /api/platform - Super-Admin de Plataforma (consolidado)
 * Query param "action": dashboard, tenants
 */
const { apiHandler, success, error: errorRes } = require('./_lib/response');
const { withPlatformAdmin } = require('./_lib/platform-auth');
const { getServiceClient } = require('./_lib/supabase');

module.exports = apiHandler(async (req, res) => {
  return withPlatformAdmin(req, res, handler);
});

async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get('action');

  switch (action) {
    case 'dashboard': return handleDashboard(req, res);
    case 'tenants': return handleTenants(req, res, url);
    default: return errorRes(res, 'action requerido: dashboard, tenants');
  }
}

async function handleDashboard(req, res) {
  const supabase = getServiceClient();
  const today = new Date(); today.setHours(0,0,0,0);
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);

  const { count: totalTenants } = await supabase.from('tenants').select('id', { count: 'exact', head: true });
  const { count: activeTenants } = await supabase.from('tenants').select('id', { count: 'exact', head: true }).eq('is_active', true);
  const { count: todayOrders } = await supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', today.toISOString());
  const { count: weekOrders } = await supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString());
  const { data: todayCompleted } = await supabase.from('orders').select('total').gte('created_at', today.toISOString()).eq('status', 'completado');
  const todayRevenue = (todayCompleted || []).reduce((s, o) => s + parseFloat(o.total), 0);
  const { count: totalEmployees } = await supabase.from('employees').select('id', { count: 'exact', head: true }).eq('is_active', true);

  const { data: tenants } = await supabase.from('tenants').select('id, slug, name, is_active').order('created_at', { ascending: false }).limit(10);
  const tenantStats = await Promise.all((tenants || []).map(async (t) => {
    const { count } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('tenant_id', t.id).gte('created_at', weekAgo.toISOString());
    return { ...t, orders_this_week: count || 0 };
  }));

  return success(res, {
    overview: { total_tenants: totalTenants || 0, active_tenants: activeTenants || 0, total_employees: totalEmployees || 0 },
    today: { orders: todayOrders || 0, revenue: todayRevenue },
    week: { orders: weekOrders || 0 },
    tenants_activity: tenantStats.sort((a, b) => b.orders_this_week - a.orders_this_week)
  });
}

async function handleTenants(req, res, url) {
  const supabase = getServiceClient();
  const id = url.searchParams.get('id');

  switch (req.method) {
    case 'GET': {
      const { data: tenants, error } = await supabase.from('tenants').select('*, tenant_config(primary_color, logo_url, tagline)').order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: 'Error cargando tenants' });
      const enriched = await Promise.all(tenants.map(async (t) => {
        const { count } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('tenant_id', t.id);
        const { count: empCount } = await supabase.from('employees').select('id', { count: 'exact', head: true }).eq('tenant_id', t.id).eq('is_active', true);
        return { ...t, orders_count: count || 0, employees_count: empCount || 0 };
      }));
      return success(res, { tenants: enriched });
    }
    case 'POST': {
      const body = req.body;
      if (!body.slug || !body.name) return errorRes(res, 'slug y name requeridos');
      if (!/^[a-z0-9-]+$/.test(body.slug)) return errorRes(res, 'Slug: solo minúsculas, números y guiones');
      const { data: existing } = await supabase.from('tenants').select('id').eq('slug', body.slug).single();
      if (existing) return errorRes(res, 'Slug ya en uso');
      const { data: tenant, error: tErr } = await supabase.from('tenants').insert({ slug: body.slug, name: body.name, is_active: true }).select().single();
      if (tErr) return res.status(500).json({ error: 'Error creando tenant' });
      await supabase.from('tenant_config').insert({ tenant_id: tenant.id, primary_color: body.primary_color || '#2563eb', tagline: body.tagline || '', delivery_enabled: true, pickup_enabled: true, require_full_payment_before_delivery: true, allow_cash_without_prepayment: true, auto_close_after_hours: true });
      await supabase.from('currencies').insert({ tenant_id: tenant.id, code: 'USD', name: 'Dólar Estadounidense', symbol: '$', is_base: true, is_active: true });
      if (body.owner_email && body.owner_name) {
        let userId = null;
        const { data: authData, error: authErr } = await supabase.auth.admin.createUser({ email: body.owner_email, password: body.owner_password || 'Temp1234!', email_confirm: true });
        if (authErr && authErr.message.includes('already been registered')) {
          const { data: { users } } = await supabase.auth.admin.listUsers();
          const found = users.find(u => u.email === body.owner_email);
          if (found) userId = found.id;
        } else if (authData) { userId = authData.user.id; }
        if (userId) await supabase.from('employees').insert({ tenant_id: tenant.id, user_id: userId, name: body.owner_name, role: 'owner', is_active: true });
      }
      return success(res, { tenant }, 201);
    }
    case 'PATCH': {
      if (!id) return errorRes(res, 'ID requerido');
      const { data: current } = await supabase.from('tenants').select('is_active').eq('id', id).single();
      if (!current) return res.status(404).json({ error: 'No encontrado' });
      const { data } = await supabase.from('tenants').update({ is_active: !current.is_active }).eq('id', id).select().single();
      return success(res, { tenant: data });
    }
    default: return res.status(405).json({ error: 'Método no permitido' });
  }
}
