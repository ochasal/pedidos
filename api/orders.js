/**
 * /api/orders - Crear pedidos + tracking público (consolidado)
 * Query params: slug (requerido), action (create, track, pay)
 */
const { apiHandler, success, error: errorRes, notFound } = require('./_lib/response');
const { resolveTenant } = require('./_lib/tenant');
const { getServiceClient } = require('./_lib/supabase');

module.exports = apiHandler(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const slug = url.searchParams.get('slug');
  const action = url.searchParams.get('action');

  if (!slug) return errorRes(res, 'slug param requerido');
  const tenant = await resolveTenant(slug);
  if (!tenant) return notFound(res, `Tenant '${slug}' no encontrado`);

  switch (action) {
    case 'create': return createOrder(req, res, tenant);
    case 'track': return trackOrder(req, res, tenant, url);
    case 'pay': return submitPayment(req, res, tenant);
    default: return errorRes(res, 'action requerido: create, track, pay');
  }
});

async function createOrder(req, res, tenant) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requerido' });
  const supabase = getServiceClient();
  const body = req.body;

  if (!body.customer_name || !body.customer_phone) return errorRes(res, 'Nombre y teléfono requeridos');
  if (!body.items || !body.items.length) return errorRes(res, 'Al menos un producto requerido');

  const productIds = body.items.map(i => i.product_id);
  const { data: products } = await supabase.from('products').select('id, name, price, is_available, currency_id').eq('tenant_id', tenant.id).eq('is_active', true).in('id', productIds);

  const unavailable = body.items.filter(item => !(products || []).find(p => p.id === item.product_id && p.is_available));
  if (unavailable.length > 0) return errorRes(res, 'Algunos productos no están disponibles');

  let subtotal = 0;
  const orderItems = body.items.map(item => {
    const product = products.find(p => p.id === item.product_id);
    const itemSub = product.price * (item.quantity || 1);
    subtotal += itemSub;
    return { tenant_id: tenant.id, product_id: product.id, product_name: product.name, product_price: product.price, quantity: item.quantity || 1, subtotal: itemSub, options: item.options || {}, notes: item.notes || null };
  });

  const deliveryFee = body.order_type === 'delivery' ? (tenant.config.delivery_fee || 0) : 0;
  const total = subtotal + parseFloat(deliveryFee);

  const { data: order, error: orderErr } = await supabase.from('orders').insert({
    tenant_id: tenant.id, customer_name: body.customer_name, customer_phone: body.customer_phone,
    customer_email: body.customer_email || null, customer_address: body.customer_address || null,
    order_type: body.order_type || 'delivery', notes: body.notes || null,
    subtotal, delivery_fee: deliveryFee, total, source: body.source || 'web', status: 'recibido'
  }).select().single();

  if (orderErr) return res.status(500).json({ error: 'Error creando pedido' });

  await supabase.from('order_items').insert(orderItems.map(i => ({ ...i, order_id: order.id })));
  await supabase.from('order_status_history').insert({ tenant_id: tenant.id, order_id: order.id, status: 'recibido', notes: 'Pedido creado' });

  return success(res, { order: { id: order.id, order_number: order.order_number, tracking_token: order.tracking_token, status: order.status, total: order.total }, tracking_url: `/${tenant.slug}/pedido/${order.tracking_token}` }, 201);
}

async function trackOrder(req, res, tenant, url) {
  const token = url.searchParams.get('token');
  if (!token) return errorRes(res, 'token requerido');

  const supabase = getServiceClient();
  const { data: order } = await supabase.from('orders').select('id, order_number, tracking_token, status, customer_name, order_type, total, subtotal, delivery_fee, payment_complete, created_at, completed_at, order_items(product_name, quantity, subtotal), order_status_history(status, notes, created_at)').eq('tenant_id', tenant.id).eq('tracking_token', token).single();

  if (!order) return notFound(res, 'Pedido no encontrado');
  if (order.order_status_history) order.order_status_history.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  return success(res, { order: { order_number: order.order_number, status: order.status, customer_name: order.customer_name, order_type: order.order_type, total: order.total, subtotal: order.subtotal, delivery_fee: order.delivery_fee, payment_complete: order.payment_complete, items: order.order_items, status_history: order.order_status_history, created_at: order.created_at, completed_at: order.completed_at } });
}

async function submitPayment(req, res, tenant) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requerido' });
  const supabase = getServiceClient();
  const body = req.body;

  if (!body.order_id || !body.payment_method_id || !body.amount) return errorRes(res, 'order_id, payment_method_id y amount requeridos');

  const { data: order } = await supabase.from('orders').select('id, status, total, total_paid').eq('id', body.order_id).eq('tenant_id', tenant.id).single();
  if (!order) return notFound(res, 'Pedido no encontrado');
  if (['completado', 'cancelado'].includes(order.status)) return errorRes(res, 'Pedido cerrado');

  const { data: method } = await supabase.from('payment_methods').select('id, currency_id, requires_proof, type').eq('id', body.payment_method_id).eq('tenant_id', tenant.id).eq('is_active', true).single();
  if (!method) return errorRes(res, 'Método de pago no válido');

  if (method.requires_proof && !body.proof_url && !body.reference_number) return errorRes(res, 'Comprobante o referencia requeridos');

  let amountInBase = parseFloat(body.amount);
  let exchangeRateUsed = null;
  const { data: baseCurrency } = await supabase.from('currencies').select('id').eq('tenant_id', tenant.id).eq('is_base', true).single();

  if (baseCurrency && method.currency_id !== baseCurrency.id) {
    const { data: rate } = await supabase.from('exchange_rates').select('rate').eq('tenant_id', tenant.id).eq('from_currency_id', baseCurrency.id).eq('to_currency_id', method.currency_id).eq('is_active', true).single();
    if (rate) { amountInBase = parseFloat(body.amount) / rate.rate; exchangeRateUsed = rate.rate; }
  }

  const { data: payment, error: payErr } = await supabase.from('order_payments').insert({
    tenant_id: tenant.id, order_id: body.order_id, payment_method_id: body.payment_method_id,
    amount: parseFloat(body.amount), currency_id: method.currency_id, amount_in_base: amountInBase,
    exchange_rate_used: exchangeRateUsed, reference_number: body.reference_number || null,
    proof_url: body.proof_url || null, status: method.type === 'cash' ? 'verified' : 'pending'
  }).select().single();

  if (payErr) return res.status(500).json({ error: 'Error registrando pago' });

  if (method.type === 'cash') {
    const newTotal = parseFloat(order.total_paid) + amountInBase;
    await supabase.from('orders').update({ total_paid: newTotal, payment_complete: newTotal >= parseFloat(order.total) }).eq('id', order.id);
  }

  return success(res, { payment }, 201);
}
