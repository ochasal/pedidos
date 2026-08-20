/**
 * GET /api/tenants/:slug
 * Retorna información pública del tenant (branding, config)
 */
const { apiHandler, success, notFound } = require('../../_lib/response');
const { resolveTenant, extractSlugFromPath } = require('../../_lib/tenant');

module.exports = apiHandler(async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const slug = extractSlugFromPath(req.url);
  const tenant = await resolveTenant(slug);

  if (!tenant) {
    return notFound(res, `Tenant '${slug}' no encontrado`);
  }

  // Filtrar campos sensibles del config
  const safeConfig = { ...tenant.config };
  delete safeConfig.whatsapp_api_token;
  delete safeConfig.whatsapp_api_url;

  return success(res, {
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      config: safeConfig
    }
  });
});
