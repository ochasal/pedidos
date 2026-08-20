/**
 * Cliente Supabase para el frontend
 * Usa la anon key (segura para el cliente, protegida por RLS)
 */
const { createClient } = supabase;

const supabaseClient = createClient(
  APP_CONFIG.SUPABASE_URL,
  APP_CONFIG.SUPABASE_ANON_KEY
);

/**
 * Helper para hacer requests a la API serverless
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${APP_CONFIG.API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };

  // Adjuntar token de sesión si existe
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    config.headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const response = await fetch(url, config);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Error ${response.status}`);
  }

  return data;
}
