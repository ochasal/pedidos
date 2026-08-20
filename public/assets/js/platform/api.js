/**
 * API Helper para el panel super-admin de plataforma
 */
const PlatformAPI = {
  basePath: '/api/platform',

  async request(endpoint, options = {}) {
    const url = `${this.basePath}${endpoint}`;
    const config = {
      headers: { 'Content-Type': 'application/json' },
      ...options
    };

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      config.headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Error ${response.status}`);
    }
    return data;
  },

  getDashboard() {
    return this.request('/dashboard');
  },

  getTenants() {
    return this.request('/tenants');
  },

  createTenant(data) {
    return this.request('/tenants', { method: 'POST', body: data });
  },

  updateTenant(id, data) {
    return this.request(`/tenants?id=${id}`, { method: 'PUT', body: data });
  },

  toggleTenant(id) {
    return this.request(`/tenants?id=${id}`, { method: 'PATCH' });
  }
};
