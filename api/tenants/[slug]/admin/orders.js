/**
 * Admin: Gestión de Pedidos
 * GET /api/tenants/:slug/admin/orders - Listar con filtros
 * GET /api/tenants/:slug/admin/orders?id=xxx - Detalle completo de un pedido
 */
const { apiHandler, success, error: errorRes } = require('../../../_lib/response');
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
  const url = new URL(req.url, `http://${req.headers.host}`);
  const id = url.searchParams.get('id');

  // Detalle de un pedido específico
  if (id) {
    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id, product_name, product_price, quantity, subtotal, options, notes
        ),
        order_payments (
          id, amount, amount_in_base, exchange_rate_used, reference_number,
          proof_url, status, verified_at, rejection_reason, created_at,
          payment_methods (id, name, type),
          currencies (id, code, symbol)
        ),
        order_status_history (
          id, status, notes, created_at,
          employees:changed_by (name)
        )
      `)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !order) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    // Ordenar historial
    if (order.order_status_history) {
      order.order_status_history.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }

    return success(res, { order });
  }

  // Listado con filtros
  const status = url.searchParams.get('status');
  const source = url.searchParams.get('source');
  const search = url.searchParams.get('search');
  const dateFrom = url.searchParams.get('from');
  const dateTo = url.searchParams.get('to');
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '25');
  const offset = (page - 1) * limit;

  let query = supabase
    .from('orders')
    .select(`
      id, order_number, tracking_token, status, customer_name, customer_phone,
      order_type, total, total_paid, payment_complete, source, created_at,
      order_items (id),
      order_payments (id, status)
    `, { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);
  if (source) query = query.eq('source', source);
  if (search) {
    query = query.or(`customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`);
  }
  if (dateFrom) query = query.gte('created_at', dateFrom);
  if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59');

  const { data: orders, error, count } = await query;

  if (error) {
    console.error('Error listando pedidos:', error);
    return res.status(500).json({ error: 'Error cargando pedidos' });
  }

  // Enriquecer con conteos
  const enriched = orders.map(o => ({
    ...o,
    items_count: o.order_items?.length || 0,
    pending_payments: o.order_payments?.filter(p => p.status === 'pending').length || 0,
    order_items: undefined,
    order_payments: undefined
  }));

  return success(res, {
    orders: enriched,
    pagination: {
      page,
      limit,
      total: count,
      pages: Math.ceil(count / limit)
    }
  });
}
