/**
 * Admin: Configuración del Tenant
 * GET  /api/tenants/:slug/admin/config - Obtener config completa
 * PUT  /api/tenants/:slug/admin/config - Actualizar config
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
      // Config del tenant
      const { data: config, error: cfgErr } = await supabase
        .from('tenant_config')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

      // Datos básicos del tenant
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id, slug, name')
        .eq('id', tenantId)
        .single();

      if (cfgErr) return res.status(500).json({ error: 'Error cargando configuración' });

      return success(res, { tenant, config });
    }

    case 'PUT': {
      const body = req.body;

      // Actualizar nombre del tenant si se envía
      if (body.name) {
        await supabase
          .from('tenants')
          .update({ name: body.name })
          .eq('id', tenantId);
      }

      // Actualizar config
      const configFields = {};
      const allowedFields = [
        'logo_url', 'favicon_url', 'primary_color', 'primary_color_dark',
        'accent_color', 'tagline', 'phone', 'whatsapp_number', 'email',
        'address', 'delivery_enabled', 'pickup_enabled', 'min_order_amount',
        'delivery_fee', 'require_full_payment_before_delivery',
        'allow_cash_without_prepayment', 'auto_close_after_hours',
        'whatsapp_notifications_enabled', 'whatsapp_api_url', 'whatsapp_api_token'
      ];

      allowedFields.forEach(field => {
        if (body[field] !== undefined) configFields[field] = body[field];
      });

      if (Object.keys(configFields).length > 0) {
        const { error } = await supabase
          .from('tenant_config')
          .update(configFields)
          .eq('tenant_id', tenantId);

        if (error) {
          console.error('Error actualizando config:', error);
          return res.status(500).json({ error: 'Error actualizando configuración' });
        }
      }

      return success(res, { message: 'Configuración actualizada' });
    }

    default:
      return res.status(405).json({ error: 'Método no permitido' });
  }
}
