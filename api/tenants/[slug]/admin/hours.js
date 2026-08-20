/**
 * Admin: Horarios de atención
 * GET  /api/tenants/:slug/admin/hours - Obtener todos los horarios
 * PUT  /api/tenants/:slug/admin/hours - Actualizar horarios (recibe array completo)
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

  switch (req.method) {
    case 'GET': {
      const { data, error } = await supabase
        .from('business_hours')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('day_of_week', { ascending: true });

      if (error) return res.status(500).json({ error: 'Error cargando horarios' });
      return success(res, { hours: data });
    }

    case 'PUT': {
      const body = req.body;
      if (!body.hours || !Array.isArray(body.hours)) {
        return errorRes(res, 'Se requiere un array "hours"');
      }

      // Eliminar horarios existentes y recrear
      await supabase
        .from('business_hours')
        .delete()
        .eq('tenant_id', tenantId);

      const hoursToInsert = body.hours
        .filter(h => h.is_active) // Solo insertar días activos
        .map(h => ({
          tenant_id: tenantId,
          day_of_week: h.day_of_week,
          open_time: h.open_time,
          close_time: h.close_time,
          is_active: true
        }));

      if (hoursToInsert.length > 0) {
        const { error } = await supabase
          .from('business_hours')
          .insert(hoursToInsert);

        if (error) {
          console.error('Error guardando horarios:', error);
          return res.status(500).json({ error: 'Error guardando horarios' });
        }
      }

      // Retornar horarios actualizados
      const { data } = await supabase
        .from('business_hours')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('day_of_week', { ascending: true });

      return success(res, { hours: data, message: 'Horarios actualizados' });
    }

    default:
      return res.status(405).json({ error: 'Método no permitido' });
  }
}
