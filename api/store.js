/**
 * /api/store - API pública de la tienda (consolidado)
 * Query params: slug (requerido), action (tenant, products, hours, payments, exchange-rates)
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
    case 'tenant': return getTenantInfo(res, tenant);
    case 'products': return getProducts(res, tenant);
    case 'hours': return getHours(res, tenant);
    case 'payments': return getPaymentMethods(res, tenant);
    case 'exchange-rates': return getExchangeRates(res, tenant);
    default: return errorRes(res, 'action requerido: tenant, products, hours, payments, exchange-rates');
  }
});

function getTenantInfo(res, tenant) {
  const safeConfig = { ...tenant.config };
  delete safeConfig.whatsapp_api_token;
  delete safeConfig.whatsapp_api_url;
  return success(res, { tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name, config: safeConfig } });
}

async function getProducts(res, tenant) {
  const supabase = getServiceClient();
  const { data: categories } = await supabase.from('categories').select('id, name, description, image_url, sort_order').eq('tenant_id', tenant.id).eq('is_active', true).order('sort_order');
  const { data: products } = await supabase.from('products').select('id, name, description, price, image_url, is_available, sort_order, options, category_id, currencies!inner(code, symbol)').eq('tenant_id', tenant.id).eq('is_active', true).eq('is_available', true).order('sort_order');
  const formatted = (products || []).map(p => ({ id: p.id, name: p.name, description: p.description, price: p.price, currency_code: p.currencies.code, currency_symbol: p.currencies.symbol, image_url: p.image_url, is_available: p.is_available, category_id: p.category_id, options: p.options }));
  return success(res, { categories: categories || [], products: formatted });
}

async function getHours(res, tenant) {
  const supabase = getServiceClient();
  const { data: hours } = await supabase.from('business_hours').select('day_of_week, open_time, close_time, is_active').eq('tenant_id', tenant.id).order('day_of_week');
  const now = new Date();
  const currentDay = now.getDay();
  const currentTime = now.toTimeString().substring(0, 5);
  const todayHours = (hours || []).find(h => h.day_of_week === currentDay && h.is_active);
  const isOpen = todayHours ? currentTime >= todayHours.open_time && currentTime <= todayHours.close_time : false;
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return success(res, { hours: (hours || []).map(h => ({ ...h, day_name: dayNames[h.day_of_week] })), is_open: isOpen });
}

async function getPaymentMethods(res, tenant) {
  const supabase = getServiceClient();
  const { data: methods } = await supabase.from('payment_methods').select('id, name, type, instructions, requires_proof, sort_order, currencies(id, code, name, symbol)').eq('tenant_id', tenant.id).eq('is_active', true).order('sort_order');
  const { data: rates } = await supabase.from('exchange_rates').select('id, rate, updated_at, from_currency:currencies!exchange_rates_from_currency_id_fkey(code, symbol), to_currency:currencies!exchange_rates_to_currency_id_fkey(code, symbol)').eq('tenant_id', tenant.id).eq('is_active', true);
  return success(res, { payment_methods: methods || [], exchange_rates: rates || [] });
}

async function getExchangeRates(res, tenant) {
  const supabase = getServiceClient();
  const { data: rates } = await supabase.from('exchange_rates').select('id, rate, updated_at, from_currency:currencies!exchange_rates_from_currency_id_fkey(id, code, name, symbol), to_currency:currencies!exchange_rates_to_currency_id_fkey(id, code, name, symbol)').eq('tenant_id', tenant.id).eq('is_active', true);
  return success(res, { exchange_rates: rates || [] });
}
