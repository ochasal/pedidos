/**
 * Admin: CRUD Productos
 * GET    /api/tenants/:slug/admin/products - Listar todos (incl. inactivos)
 * POST   /api/tenants/:slug/admin/products - Crear
 * PUT    /api/tenants/:slug/admin/products?id=xxx - Actualizar
 * DELETE /api/tenants/:slug/admin/products?id=xxx - Soft delete
 * PATCH  /api/tenants/:slug/admin/products?id=xxx - Toggle disponibilidad
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
        .from('products')
        .select(`
          *,
          categories (id, name),
          currencies (id, code, symbol)
        `)
        .eq('tenant_id', tenantId)
        .order('sort_order', { ascending: true });

      if (error) return res.status(500).json({ error: 'Error cargando productos' });
      return success(res, { products: data });
    }

    case 'POST': {
      const body = req.body;
      if (!body.name || !body.price || !body.currency_id) {
        return errorRes(res, 'Nombre, precio y moneda son requeridos');
      }

      const { data, error } = await supabase
        .from('products')
        .insert({
          tenant_id: tenantId,
          category_id: body.category_id || null,
          name: body.name,
          description: body.description || null,
          price: parseFloat(body.price),
          currency_id: body.currency_id,
          image_url: body.image_url || null,
          is_available: body.is_available !== false,
          is_active: true,
          sort_order: body.sort_order || 0,
          options: body.options || []
        })
        .select(`
          *,
          categories (id, name),
          currencies (id, code, symbol)
        `)
        .single();

      if (error) {
        console.error('Error creando producto:', error);
        return res.status(500).json({ error: 'Error creando producto' });
      }
      return success(res, { product: data }, 201);
    }

    case 'PUT': {
      if (!id) return errorRes(res, 'ID requerido en query param');
      const body = req.body;

      const updateData = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.price !== undefined) updateData.price = parseFloat(body.price);
      if (body.currency_id !== undefined) updateData.currency_id = body.currency_id;
      if (body.category_id !== undefined) updateData.category_id = body.category_id;
      if (body.image_url !== undefined) updateData.image_url = body.image_url;
      if (body.is_available !== undefined) updateData.is_available = body.is_available;
      if (body.is_active !== undefined) updateData.is_active = body.is_active;
      if (body.sort_order !== undefined) updateData.sort_order = body.sort_order;
      if (body.options !== undefined) updateData.options = body.options;

      const { data, error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select(`
          *,
          categories (id, name),
          currencies (id, code, symbol)
        `)
        .single();

      if (error) return res.status(500).json({ error: 'Error actualizando producto' });
      return success(res, { product: data });
    }

    case 'PATCH': {
      // Toggle disponibilidad
      if (!id) return errorRes(res, 'ID requerido en query param');

      const { data: current } = await supabase
        .from('products')
        .select('is_available')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .single();

      if (!current) return res.status(404).json({ error: 'Producto no encontrado' });

      const { data, error } = await supabase
        .from('products')
        .update({ is_available: !current.is_available })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) return res.status(500).json({ error: 'Error actualizando disponibilidad' });
      return success(res, { product: data });
    }

    case 'DELETE': {
      if (!id) return errorRes(res, 'ID requerido en query param');

      const { error } = await supabase
        .from('products')
        .update({ is_active: false, is_available: false })
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) return res.status(500).json({ error: 'Error eliminando producto' });
      return success(res, { message: 'Producto desactivado' });
    }

    default:
      return res.status(405).json({ error: 'Método no permitido' });
  }
}
