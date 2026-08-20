/**
 * GET /api/tenants/:slug/products
 * Retorna catálogo público: categorías + productos disponibles
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
    const tenantId = req.tenant.id;

    // Cargar categorías activas
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('id, name, description, image_url, sort_order')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (catError) {
      return res.status(500).json({ error: 'Error cargando categorías' });
    }

    // Cargar productos activos y disponibles
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select(`
        id, name, description, price, image_url, 
        is_available, sort_order, options, category_id,
        currencies!inner (code, symbol)
      `)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .eq('is_available', true)
      .order('sort_order', { ascending: true });

    if (prodError) {
      return res.status(500).json({ error: 'Error cargando productos' });
    }

    // Formatear productos con símbolo de moneda
    const formattedProducts = products.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      currency_code: p.currencies.code,
      currency_symbol: p.currencies.symbol,
      image_url: p.image_url,
      is_available: p.is_available,
      category_id: p.category_id,
      options: p.options
    }));

    return success(res, { categories, products: formattedProducts });
  });
});
