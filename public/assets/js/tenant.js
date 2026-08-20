/**
 * Resolución y carga de configuración del tenant
 * Identifica el tenant por slug en la URL y carga su config
 */
let currentTenant = null;

async function loadTenant() {
  const slug = getTenantSlug();

  if (!slug) {
    document.getElementById('app').innerHTML = `
      <div class="loading">
        <p>No se encontró el negocio. Verifica la URL.</p>
      </div>
    `;
    return null;
  }

  try {
    const response = await apiRequest(`/tenants/${slug}`);
    currentTenant = response.tenant;
    applyTenantTheme(currentTenant);
    return currentTenant;
  } catch (error) {
    document.getElementById('app').innerHTML = `
      <div class="loading">
        <p>Negocio no encontrado: <strong>${slug}</strong></p>
      </div>
    `;
    return null;
  }
}

/**
 * Aplica colores y branding del tenant via CSS variables
 */
function applyTenantTheme(tenant) {
  if (!tenant || !tenant.config) return;

  const config = tenant.config;
  const root = document.documentElement;

  if (config.primary_color) root.style.setProperty('--color-primary', config.primary_color);
  if (config.primary_color_dark) root.style.setProperty('--color-primary-dark', config.primary_color_dark);
  if (config.accent_color) root.style.setProperty('--color-accent', config.accent_color);

  // Actualizar título de la página
  if (tenant.name) {
    document.title = `${tenant.name} - Pedidos`;
  }

  // Favicon dinámico
  if (config.favicon_url) {
    let link = document.querySelector("link[rel~='icon']") || document.createElement('link');
    link.rel = 'icon';
    link.href = config.favicon_url;
    document.head.appendChild(link);
  }
}
