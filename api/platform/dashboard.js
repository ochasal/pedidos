/**
 * Super-Admin: Dashboard de Plataforma
 * GET /api/platform/dashboard - Métricas globales
 */
const { apiHandler, success } = require('../_lib/response');
const { withPlatformAdmin } = require('../_lib/platform-auth');
const { getServiceClient } = require('../_lib/supabase');

module.exports = apiHandler(async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  return withPlatformAdmin(req, res, handler);
});

async function handler(req, res) {
  const supabase = getServiceClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  // Total tenants
  const { count: totalTenants } = await supabase
    .from('tenants')
    .select('id', { count: 'exact', head: true });

  const { count: activeTenants } = await supabase
    .from('tenants')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);

  // Pedidos hoy (global)
  const { count: todayOrders } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', todayISO);

  // Pedidos semana (global)
  const { count: weekOrders } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', weekAgo.toISOString());

  // Ingresos globales hoy
  const { data: todayCompleted } = await supabase
    .from('orders')
    .select('total')
    .gte('created_at', todayISO)
    .eq('status', 'completado');

  const todayRevenue = (todayCompleted || []).reduce((sum, o) => sum + parseFloat(o.total), 0);

  // Pedidos por tenant (top 10)
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, slug, name, is_active')
    .order('created_at', { ascending: false });

  const tenantStats = await Promise.all((tenants || []).slice(0, 10).map(async (t) => {
    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', t.id)
      .gte('created_at', weekAgo.toISOString());

    return { ...t, orders_this_week: count || 0 };
  }));

  // Total empleados
  const { count: totalEmployees } = await supabase
    .from('employees')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);

  return success(res, {
    overview: {
      total_tenants: totalTenants || 0,
      active_tenants: activeTenants || 0,
      total_employees: totalEmployees || 0
    },
    today: {
      orders: todayOrders || 0,
      revenue: todayRevenue
    },
    week: {
      orders: weekOrders || 0
    },
    tenants_activity: tenantStats.sort((a, b) => b.orders_this_week - a.orders_this_week)
  });
}
