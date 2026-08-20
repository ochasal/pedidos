/**
 * Admin: Verificar/Rechazar pago
 * POST /api/tenants/:slug/admin/orders/verify-payment
 * Body: { payment_id, action: 'verify'|'reject', reason?: string }
 */
const { apiHandler, success, error: errorRes } = require('../../../../_lib/response');
const { withTenant, withEmployeeAuth } = require('../../../../_lib/tenant');
const { getServiceClient } = require('../../../../_lib/supabase');

module.exports = apiHandler(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  return withTenant(req, res, (req, res) => {
    return withEmployeeAuth(req, res, handler);
  });
});

async function handler(req, res) {
  const supabase = getServiceClient();
  const tenantId = req.tenant.id;
  const body = req.body;

  if (!body.payment_id || !body.action) {
    return errorRes(res, 'payment_id y action son requeridos');
  }

  if (!['verify', 'reject'].includes(body.action)) {
    return errorRes(res, 'action debe ser "verify" o "reject"');
  }

  // Obtener el pago
  const { data: payment, error: payErr } = await supabase
    .from('order_payments')
    .select('*, orders!inner(id, total, total_paid, status)')
    .eq('id', body.payment_id)
    .eq('tenant_id', tenantId)
    .single();

  if (payErr || !payment) {
    return res.status(404).json({ error: 'Pago no encontrado' });
  }

  if (payment.status !== 'pending') {
    return errorRes(res, 'Este pago ya fue procesado');
  }

  if (body.action === 'verify') {
    // Verificar pago
    const { error: updateErr } = await supabase
      .from('order_payments')
      .update({
        status: 'verified',
        verified_by: req.employee.id,
        verified_at: new Date().toISOString()
      })
      .eq('id', body.payment_id);

    if (updateErr) return res.status(500).json({ error: 'Error verificando pago' });

    // Actualizar total_paid en la orden
    const order = payment.orders;
    const newTotalPaid = parseFloat(order.total_paid) + parseFloat(payment.amount_in_base);
    const paymentComplete = newTotalPaid >= parseFloat(order.total);

    await supabase
      .from('orders')
      .update({
        total_paid: newTotalPaid,
        payment_complete: paymentComplete,
        // Si el pago completa y estaba en procesando_pago, mover a en_preparacion
        ...(paymentComplete && order.status === 'procesando_pago' 
          ? { status: 'en_preparacion' } 
          : {})
      })
      .eq('id', order.id);

    // Si se completó el pago y se movió de estado, registrar en historial
    if (paymentComplete && order.status === 'procesando_pago') {
      await supabase.from('order_status_history').insert({
        tenant_id: tenantId,
        order_id: order.id,
        status: 'en_preparacion',
        changed_by: req.employee.id,
        notes: 'Pago completo verificado - pedido pasa a preparación'
      });
    }

    return success(res, { 
      message: 'Pago verificado',
      payment_complete: paymentComplete,
      new_total_paid: newTotalPaid
    });

  } else {
    // Rechazar pago
    if (!body.reason) {
      return errorRes(res, 'Se requiere una razón para rechazar el pago');
    }

    const { error: updateErr } = await supabase
      .from('order_payments')
      .update({
        status: 'rejected',
        rejection_reason: body.reason,
        verified_by: req.employee.id,
        verified_at: new Date().toISOString()
      })
      .eq('id', body.payment_id);

    if (updateErr) return res.status(500).json({ error: 'Error rechazando pago' });

    return success(res, { message: 'Pago rechazado' });
  }
}
