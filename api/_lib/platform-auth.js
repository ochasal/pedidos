/**
 * Middleware de autenticación para super-admin de plataforma
 */
const { getServiceClient, getUser } = require('./supabase');

/**
 * Verifica que el usuario autenticado es un platform_admin
 */
async function withPlatformAdmin(req, res, handler) {
  const user = await getUser(req);
  if (!user) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const supabase = getServiceClient();
  const { data: admin, error } = await supabase
    .from('platform_admins')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (error || !admin) {
    return res.status(403).json({ error: 'No tienes acceso de administrador de plataforma' });
  }

  req.user = user;
  req.platformAdmin = admin;
  return handler(req, res);
}

module.exports = { withPlatformAdmin };
