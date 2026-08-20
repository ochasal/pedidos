/**
 * Admin: CRUD Categorías
 * GET    /api/tenants/:slug/admin/categories - Listar todas (incl. inactivas)
 * POST   /api/tenants/:slug/admin/categories - Crear
 * PUT    /api/tenants/:slug/admin/categories?id=xxx - Actualizar
 * DELETE /api/tenants/:slug/admin/categories?id=xxx - Eliminar (soft delete)
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
        .from('categories')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('sort_order', { ascending: true });

      if (error) return res.status(500).json({ error: 'Error cargando categorías' });
      return success(res, { categories: data });
    }

    case 'POST': {
      const body = req.body;
      if (!body.name) return errorRes(res, 'El nombre es requerido');

      const { data, error } = await supabase
        .from('categories')
        .insert({
          tenant_id: tenantId,
          name: body.name,
          description: body.description || null,
          image_url: body.image_url || null,
          sort_order: body.sort_order || 0,
          is_active: body.is_active !== false
        })
        .select()
        .single();

      if (error) return res.status(500).json({ error: 'Error creando categoría' });
      return success(res, { category: data }, 201);
    }

    case 'PUT': {
      if (!id) return errorRes(res, 'ID requerido en query param');
      const body = req.body;

      const { data, error } = await supabase
        .from('categories')
        .update({
          name: body.name,
          description: body.description,
          image_url: body.image_url,
          sort_order: body.sort_order,
          is_active: body.is_active
        })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) return res.status(500).json({ error: 'Error actualizando categoría' });
      return success(res, { category: data });
    }

    case 'DELETE': {
      if (!id) return errorRes(res, 'ID requerido en query param');

      // Soft delete
      const { error } = await supabase
        .from('categories')
        .update({ is_active: false })
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) return res.status(500).json({ error: 'Error eliminando categoría' });
      return success(res, { message: 'Categoría desactivada' });
    }

    default:
      return res.status(405).json({ error: 'Método no permitido' });
  }
}
