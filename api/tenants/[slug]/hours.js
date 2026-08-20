/**
 * GET /api/tenants/:slug/hours
 * Retorna horarios de atención del negocio
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

    const { data: hours, error } = await supabase
      .from('business_hours')
      .select('day_of_week, open_time, close_time, is_active')
      .eq('tenant_id', req.tenant.id)
      .order('day_of_week', { ascending: true });

    if (error) {
      return res.status(500).json({ error: 'Error cargando horarios' });
    }

    // Determinar si está abierto ahora
    const now = new Date();
    const currentDay = now.getDay(); // 0=Domingo
    const currentTime = now.toTimeString().substring(0, 5); // HH:MM

    const todayHours = hours.find(h => h.day_of_week === currentDay && h.is_active);
    const isOpen = todayHours 
      ? currentTime >= todayHours.open_time && currentTime <= todayHours.close_time
      : false;

    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    return success(res, {
      hours: hours.map(h => ({
        ...h,
        day_name: dayNames[h.day_of_week]
      })),
      is_open: isOpen,
      current_day: dayNames[currentDay],
      current_time: currentTime
    });
  });
});
