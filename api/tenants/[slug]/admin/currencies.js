/**
 * Admin: CRUD Monedas
 * GET    /api/tenants/:slug/admin/currencies
 * POST   /api/tenants/:slug/admin/currencies
 * PUT    /api/tenants/:slug/admin/currencies?id=xxx
 * DELETE /api/tenants/:slug/admin/currencies?id=xxx
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
        .from('currencies')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('is_base', { ascending: false });

      if (error) return res.status(500).json({ error: 'Error cargando monedas' });
      return success(res, { currencies: data });
    }

    case 'POST': {
      const body = req.body;
      if (!body.code || !body.name || !body.symbol) {
        return errorRes(res, 'code, name y symbol son requeridos');
      }

      const { data, error } = await supabase
        .from('currencies')
        .insert({
          tenant_id: tenantId,
          code: body.code.toUpperCase(),
          name: body.name,
          symbol: body.symbol,
          is_base: body.is_base || false,
          is_active: true,
          decimal_places: body.decimal_places || 2
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') return errorRes(res, 'Esta moneda ya existe');
        return res.status(500).json({ error: 'Error creando moneda' });
      }

      // Si se marcó como base, desmarcar las demás
      if (body.is_base) {
        await supabase
          .from('currencies')
          .update({ is_base: false })
          .eq('tenant_id', tenantId)
          .neq('id', data.id);
      }

      return success(res, { currency: data }, 201);
    }

    case 'PUT': {
      if (!id) return errorRes(res, 'ID requerido');
      const body = req.body;

      const updateData = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.symbol !== undefined) updateData.symbol = body.symbol;
      if (body.is_active !== undefined) updateData.is_active = body.is_active;
      if (body.decimal_places !== undefined) updateData.decimal_places = body.decimal_places;
      if (body.is_base !== undefined) updateData.is_base = body.is_base;

      const { data, error } = await supabase
        .from('currencies')
        .update(updateData)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) return res.status(500).json({ error: 'Error actualizando moneda' });

      // Si se puso como base, desmarcar las demás
      if (body.is_base) {
        await supabase
          .from('currencies')
          .update({ is_base: false })
          .eq('tenant_id', tenantId)
          .neq('id', id);
      }

      return success(res, { currency: data });
    }

    case 'DELETE': {
      if (!id) return errorRes(res, 'ID requerido');

      // No permitir eliminar moneda base
      const { data: curr } = await supabase
        .from('currencies')
        .select('is_base')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .single();

      if (curr?.is_base) {
        return errorRes(res, 'No se puede eliminar la moneda base. Asigna otra como base primero.');
      }

      const { error } = await supabase
        .from('currencies')
        .update({ is_active: false })
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) return res.status(500).json({ error: 'Error eliminando moneda' });
      return success(res, { message: 'Moneda desactivada' });
    }

    default:
      return res.status(405).json({ error: 'Método no permitido' });
  }
}
