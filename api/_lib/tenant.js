/**
 * Resolución de tenant por slug
 * Middleware que identifica el tenant desde la URL y lo inyecta en el request
 */
const { getServiceClient } = require('./supabase');

// Cache simple en memoria (se resetea por invocación en serverless, pero ayuda en dev)
const tenantCache = new Map();
const CACHE_TTL = 60 * 1000; // 1 minuto

/**
 * Resuelve el tenant a partir del slug.
 * Retorna el objeto tenant completo con su config, o null si no existe.
 */
async function resolveTenant(slug) {
  if (!slug) return null;

  // Check cache
  const cached = tenantCache.get(slug);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const supabase = getServiceClient();

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select(`
      *,
      tenant_config (*)
    `)
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error || !tenant) return null;

  // Flatten config
  const result = {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    is_active: tenant.is_active,
    config: tenant.tenant_config || {}
  };

  // Cache it
  tenantCache.set(slug, { data: result, timestamp: Date.now() });

  return result;
}

/**
 * Extrae el slug del tenant desde la ruta de la API.
 * Formato esperado: /api/tenants/{slug}/...
 */
function extractSlugFromPath(url) {
  const match = url.match(/\/api\/tenants\/([^/]+)/);
  return match ? match[1] : null;
}

/**
 * Middleware: resuelve tenant y lo adjunta al request.
 * Retorna error response si el tenant no existe.
 */
async function withTenant(req, res, handler) {
  const slug = extractSlugFromPath(req.url);

  if (!slug) {
    return res.status(400).json({ error: 'Slug de tenant requerido en la URL' });
  }

  const tenant = await resolveTenant(slug);

  if (!tenant) {
    return res.status(404).json({ error: `Tenant '${slug}' no encontrado` });
  }

  req.tenant = tenant;
  return handler(req, res);
}

/**
 * Middleware: verifica que el usuario autenticado pertenece al tenant.
 * Requiere que withTenant se haya ejecutado antes.
 */
async function withEmployeeAuth(req, res, handler) {
  const { getUser, getServiceClient: getSvc } = require('./supabase');
  
  const user = await getUser(req);
  if (!user) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const supabase = getSvc();
  const { data: employee, error } = await supabase
    .from('employees')
    .select('*')
    .eq('user_id', user.id)
    .eq('tenant_id', req.tenant.id)
    .eq('is_active', true)
    .single();

  if (error || !employee) {
    return res.status(403).json({ error: 'No tienes acceso a este negocio' });
  }

  req.user = user;
  req.employee = employee;
  return handler(req, res);
}

module.exports = {
  resolveTenant,
  extractSlugFromPath,
  withTenant,
  withEmployeeAuth
};
