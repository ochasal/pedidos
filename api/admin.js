/**
 * /api/admin - Panel Admin del Tenant (consolidado)
 * Query params: slug, action (dashboard, orders, order-detail, order-status, verify-payment,
 *   products, categories, config, currencies, exchange-rates, payment-methods, hours, employees)
 */
const { apiHandler, success, error: errorRes } = require('./_lib/response');
const { resolveTenant } = require('./_lib/tenant');
const { getServiceClient, getUser } = require('./_lib/supabase');

module.exports = apiHandler(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const slug = url.searchParams.get('slug');
  const action = url.searchParams.get('action');

  if (!slug) return errorRes(res, 'slug requerido');
  const tenant = await resolveTenant(slug);
  if (!tenant) return res.status(404).json({ error: 'Tenant no encontrado' });

  // Auth check
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'No autenticado' });

  const supabase = getServiceClient();
  const { data: employee } = await supabase.from('employees').select('*').eq('user_id', user.id).eq('tenant_id', tenant.id).eq('is_active', true).single();
  if (!employee) return res.status(403).json({ error: 'Sin acceso a este negocio' });

  req.tenant = tenant;
  req.employee = employee;

  switch (action) {
    case 'dashboard': return adminDashboard(req, res);
    case 'orders': return adminOrders(req, res, url);
    case 'order-detail': return adminOrderDetail(req, res, url);
    case 'order-status': return adminOrderStatus(req, res, url);
    case 'verify-payment': return adminVerifyPayment(req, res);
    case 'products': return adminProducts(req, res, url);
    case 'categories': return adminCategories(req, res, url);
    case 'config': return adminConfig(req, res);
    case 'currencies': return adminCurrencies(req, res, url);
    case 'exchange-rates': return adminExchangeRates(req, res, url);
    case 'payment-methods': return adminPaymentMethods(req, res, url);
    case 'hours': return adminHours(req, res);
    case 'employees': return adminEmployees(req, res, url);
    default: return errorRes(res, 'action inválido');
  }
});

async function adminDashboard(req, res) {
  const supabase = getServiceClient();
  const tid = req.tenant.id;
  const today = new Date(); today.setHours(0,0,0,0);
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);

  const { data: todayOrders, count: todayCount } = await supabase.from('orders').select('id, total, status', { count: 'exact' }).eq('tenant_id', tid).gte('created_at', today.toISOString());
  const todayRevenue = (todayOrders || []).filter(o => o.status === 'completado').reduce((s, o) => s + parseFloat(o.total), 0);
  const { count: pendingCount } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).not('status', 'in', '("completado","cancelado")');
  const { count: pendingPayments } = await supabase.from('order_payments').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).eq('status', 'pending');
  const statusCounts = {}; (todayOrders || []).forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });
  const { data: weekOrders } = await supabase.from('orders').select('total').eq('tenant_id', tid).gte('created_at', weekAgo.toISOString()).eq('status', 'completado');
  const weekRevenue = (weekOrders || []).reduce((s, o) => s + parseFloat(o.total), 0);
  const { count: productsCount } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).eq('is_active', true);

  return success(res, { today: { orders: todayCount || 0, revenue: todayRevenue, by_status: statusCounts }, pending: { orders: pendingCount || 0, payments: pendingPayments || 0 }, week: { revenue: weekRevenue, orders_completed: (weekOrders || []).length }, totals: { active_products: productsCount || 0 } });
}

async function adminOrders(req, res, url) {
  const supabase = getServiceClient();
  const tid = req.tenant.id;
  const status = url.searchParams.get('status');
  const search = url.searchParams.get('search');
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '25');
  const offset = (page - 1) * limit;

  let query = supabase.from('orders').select('id, order_number, tracking_token, status, customer_name, customer_phone, order_type, total, total_paid, payment_complete, source, created_at, order_items(id), order_payments(id, status)', { count: 'exact' }).eq('tenant_id', tid).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  if (status) query = query.eq('status', status);
  if (search) query = query.or(`customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`);

  const { data: orders, count } = await query;
  const enriched = (orders || []).map(o => ({ ...o, items_count: o.order_items?.length || 0, pending_payments: o.order_payments?.filter(p => p.status === 'pending').length || 0, order_items: undefined, order_payments: undefined }));
  return success(res, { orders: enriched, pagination: { page, limit, total: count, pages: Math.ceil((count || 0) / limit) } });
}

async function adminOrderDetail(req, res, url) {
  const supabase = getServiceClient();
  const id = url.searchParams.get('id');
  if (!id) return errorRes(res, 'id requerido');

  const { data: order } = await supabase.from('orders').select('*, order_items(id, product_name, product_price, quantity, subtotal, options, notes), order_payments(id, amount, amount_in_base, exchange_rate_used, reference_number, proof_url, status, verified_at, rejection_reason, created_at, payment_methods(id, name, type), currencies(id, code, symbol)), order_status_history(id, status, notes, created_at, employees:changed_by(name))').eq('id', id).eq('tenant_id', req.tenant.id).single();
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
  if (order.order_status_history) order.order_status_history.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  return success(res, { order });
}

async function adminOrderStatus(req, res, url) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requerido' });
  const supabase = getServiceClient();
  const body = req.body;
  if (!body.order_id || !body.status) return errorRes(res, 'order_id y status requeridos');

  const VALID = { 'recibido': ['procesando_pago','en_preparacion','cancelado'], 'procesando_pago': ['en_preparacion','cancelado'], 'en_preparacion': ['preparado','cancelado'], 'preparado': ['en_camino','cancelado'], 'en_camino': ['completado','cancelado'] };

  const { data: order } = await supabase.from('orders').select('*').eq('id', body.order_id).eq('tenant_id', req.tenant.id).single();
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
  if (['completado', 'cancelado'].includes(order.status)) return errorRes(res, 'Pedido cerrado');
  if (!(VALID[order.status] || []).includes(body.status)) return errorRes(res, `Transición inválida de '${order.status}' a '${body.status}'`);

  if (['en_camino', 'completado'].includes(body.status) && !order.payment_complete) {
    if (!req.tenant.config.allow_cash_without_prepayment) return errorRes(res, 'Pago completo requerido');
  }

  const updateData = { status: body.status };
  if (body.status === 'completado') updateData.completed_at = new Date().toISOString();
  if (body.status === 'cancelado') { updateData.cancelled_at = new Date().toISOString(); updateData.cancellation_reason = body.reason || null; }

  const { data: updated } = await supabase.from('orders').update(updateData).eq('id', body.order_id).select().single();
  await supabase.from('order_status_history').insert({ tenant_id: req.tenant.id, order_id: body.order_id, status: body.status, changed_by: req.employee.id, notes: body.notes || body.reason || null });
  return success(res, { order: updated });
}

async function adminVerifyPayment(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requerido' });
  const supabase = getServiceClient();
  const body = req.body;
  if (!body.payment_id || !body.action) return errorRes(res, 'payment_id y action requeridos');

  const { data: payment } = await supabase.from('order_payments').select('*, orders!inner(id, total, total_paid, status)').eq('id', body.payment_id).eq('tenant_id', req.tenant.id).single();
  if (!payment) return res.status(404).json({ error: 'Pago no encontrado' });
  if (payment.status !== 'pending') return errorRes(res, 'Pago ya procesado');

  if (body.action === 'verify') {
    await supabase.from('order_payments').update({ status: 'verified', verified_by: req.employee.id, verified_at: new Date().toISOString() }).eq('id', body.payment_id);
    const newTotal = parseFloat(payment.orders.total_paid) + parseFloat(payment.amount_in_base);
    const complete = newTotal >= parseFloat(payment.orders.total);
    const orderUpdate = { total_paid: newTotal, payment_complete: complete };
    if (complete && payment.orders.status === 'procesando_pago') orderUpdate.status = 'en_preparacion';
    await supabase.from('orders').update(orderUpdate).eq('id', payment.orders.id);
    if (complete && payment.orders.status === 'procesando_pago') {
      await supabase.from('order_status_history').insert({ tenant_id: req.tenant.id, order_id: payment.orders.id, status: 'en_preparacion', changed_by: req.employee.id, notes: 'Pago completo verificado' });
    }
    return success(res, { message: 'Pago verificado', payment_complete: complete });
  } else {
    if (!body.reason) return errorRes(res, 'Razón requerida');
    await supabase.from('order_payments').update({ status: 'rejected', rejection_reason: body.reason, verified_by: req.employee.id, verified_at: new Date().toISOString() }).eq('id', body.payment_id);
    return success(res, { message: 'Pago rechazado' });
  }
}

async function adminProducts(req, res, url) {
  const supabase = getServiceClient();
  const tid = req.tenant.id;
  const id = url.searchParams.get('id');

  switch (req.method) {
    case 'GET': {
      const { data } = await supabase.from('products').select('*, categories(id, name), currencies(id, code, symbol)').eq('tenant_id', tid).order('sort_order');
      return success(res, { products: data || [] });
    }
    case 'POST': {
      const b = req.body;
      if (!b.name || !b.price || !b.currency_id) return errorRes(res, 'name, price, currency_id requeridos');
      const { data, error } = await supabase.from('products').insert({ tenant_id: tid, category_id: b.category_id || null, name: b.name, description: b.description || null, price: parseFloat(b.price), currency_id: b.currency_id, image_url: b.image_url || null, is_available: b.is_available !== false, is_active: true, sort_order: b.sort_order || 0, options: b.options || [] }).select('*, categories(id, name), currencies(id, code, symbol)').single();
      if (error) return res.status(500).json({ error: 'Error creando producto' });
      return success(res, { product: data }, 201);
    }
    case 'PUT': {
      if (!id) return errorRes(res, 'id requerido');
      const b = req.body;
      const u = {}; if (b.name !== undefined) u.name = b.name; if (b.description !== undefined) u.description = b.description; if (b.price !== undefined) u.price = parseFloat(b.price); if (b.currency_id !== undefined) u.currency_id = b.currency_id; if (b.category_id !== undefined) u.category_id = b.category_id; if (b.image_url !== undefined) u.image_url = b.image_url; if (b.is_available !== undefined) u.is_available = b.is_available; if (b.sort_order !== undefined) u.sort_order = b.sort_order; if (b.options !== undefined) u.options = b.options;
      const { data } = await supabase.from('products').update(u).eq('id', id).eq('tenant_id', tid).select('*, categories(id, name), currencies(id, code, symbol)').single();
      return success(res, { product: data });
    }
    case 'PATCH': {
      if (!id) return errorRes(res, 'id requerido');
      const { data: c } = await supabase.from('products').select('is_available').eq('id', id).eq('tenant_id', tid).single();
      const { data } = await supabase.from('products').update({ is_available: !c.is_available }).eq('id', id).eq('tenant_id', tid).select().single();
      return success(res, { product: data });
    }
    case 'DELETE': {
      if (!id) return errorRes(res, 'id requerido');
      await supabase.from('products').update({ is_active: false, is_available: false }).eq('id', id).eq('tenant_id', tid);
      return success(res, { message: 'Producto eliminado' });
    }
    default: return res.status(405).json({ error: 'Método no permitido' });
  }
}

async function adminCategories(req, res, url) {
  const supabase = getServiceClient(); const tid = req.tenant.id; const id = url.searchParams.get('id');
  switch (req.method) {
    case 'GET': { const { data } = await supabase.from('categories').select('*').eq('tenant_id', tid).order('sort_order'); return success(res, { categories: data || [] }); }
    case 'POST': { const b = req.body; if (!b.name) return errorRes(res, 'name requerido'); const { data } = await supabase.from('categories').insert({ tenant_id: tid, name: b.name, description: b.description || null, sort_order: b.sort_order || 0, is_active: true }).select().single(); return success(res, { category: data }, 201); }
    case 'PUT': { if (!id) return errorRes(res, 'id requerido'); const { data } = await supabase.from('categories').update(req.body).eq('id', id).eq('tenant_id', tid).select().single(); return success(res, { category: data }); }
    case 'DELETE': { if (!id) return errorRes(res, 'id requerido'); await supabase.from('categories').update({ is_active: false }).eq('id', id).eq('tenant_id', tid); return success(res, { message: 'Categoría eliminada' }); }
    default: return res.status(405).json({ error: 'Método no permitido' });
  }
}

async function adminConfig(req, res) {
  const supabase = getServiceClient(); const tid = req.tenant.id;
  if (req.method === 'GET') {
    const { data: config } = await supabase.from('tenant_config').select('*').eq('tenant_id', tid).single();
    const { data: tenant } = await supabase.from('tenants').select('id, slug, name').eq('id', tid).single();
    return success(res, { tenant, config });
  }
  if (req.method === 'PUT') {
    const b = req.body;
    if (b.name) await supabase.from('tenants').update({ name: b.name }).eq('id', tid);
    const fields = ['logo_url','favicon_url','primary_color','primary_color_dark','accent_color','tagline','phone','whatsapp_number','email','address','delivery_enabled','pickup_enabled','min_order_amount','delivery_fee','require_full_payment_before_delivery','allow_cash_without_prepayment','auto_close_after_hours','whatsapp_notifications_enabled','whatsapp_api_url','whatsapp_api_token'];
    const u = {}; fields.forEach(f => { if (b[f] !== undefined) u[f] = b[f]; });
    if (Object.keys(u).length) await supabase.from('tenant_config').update(u).eq('tenant_id', tid);
    return success(res, { message: 'Configuración actualizada' });
  }
  return res.status(405).json({ error: 'GET o PUT' });
}

async function adminCurrencies(req, res, url) {
  const supabase = getServiceClient(); const tid = req.tenant.id; const id = url.searchParams.get('id');
  switch (req.method) {
    case 'GET': { const { data } = await supabase.from('currencies').select('*').eq('tenant_id', tid).order('is_base', { ascending: false }); return success(res, { currencies: data || [] }); }
    case 'POST': { const b = req.body; if (!b.code || !b.name || !b.symbol) return errorRes(res, 'code, name, symbol requeridos'); const { data, error } = await supabase.from('currencies').insert({ tenant_id: tid, code: b.code.toUpperCase(), name: b.name, symbol: b.symbol, is_base: b.is_base || false, is_active: true }).select().single(); if (error) return errorRes(res, error.code === '23505' ? 'Moneda ya existe' : 'Error'); if (b.is_base) await supabase.from('currencies').update({ is_base: false }).eq('tenant_id', tid).neq('id', data.id); return success(res, { currency: data }, 201); }
    case 'PUT': { if (!id) return errorRes(res, 'id requerido'); const { data } = await supabase.from('currencies').update(req.body).eq('id', id).eq('tenant_id', tid).select().single(); if (req.body.is_base) await supabase.from('currencies').update({ is_base: false }).eq('tenant_id', tid).neq('id', id); return success(res, { currency: data }); }
    case 'DELETE': { if (!id) return errorRes(res, 'id requerido'); const { data: c } = await supabase.from('currencies').select('is_base').eq('id', id).single(); if (c?.is_base) return errorRes(res, 'No se puede eliminar moneda base'); await supabase.from('currencies').update({ is_active: false }).eq('id', id).eq('tenant_id', tid); return success(res, { message: 'Eliminada' }); }
    default: return res.status(405).json({ error: 'Método no permitido' });
  }
}

async function adminExchangeRates(req, res, url) {
  const supabase = getServiceClient(); const tid = req.tenant.id; const id = url.searchParams.get('id');
  switch (req.method) {
    case 'GET': { const { data } = await supabase.from('exchange_rates').select('*, from_currency:currencies!exchange_rates_from_currency_id_fkey(id, code, name, symbol), to_currency:currencies!exchange_rates_to_currency_id_fkey(id, code, name, symbol)').eq('tenant_id', tid).order('created_at', { ascending: false }); return success(res, { exchange_rates: data || [] }); }
    case 'POST': { const b = req.body; if (!b.from_currency_id || !b.to_currency_id || !b.rate) return errorRes(res, 'from, to, rate requeridos'); const { data: ex } = await supabase.from('exchange_rates').select('id').eq('tenant_id', tid).eq('from_currency_id', b.from_currency_id).eq('to_currency_id', b.to_currency_id).single(); if (ex) { const { data } = await supabase.from('exchange_rates').update({ rate: parseFloat(b.rate), is_active: true }).eq('id', ex.id).select('*, from_currency:currencies!exchange_rates_from_currency_id_fkey(id,code,symbol), to_currency:currencies!exchange_rates_to_currency_id_fkey(id,code,symbol)').single(); return success(res, { exchange_rate: data }); } const { data } = await supabase.from('exchange_rates').insert({ tenant_id: tid, from_currency_id: b.from_currency_id, to_currency_id: b.to_currency_id, rate: parseFloat(b.rate), is_active: true }).select('*, from_currency:currencies!exchange_rates_from_currency_id_fkey(id,code,symbol), to_currency:currencies!exchange_rates_to_currency_id_fkey(id,code,symbol)').single(); return success(res, { exchange_rate: data }, 201); }
    case 'PUT': { if (!id) return errorRes(res, 'id requerido'); const { data } = await supabase.from('exchange_rates').update({ rate: parseFloat(req.body.rate) }).eq('id', id).eq('tenant_id', tid).select().single(); return success(res, { exchange_rate: data }); }
    case 'DELETE': { if (!id) return errorRes(res, 'id requerido'); await supabase.from('exchange_rates').update({ is_active: false }).eq('id', id).eq('tenant_id', tid); return success(res, { message: 'Eliminada' }); }
    default: return res.status(405).json({ error: 'Método no permitido' });
  }
}

async function adminPaymentMethods(req, res, url) {
  const supabase = getServiceClient(); const tid = req.tenant.id; const id = url.searchParams.get('id');
  switch (req.method) {
    case 'GET': { const { data } = await supabase.from('payment_methods').select('*, currencies(id, code, name, symbol)').eq('tenant_id', tid).order('sort_order'); return success(res, { payment_methods: data || [] }); }
    case 'POST': { const b = req.body; if (!b.name || !b.type || !b.currency_id) return errorRes(res, 'name, type, currency_id requeridos'); const { data } = await supabase.from('payment_methods').insert({ tenant_id: tid, name: b.name, type: b.type, currency_id: b.currency_id, details: b.details || {}, instructions: b.instructions || null, requires_proof: b.requires_proof !== false, is_active: true, sort_order: b.sort_order || 0 }).select('*, currencies(id, code, name, symbol)').single(); return success(res, { payment_method: data }, 201); }
    case 'PUT': { if (!id) return errorRes(res, 'id requerido'); const u = {}; const b = req.body; ['name','type','currency_id','details','instructions','requires_proof','is_active','sort_order'].forEach(f => { if (b[f] !== undefined) u[f] = b[f]; }); const { data } = await supabase.from('payment_methods').update(u).eq('id', id).eq('tenant_id', tid).select('*, currencies(id,code,name,symbol)').single(); return success(res, { payment_method: data }); }
    case 'DELETE': { if (!id) return errorRes(res, 'id requerido'); await supabase.from('payment_methods').update({ is_active: false }).eq('id', id).eq('tenant_id', tid); return success(res, { message: 'Eliminado' }); }
    default: return res.status(405).json({ error: 'Método no permitido' });
  }
}

async function adminHours(req, res) {
  const supabase = getServiceClient(); const tid = req.tenant.id;
  if (req.method === 'GET') { const { data } = await supabase.from('business_hours').select('*').eq('tenant_id', tid).order('day_of_week'); return success(res, { hours: data || [] }); }
  if (req.method === 'PUT') {
    const { hours } = req.body; if (!hours) return errorRes(res, 'hours array requerido');
    await supabase.from('business_hours').delete().eq('tenant_id', tid);
    const ins = hours.filter(h => h.is_active).map(h => ({ tenant_id: tid, day_of_week: h.day_of_week, open_time: h.open_time, close_time: h.close_time, is_active: true }));
    if (ins.length) await supabase.from('business_hours').insert(ins);
    const { data } = await supabase.from('business_hours').select('*').eq('tenant_id', tid).order('day_of_week');
    return success(res, { hours: data || [] });
  }
  return res.status(405).json({ error: 'GET o PUT' });
}

async function adminEmployees(req, res, url) {
  const supabase = getServiceClient(); const tid = req.tenant.id; const id = url.searchParams.get('id');
  if (req.method !== 'GET' && !['owner', 'admin'].includes(req.employee.role)) return errorRes(res, 'Solo admins', 403);
  switch (req.method) {
    case 'GET': { const { data } = await supabase.from('employees').select('id, name, role, is_active, created_at').eq('tenant_id', tid).order('created_at'); return success(res, { employees: data || [] }); }
    case 'POST': { const b = req.body; if (!b.email || !b.name) return errorRes(res, 'email y name requeridos'); let userId; const { data: auth, error: authErr } = await supabase.auth.admin.createUser({ email: b.email, password: b.password || 'Temp1234!', email_confirm: true }); if (authErr) { if (authErr.message.includes('already been registered')) { const { data: { users } } = await supabase.auth.admin.listUsers(); const f = users.find(u => u.email === b.email); if (f) userId = f.id; } else return errorRes(res, authErr.message); } else userId = auth.user.id; if (!userId) return errorRes(res, 'No se pudo crear usuario'); const { data: existing } = await supabase.from('employees').select('id').eq('user_id', userId).eq('tenant_id', tid).single(); if (existing) return errorRes(res, 'Ya es empleado'); const { data } = await supabase.from('employees').insert({ tenant_id: tid, user_id: userId, name: b.name, role: b.role || 'operator', is_active: true }).select().single(); return success(res, { employee: data }, 201); }
    case 'PUT': { if (!id) return errorRes(res, 'id requerido'); const u = {}; if (req.body.name) u.name = req.body.name; if (req.body.role) u.role = req.body.role; if (req.body.is_active !== undefined) u.is_active = req.body.is_active; const { data } = await supabase.from('employees').update(u).eq('id', id).eq('tenant_id', tid).select().single(); return success(res, { employee: data }); }
    case 'DELETE': { if (!id) return errorRes(res, 'id requerido'); if (id === req.employee.id) return errorRes(res, 'No puedes eliminarte'); await supabase.from('employees').update({ is_active: false }).eq('id', id).eq('tenant_id', tid); return success(res, { message: 'Desactivado' }); }
    default: return res.status(405).json({ error: 'Método no permitido' });
  }
}
