/**
 * GET /api/tenants/:slug/exchange-rates
 * Retorna tasas de cambio activas del tenant
 */
const { apiHandler, success } = require('../../_lib/response');
const { withTenant } = require('../../_lib/tenant');
const { getServiceClient } = require('../../_lib/supabase');

module.exports = apiHandler(async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  return withTenant(req, res, async (req, res) => {
    const supabase = getServiceClient();

    const { data: rates, error } = await supabase
      .from('exchange_rates')
      .select(`
        id, rate, updated_at,
        from_currency:currencies!exchange_rates_from_currency_id_fkey (id, code, name, symbol),
        to_currency:currencies!exchange_rates_to_currency_id_fkey (id, code, name, symbol)
      `)
      .eq('tenant_id', req.tenant.id)
      .eq('is_active', true);

    if (error) {
      return res.status(500).json({ error: 'Error cargando tasas de cambio' });
    }

    return success(res, { exchange_rates: rates });
  });
});
