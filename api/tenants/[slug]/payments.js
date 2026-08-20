/**
 * GET  /api/tenants/:slug/payments - Métodos de pago públicos
 * POST /api/tenants/:slug/payments - Registrar pago de un pedido (público)
 */
const { apiHandler, success, error: errorRes } = require('../../_lib/response');
const { withTenant } = require('../../_lib/tenant');
const { getServiceClient } = require('../../_lib/supabase');

module.exports = apiHandler(async (req, res) => {
  return withTenant(req, res, async (req, res) => {
    switch (req.method) {
      case 'GET':
        return getPaymentMethods(req, res);
      case 'POST':
        return submitPayment(req, res);
      default:
        return res.status(405).json({ error: 'Método no permitido' });
    }
  });
});

/**
 * Obtener métodos de pago disponibles con monedas y tasas
 */
async function getPaymentMethods(req, res) {
  const supabase = getServiceClient();
  const tenantId = req.tenant.id;

  // Métodos de pago con su moneda
  const { data: methods, error: methErr } = await supabase
    .from('payment_methods')
    .select(`
      id, name, type, instructions, requires_proof, sort_order,
      currencies (id, code, name, symbol)
    `)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (methErr) {
    return res.status(500).json({ error: 'Error cargando métodos de pago' });
  }

  // Tasas de cambio activas
  const { data: rates, error: ratesErr } = await supabase
    .from('exchange_rates')
    .select(`
      id, rate, updated_at,
      from_currency:currencies!exchange_rates_from_currency_id_fkey (code, symbol),
      to_currency:currencies!exchange_rates_to_currency_id_fkey (code, symbol)
    `)
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  return success(res, {
    payment_methods: methods,
    exchange_rates: rates || []
  });
}

/**
 * Registrar pago de un pedido (cliente sube comprobante)
 */
async function submitPayment(req, res) {
  const supabase = getServiceClient();
  const tenantId = req.tenant.id;
  const body = req.body;

  // Validaciones
  if (!body.order_id || !body.payment_method_id || !body.amount) {
    return errorRes(res, 'order_id, payment_method_id y amount son requeridos');
  }

  // Verificar que la orden existe y pertenece al tenant
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, status, total, total_paid')
    .eq('id', body.order_id)
    .eq('tenant_id', tenantId)
    .single();

  if (orderErr || !order) {
    return errorRes(res, 'Pedido no encontrado', 404);
  }

  // No permitir pagos en pedidos cerrados
  if (['completado', 'cancelado'].includes(order.status)) {
    return errorRes(res, 'No se pueden registrar pagos en pedidos cerrados');
  }

  // Verificar método de pago
  const { data: method, error: methErr } = await supabase
    .from('payment_methods')
    .select('id, currency_id, requires_proof, type')
    .eq('id', body.payment_method_id)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .single();

  if (methErr || !method) {
    return errorRes(res, 'Método de pago no válido');
  }

  // Si requiere comprobante y no se proporciona
  if (method.requires_proof && !body.proof_url && !body.reference_number) {
    return errorRes(res, 'Este método de pago requiere comprobante o número de referencia');
  }

  // Obtener tasa de cambio si aplica (para convertir a moneda base)
  let amountInBase = parseFloat(body.amount);
  let exchangeRateUsed = null;

  // Buscar moneda base del tenant
  const { data: baseCurrency } = await supabase
    .from('currencies')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('is_base', true)
    .single();

  if (baseCurrency && method.currency_id !== baseCurrency.id) {
    // Buscar tasa de cambio
    const { data: rate } = await supabase
      .from('exchange_rates')
      .select('rate')
      .eq('tenant_id', tenantId)
      .eq('from_currency_id', baseCurrency.id)
      .eq('to_currency_id', method.currency_id)
      .eq('is_active', true)
      .single();

    if (rate) {
      amountInBase = parseFloat(body.amount) / rate.rate;
      exchangeRateUsed = rate.rate;
    }
  }

  // Registrar pago
  const { data: payment, error: payErr } = await supabase
    .from('order_payments')
    .insert({
      tenant_id: tenantId,
      order_id: body.order_id,
      payment_method_id: body.payment_method_id,
      amount: parseFloat(body.amount),
      currency_id: method.currency_id,
      amount_in_base: amountInBase,
      exchange_rate_used: exchangeRateUsed,
      reference_number: body.reference_number || null,
      proof_url: body.proof_url || null,
      status: method.type === 'cash' ? 'verified' : 'pending'
    })
    .select()
    .single();

  if (payErr) {
    console.error('Error registrando pago:', payErr);
    return res.status(500).json({ error: 'Error registrando pago' });
  }

  // Si es efectivo, auto-verificar y actualizar total_paid
  if (method.type === 'cash') {
    const newTotalPaid = parseFloat(order.total_paid) + amountInBase;
    const paymentComplete = newTotalPaid >= parseFloat(order.total);

    await supabase
      .from('orders')
      .update({ 
        total_paid: newTotalPaid,
        payment_complete: paymentComplete
      })
      .eq('id', order.id);
  }

  return success(res, { payment }, 201);
}
