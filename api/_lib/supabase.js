/**
 * Cliente Supabase para serverless functions (backend)
 * Usa service_role para bypass de RLS cuando es necesario,
 * o el token del usuario para operaciones autenticadas.
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Cliente con service_role - acceso total, bypassa RLS.
 * Usar solo en operaciones del servidor que lo requieran
 * (ej: tracking público, creación de tenants, operaciones admin de plataforma)
 */
function getServiceClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

/**
 * Cliente con anon key - respeta RLS.
 * Para operaciones públicas (catálogo, crear pedido)
 */
function getAnonClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

/**
 * Cliente autenticado con el token del usuario (desde Authorization header).
 * Respeta RLS con el contexto del usuario.
 */
function getAuthenticatedClient(req) {
  const token = extractToken(req);
  if (!token) return null;

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  return client;
}

/**
 * Extrae el Bearer token del header Authorization
 */
function extractToken(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.substring(7);
}

/**
 * Verifica y decodifica el token del usuario.
 * Retorna el user o null si no es válido.
 */
async function getUser(req) {
  const token = extractToken(req);
  if (!token) return null;

  const client = getServiceClient();
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

module.exports = {
  getServiceClient,
  getAnonClient,
  getAuthenticatedClient,
  getUser,
  extractToken
};
