/**
 * Configuración global del frontend
 * Las credenciales de Supabase se exponen al cliente (anon key es pública por diseño)
 */
const APP_CONFIG = {
  SUPABASE_URL: 'https://ojkozwsnrjllxttjbwwc.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qa296d3NucmpsbHh0dGpid3djIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxNjk1MDcsImV4cCI6MjEwMjc0NTUwN30.voZzn36mos2eYV9am-m5GMNC3dHfmgeXU_eUv0RO7OM',
  API_BASE: '/api'
};

// Extraer slug del tenant desde la URL: /{slug}/...
function getTenantSlug() {
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  return pathParts[0] || null;
}
