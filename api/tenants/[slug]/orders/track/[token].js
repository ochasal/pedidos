/**
 * GET /api/tenants/:slug/orders/track/:token
 * Tracking público de pedido por token - no requiere auth
 */
const { apiHandler, success, notFound } = require('../../../../_lib/response');
const { withTenant } = require('../../../../_lib/tenant');
const { getServiceClient } = require('../../../../_lib/supabase');

module.exports = apiHandler(async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  return withTenant(req, res, async (req, res) => {
    const supabase = getServiceClient();

    // Extraer token de la URL
    const urlParts = req.url.split('/');
    const token = urlParts[urlParts.length - 1].split('?')[0];

    if (!token) {
      return notFound(res, 'Token de tracking requerido');
    }

    // Buscar orden por tracking token
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select(`
        id, order_number, tracking_token, status,
        customer_name, order_type, total, subtotal, delivery_fee,
        payment_complete, created_at, completed_at,
        order_items (product_name, quantity, subtotal),
        order_status_history (status, notes, created_at)
      `)
      .eq('tenant_id', req.tenant.id)
      .eq('tracking_token', token)
      .single();

    if (orderErr || !order) {
      return notFound(res, 'Pedido no encontrado');
    }

    // Ordenar historial por fecha
    if (order.order_status_history) {
      order.order_status_history.sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      );
    }

    return success(res, {
      order: {
        order_number: order.order_number,
        status: order.status,
        customer_name: order.customer_name,
        order_type: order.order_type,
        total: order.total,
        subtotal: order.subtotal,
        delivery_fee: order.delivery_fee,
        payment_complete: order.payment_complete,
        items: order.order_items,
        status_history: order.order_status_history,
        created_at: order.created_at,
        completed_at: order.completed_at
      }
    });
  });
});
