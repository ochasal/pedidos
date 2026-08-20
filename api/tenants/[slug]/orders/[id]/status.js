/**
 * PATCH /api/tenants/:slug/orders/:id/status
 * Cambiar estado de un pedido (requiere auth de empleado)
 * 
 * Flujo: recibido → procesando_pago → en_preparacion → preparado → en_camino → completado
 * También: cualquier estado → cancelado
 * 
 * Reglas:
 * - No se puede entregar sin pago completo (excepto efectivo)
 * - Pedidos cerrados (completado/cancelado) no se editan
 */
const { apiHandler, success, error: errorRes } = require('../../../../_lib/response');
const { withTenant, withEmployeeAuth } = require('../../../../_lib/tenant');
const { getServiceClient } = require('../../../../_lib/supabase');

const VALID_TRANSITIONS = {
  'recibido': ['procesando_pago', 'en_preparacion', 'cancelado'],
  'procesando_pago': ['en_preparacion', 'cancelado'],
  'en_preparacion': ['preparado', 'cancelado'],
  'preparado': ['en_camino', 'cancelado'],
  'en_camino': ['completado', 'cancelado']
};

module.exports = apiHandler(async (req, res) => {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  return withTenant(req, res, async (req, res) => {
    return withEmployeeAuth(req, res, async (req, res) => {
      const supabase = getServiceClient();
      const tenantId = req.tenant.id;
      const body = req.body;

      // Extraer order ID de la URL
      const urlParts = req.url.split('/');
      const ordersIdx = urlParts.indexOf('orders');
      const orderId = urlParts[ordersIdx + 1];

      if (!body.status) {
        return errorRes(res, 'Nuevo estado es requerido');
      }

      // Obtener orden actual
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .eq('tenant_id', tenantId)
        .single();

      if (orderErr || !order) {
        return res.status(404).json({ error: 'Pedido no encontrado' });
      }

      // Pedidos cerrados no se editan
      if (['completado', 'cancelado'].includes(order.status)) {
        return errorRes(res, 'No se puede modificar un pedido cerrado');
      }

      // Validar transición
      const allowedTransitions = VALID_TRANSITIONS[order.status] || [];
      if (!allowedTransitions.includes(body.status)) {
        return errorRes(res, 
          `No se puede cambiar de '${order.status}' a '${body.status}'. Transiciones válidas: ${allowedTransitions.join(', ')}`
        );
      }

      // Regla: no entregar sin pago completo (excepto si allow_cash_without_prepayment)
      if (['en_camino', 'completado'].includes(body.status)) {
        if (!order.payment_complete) {
          const tenantConfig = req.tenant.config;
          // Verificar si tiene solo pagos en efectivo
          const { data: payments } = await supabase
            .from('order_payments')
            .select('payment_methods!inner(type)')
            .eq('order_id', orderId);

          const allCash = payments?.length > 0 && 
            payments.every(p => p.payment_methods.type === 'cash');

          if (!allCash || !tenantConfig.allow_cash_without_prepayment) {
            return errorRes(res, 'No se puede entregar/completar sin pago completo');
          }
        }
      }

      // Actualizar estado
      const updateData = { status: body.status };
      if (body.status === 'completado') {
        updateData.completed_at = new Date().toISOString();
      }
      if (body.status === 'cancelado') {
        updateData.cancelled_at = new Date().toISOString();
        updateData.cancellation_reason = body.reason || null;
      }

      const { data: updatedOrder, error: updateErr } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId)
        .select()
        .single();

      if (updateErr) {
        return res.status(500).json({ error: 'Error actualizando pedido' });
      }

      // Registrar en historial
      await supabase.from('order_status_history').insert({
        tenant_id: tenantId,
        order_id: orderId,
        status: body.status,
        changed_by: req.employee.id,
        notes: body.notes || body.reason || null
      });

      return success(res, { order: updatedOrder });
    });
  });
});
