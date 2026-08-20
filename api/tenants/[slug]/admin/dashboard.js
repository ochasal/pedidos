/**
 * Admin: Dashboard / Estadísticas
 * GET /api/tenants/:slug/admin/dashboard
 * Retorna métricas del día y resumen general
 */
const { apiHandler, success } = require('../../../_lib/response');
const { withTenant, withEmployeeAuth } = require('../../../_lib/tenant');
const { getServiceClient } = require('../../../_lib/supabase');

module.exports = apiHandler(async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  return withTenant(req, res, (req, res) => {
    return withEmployeeAuth(req, res, handler);
  });
});

async function handler(req, res) {
  const supabase = getServiceClient();
  const tenantId = req.tenant.id;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  // Pedidos de hoy
  const { data: todayOrders, count: todayCount } = await supabase
    .from('orders')
    .select('id, total, status, payment_complete', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .gte('created_at', todayISO);

  // Ingresos de hoy (pedidos completados)
  const todayRevenue = (todayOrders || [])
    .filter(o => o.status === 'completado')
    .reduce((sum, o) => sum + parseFloat(o.total), 0);

  // Pedidos pendientes (activos, no completados ni cancelados)
  const { count: pendingCount } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .not('status', 'in', '("completado","cancelado")');

  // Pagos pendientes de verificación
  const { count: pendingPayments } = await supabase
    .from('order_payments')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'pending');

  // Pedidos por estado (hoy)
  const statusCounts = {};
  (todayOrders || []).forEach(o => {
    statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
  });

  // Pedidos últimos 7 días
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);

  const { data: weekOrders } = await supabase
    .from('orders')
    .select('total, status, created_at')
    .eq('tenant_id', tenantId)
    .gte('created_at', weekAgo.toISOString())
    .eq('status', 'completado');

  const weekRevenue = (weekOrders || [])
    .reduce((sum, o) => sum + parseFloat(o.total), 0);

  // Productos activos
  const { count: productsCount } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  return success(res, {
    today: {
      orders: todayCount || 0,
      revenue: todayRevenue,
      by_status: statusCounts
    },
    pending: {
      orders: pendingCount || 0,
      payments: pendingPayments || 0
    },
    week: {
      revenue: weekRevenue,
      orders_completed: (weekOrders || []).length
    },
    totals: {
      active_products: productsCount || 0
    }
  });
}
