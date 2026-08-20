/**
 * Admin: CRUD Métodos de Pago
 * GET    /api/tenants/:slug/admin/payment-methods
 * POST   /api/tenants/:slug/admin/payment-methods
 * PUT    /api/tenants/:slug/admin/payment-methods?id=xxx
 * DELETE /api/tenants/:slug/admin/payment-methods?id=xxx
 */
const { apiHandler, success, error: errorRes } = require('../../../_lib/response');
const { withTenant, withEmployeeAuth } = require('../../../_lib/tenant');
const { getServiceClient } = require('../../../_lib/supabase');

module.exports = apiHandler(async (req, res) => {
  return withTenant(req, res, (req, res) => {
    return withEmployeeAuth(req, res, handler);
  });
});

async function handler(req, res) {
  const supabase = getServiceClient();
  const tenantId = req.tenant.id;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const id = url.searchParams.get('id');

  switch (req.method) {
    case 'GET': {
      const { data, error } = await supabase
        .from('payment_methods')
        .select(`
          *,
          currencies (id, code, name, symbol)
        `)
        .eq('tenant_id', tenantId)
        .order('sort_order', { ascending: true });

      if (error) return res.status(500).json({ error: 'Error cargando métodos de pago' });
      return success(res, { payment_methods: data });
    }

    case 'POST': {
      const body = req.body;
      if (!body.name || !body.type || !body.currency_id) {
        return errorRes(res, 'name, type y currency_id son requeridos');
      }

      const validTypes = ['cash', 'transfer', 'mobile_payment', 'zelle', 'crypto', 'other'];
      if (!validTypes.includes(body.type)) {
        return errorRes(res, `Tipo inválido. Opciones: ${validTypes.join(', ')}`);
      }

      const { data, error } = await supabase
        .from('payment_methods')
        .insert({
          tenant_id: tenantId,
          name: body.name,
          type: body.type,
          currency_id: body.currency_id,
          details: body.details || {},
          instructions: body.instructions || null,
          requires_proof: body.requires_proof !== false,
          is_active: true,
          sort_order: body.sort_order || 0
        })
        .select(`
          *,
          currencies (id, code, name, symbol)
        `)
        .single();

      if (error) return res.status(500).json({ error: 'Error creando método de pago' });
      return success(res, { payment_method: data }, 201);
    }

    case 'PUT': {
      if (!id) return errorRes(res, 'ID requerido');
      const body = req.body;

      const updateData = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.type !== undefined) updateData.type = body.type;
      if (body.currency_id !== undefined) updateData.currency_id = body.currency_id;
      if (body.details !== undefined) updateData.details = body.details;
      if (body.instructions !== undefined) updateData.instructions = body.instructions;
      if (body.requires_proof !== undefined) updateData.requires_proof = body.requires_proof;
      if (body.is_active !== undefined) updateData.is_active = body.is_active;
      if (body.sort_order !== undefined) updateData.sort_order = body.sort_order;

      const { data, error } = await supabase
        .from('payment_methods')
        .update(updateData)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select(`
          *,
          currencies (id, code, name, symbol)
        `)
        .single();

      if (error) return res.status(500).json({ error: 'Error actualizando método de pago' });
      return success(res, { payment_method: data });
    }

    case 'DELETE': {
      if (!id) return errorRes(res, 'ID requerido');

      const { error } = await supabase
        .from('payment_methods')
        .update({ is_active: false })
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) return res.status(500).json({ error: 'Error eliminando método de pago' });
      return success(res, { message: 'Método de pago desactivado' });
    }

    default:
      return res.status(405).json({ error: 'Método no permitido' });
  }
}
