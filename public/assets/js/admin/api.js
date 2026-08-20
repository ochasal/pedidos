/**
 * API Helper para el panel admin
 * Centraliza todas las llamadas a la API del admin
 */
const AdminAPI = {
  // Base path se construye con el slug del tenant actual
  get basePath() {
    return `${APP_CONFIG.API_BASE}/tenants/${getTenantSlug()}/admin`;
  },

  async request(endpoint, options = {}) {
    const url = `${this.basePath}${endpoint}`;
    const config = {
      headers: { 'Content-Type': 'application/json' },
      ...options
    };

    // Adjuntar token
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

  // Dashboard
  getDashboard() {
    return this.request('/dashboard');
  },

  // Pedidos
  getOrders(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/orders${qs ? '?' + qs : ''}`);
  },

  getOrder(id) {
    return this.request(`/orders?id=${id}`);
  },

  updateOrderStatus(orderId, status, notes = '') {
    const slug = getTenantSlug();
    return apiRequest(`/tenants/${slug}/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, notes })
    });
  },

  verifyPayment(paymentId, action, reason = '') {
    return this.request('/orders/verify-payment', {
      method: 'POST',
      body: { payment_id: paymentId, action, reason }
    });
  },

  // Productos
  getProducts() {
    return this.request('/products');
  },

  createProduct(data) {
    return this.request('/products', { method: 'POST', body: data });
  },

  updateProduct(id, data) {
    return this.request(`/products?id=${id}`, { method: 'PUT', body: data });
  },

  toggleProduct(id) {
    return this.request(`/products?id=${id}`, { method: 'PATCH' });
  },

  deleteProduct(id) {
    return this.request(`/products?id=${id}`, { method: 'DELETE' });
  },

  // Categorías
  getCategories() {
    return this.request('/categories');
  },

  createCategory(data) {
    return this.request('/categories', { method: 'POST', body: data });
  },

  updateCategory(id, data) {
    return this.request(`/categories?id=${id}`, { method: 'PUT', body: data });
  },

  deleteCategory(id) {
    return this.request(`/categories?id=${id}`, { method: 'DELETE' });
  },

  // Config
  getConfig() {
    return this.request('/config');
  },

  updateConfig(data) {
    return this.request('/config', { method: 'PUT', body: data });
  },

  // Monedas
  getCurrencies() {
    return this.request('/currencies');
  },

  createCurrency(data) {
    return this.request('/currencies', { method: 'POST', body: data });
  },

  updateCurrency(id, data) {
    return this.request(`/currencies?id=${id}`, { method: 'PUT', body: data });
  },

  deleteCurrency(id) {
    return this.request(`/currencies?id=${id}`, { method: 'DELETE' });
  },

  // Tasas de cambio
  getExchangeRates() {
    return this.request('/exchange-rates');
  },

  saveExchangeRate(data) {
    return this.request('/exchange-rates', { method: 'POST', body: data });
  },

  updateExchangeRate(id, data) {
    return this.request(`/exchange-rates?id=${id}`, { method: 'PUT', body: data });
  },

  deleteExchangeRate(id) {
    return this.request(`/exchange-rates?id=${id}`, { method: 'DELETE' });
  },

  // Métodos de pago
  getPaymentMethods() {
    return this.request('/payment-methods');
  },

  createPaymentMethod(data) {
    return this.request('/payment-methods', { method: 'POST', body: data });
  },

  updatePaymentMethod(id, data) {
    return this.request(`/payment-methods?id=${id}`, { method: 'PUT', body: data });
  },

  deletePaymentMethod(id) {
    return this.request(`/payment-methods?id=${id}`, { method: 'DELETE' });
  },

  // Horarios
  getHours() {
    return this.request('/hours');
  },

  updateHours(hours) {
    return this.request('/hours', { method: 'PUT', body: { hours } });
  },

  // Empleados
  getEmployees() {
    return this.request('/employees');
  },

  createEmployee(data) {
    return this.request('/employees', { method: 'POST', body: data });
  },

  updateEmployee(id, data) {
    return this.request(`/employees?id=${id}`, { method: 'PUT', body: data });
  },

  deleteEmployee(id) {
    return this.request(`/employees?id=${id}`, { method: 'DELETE' });
  }
};
