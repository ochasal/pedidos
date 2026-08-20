/**
 * POST /api/tenants/:slug/orders - Crear pedido (público)
 * GET  /api/tenants/:slug/orders - Listar pedidos (requiere auth de empleado)
 */
const { apiHandler, success, error: errorRes } = require('../../../_lib/response');
const { withTenant, withEmployeeAuth } = require('../../../_lib/tenant');
const { getServiceClient } = require('../../../_lib/supabase');

module.exports = apiHandler(async (req, res) => {
  return withTenant(req, res, async (req, res) => {
    switch (req.method) {
      case 'POST':
        return createOrder(req, res);
      case 'GET':
        return withEmployeeAuth(req, res, listOrders);
      default:
        return res.status(405).json({ error: 'Método no permitido' });
    }
  });
});

/**
 * Crear pedido - acceso público
 */
async function createOrder(req, res) {
  const supabase = getServiceClient();
  const tenantId = req.tenant.id;
  const body = req.body;

  // Validaciones básicas
  if (!body.customer_name || !body.customer_phone) {
    return errorRes(res, 'Nombre y teléfono del cliente son requeridos');
  }

  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    return errorRes(res, 'El pedido debe tener al menos un producto');
  }

  // Verificar que los productos existen y obtener precios actuales
  const productIds = body.items.map(i => i.product_id);
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id, name, price, is_available, currency_id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .in('id', productIds);

  if (prodErr || !products) {
    return errorRes(res, 'Error verificando productos');
  }

  // Validar disponibilidad
  const unavailable = body.items.filter(
    item => !products.find(p => p.id === item.product_id && p.is_available)
  );
  if (unavailable.length > 0) {
    return errorRes(res, 'Algunos productos no están disponibles');
  }

  // Calcular totales
  let subtotal = 0;
  const orderItems = body.items.map(item => {
    const product = products.find(p => p.id === item.product_id);
    const itemSubtotal = product.price * (item.quantity || 1);
    subtotal += itemSubtotal;
    return {
      tenant_id: tenantId,
      product_id: product.id,
      product_name: product.name,
      product_price: product.price,
      quantity: item.quantity || 1,
      subtotal: itemSubtotal,
      options: item.options || {},
      notes: item.notes || null
    };
  });

  // Obtener fee de delivery
  const deliveryFee = body.order_type === 'delivery' 
    ? (req.tenant.config.delivery_fee || 0) 
    : 0;
  const total = subtotal + deliveryFee;

  // Crear orden
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      tenant_id: tenantId,
      customer_name: body.customer_name,
      customer_phone: body.customer_phone,
      customer_email: body.customer_email || null,
      customer_address: body.customer_address || null,
      order_type: body.order_type || 'delivery',
      notes: body.notes || null,
      subtotal,
      delivery_fee: deliveryFee,
      total,
      source: body.source || 'web',
      status: 'recibido'
    })
    .select()
    .single();

  if (orderErr) {
    console.error('Error creando orden:', orderErr);
    return res.status(500).json({ error: 'Error creando pedido' });
  }

  // Insertar items
  const itemsWithOrder = orderItems.map(item => ({
    ...item,
    order_id: order.id
  }));

  const { error: itemsErr } = await supabase
    .from('order_items')
    .insert(itemsWithOrder);

  if (itemsErr) {
    console.error('Error insertando items:', itemsErr);
  }

  // Insertar primer estado en historial
  await supabase.from('order_status_history').insert({
    tenant_id: tenantId,
    order_id: order.id,
    status: 'recibido',
    notes: 'Pedido creado'
  });

  return success(res, {
    order: {
      id: order.id,
      order_number: order.order_number,
      tracking_token: order.tracking_token,
      status: order.status,
      total: order.total
    },
    tracking_url: `/${req.tenant.slug}/pedido/${order.tracking_token}`
  }, 201);
}

/**
 * Listar pedidos - solo empleados autenticados
 */
async function listOrders(req, res) {
  const supabase = getServiceClient();
  const tenantId = req.tenant.id;

  // Query params
  const url = new URL(req.url, `http://${req.headers.host}`);
  const status = url.searchParams.get('status');
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const offset = (page - 1) * limit;

  let query = supabase
    .from('orders')
    .select('*, order_items(*), order_payments(*)', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }

  const { data: orders, error: ordersErr, count } = await query;

  if (ordersErr) {
    return res.status(500).json({ error: 'Error cargando pedidos' });
  }

  return success(res, {
    orders,
    pagination: {
      page,
      limit,
      total: count,
      pages: Math.ceil(count / limit)
    }
  });
}
