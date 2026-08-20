/**
 * Admin: CRUD Tasas de Cambio
 * GET    /api/tenants/:slug/admin/exchange-rates
 * POST   /api/tenants/:slug/admin/exchange-rates
 * PUT    /api/tenants/:slug/admin/exchange-rates?id=xxx
 * DELETE /api/tenants/:slug/admin/exchange-rates?id=xxx
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
        .from('exchange_rates')
        .select(`
          *,
          from_currency:currencies!exchange_rates_from_currency_id_fkey (id, code, name, symbol),
          to_currency:currencies!exchange_rates_to_currency_id_fkey (id, code, name, symbol)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) return res.status(500).json({ error: 'Error cargando tasas' });
      return success(res, { exchange_rates: data });
    }

    case 'POST': {
      const body = req.body;
      if (!body.from_currency_id || !body.to_currency_id || !body.rate) {
        return errorRes(res, 'from_currency_id, to_currency_id y rate son requeridos');
      }

      if (body.from_currency_id === body.to_currency_id) {
        return errorRes(res, 'Las monedas de origen y destino deben ser diferentes');
      }

      // Upsert: si ya existe, actualizar la tasa
      const { data: existing } = await supabase
        .from('exchange_rates')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('from_currency_id', body.from_currency_id)
        .eq('to_currency_id', body.to_currency_id)
        .single();

      if (existing) {
        const { data, error } = await supabase
          .from('exchange_rates')
          .update({ rate: parseFloat(body.rate), is_active: true })
          .eq('id', existing.id)
          .select(`
            *,
            from_currency:currencies!exchange_rates_from_currency_id_fkey (id, code, name, symbol),
            to_currency:currencies!exchange_rates_to_currency_id_fkey (id, code, name, symbol)
          `)
          .single();

        if (error) return res.status(500).json({ error: 'Error actualizando tasa' });
        return success(res, { exchange_rate: data });
      }

      const { data, error } = await supabase
        .from('exchange_rates')
        .insert({
          tenant_id: tenantId,
          from_currency_id: body.from_currency_id,
          to_currency_id: body.to_currency_id,
          rate: parseFloat(body.rate),
          is_active: true
        })
        .select(`
          *,
          from_currency:currencies!exchange_rates_from_currency_id_fkey (id, code, name, symbol),
          to_currency:currencies!exchange_rates_to_currency_id_fkey (id, code, name, symbol)
        `)
        .single();

      if (error) return res.status(500).json({ error: 'Error creando tasa de cambio' });
      return success(res, { exchange_rate: data }, 201);
    }

    case 'PUT': {
      if (!id) return errorRes(res, 'ID requerido');
      const body = req.body;

      const { data, error } = await supabase
        .from('exchange_rates')
        .update({ rate: parseFloat(body.rate) })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select(`
          *,
          from_currency:currencies!exchange_rates_from_currency_id_fkey (id, code, name, symbol),
          to_currency:currencies!exchange_rates_to_currency_id_fkey (id, code, name, symbol)
        `)
        .single();

      if (error) return res.status(500).json({ error: 'Error actualizando tasa' });
      return success(res, { exchange_rate: data });
    }

    case 'DELETE': {
      if (!id) return errorRes(res, 'ID requerido');

      const { error } = await supabase
        .from('exchange_rates')
        .update({ is_active: false })
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) return res.status(500).json({ error: 'Error eliminando tasa' });
      return success(res, { message: 'Tasa de cambio desactivada' });
    }

    default:
      return res.status(405).json({ error: 'Método no permitido' });
  }
}
