/**
 * API Helper para el panel admin del tenant
 */
const AdminAPI = {
  get slug() { return getTenantSlug(); },

  async request(action, options = {}) {
    const url = `/api/admin?slug=${this.slug}&action=${action}${options.params || ''}`;
    const config = { headers: { 'Content-Type': 'application/json' }, ...options };
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) config.headers['Authorization'] = `Bearer ${session.access_token}`;
    if (config.body && typeof config.body === 'object') config.body = JSON.stringify(config.body);
    const response = await fetch(url, config);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
    return data;
  },

  // Dashboard
  getDashboard() { return this.request('dashboard'); },

  // Pedidos
  getOrders(params = {}) { const qs = Object.entries(params).filter(([,v]) => v).map(([k,v]) => `&${k}=${v}`).join(''); return this.request('orders', { params: qs }); },
  getOrder(id) { return this.request('order-detail', { params: `&id=${id}` }); },
  updateOrderStatus(orderId, status, notes = '') { return this.request('order-status', { method: 'POST', body: { order_id: orderId, status, notes } }); },
  verifyPayment(paymentId, action, reason = '') { return this.request('verify-payment', { method: 'POST', body: { payment_id: paymentId, action, reason } }); },

  // Productos
  getProducts() { return this.request('products'); },
  createProduct(data) { return this.request('products', { method: 'POST', body: data }); },
  updateProduct(id, data) { return this.request('products', { method: 'PUT', body: data, params: `&id=${id}` }); },
  toggleProduct(id) { return this.request('products', { method: 'PATCH', params: `&id=${id}` }); },
  deleteProduct(id) { return this.request('products', { method: 'DELETE', params: `&id=${id}` }); },

  // Categorías
  getCategories() { return this.request('categories'); },
  createCategory(data) { return this.request('categories', { method: 'POST', body: data }); },
  updateCategory(id, data) { return this.request('categories', { method: 'PUT', body: data, params: `&id=${id}` }); },
  deleteCategory(id) { return this.request('categories', { method: 'DELETE', params: `&id=${id}` }); },

  // Config
  getConfig() { return this.request('config'); },
  updateConfig(data) { return this.request('config', { method: 'PUT', body: data }); },

  // Monedas
  getCurrencies() { return this.request('currencies'); },
  createCurrency(data) { return this.request('currencies', { method: 'POST', body: data }); },
  updateCurrency(id, data) { return this.request('currencies', { method: 'PUT', body: data, params: `&id=${id}` }); },
  deleteCurrency(id) { return this.request('currencies', { method: 'DELETE', params: `&id=${id}` }); },

  // Tasas de cambio
  getExchangeRates() { return this.request('exchange-rates'); },
  saveExchangeRate(data) { return this.request('exchange-rates', { method: 'POST', body: data }); },
  updateExchangeRate(id, data) { return this.request('exchange-rates', { method: 'PUT', body: data, params: `&id=${id}` }); },
  deleteExchangeRate(id) { return this.request('exchange-rates', { method: 'DELETE', params: `&id=${id}` }); },

  // Métodos de pago
  getPaymentMethods() { return this.request('payment-methods'); },
  createPaymentMethod(data) { return this.request('payment-methods', { method: 'POST', body: data }); },
  updatePaymentMethod(id, data) { return this.request('payment-methods', { method: 'PUT', body: data, params: `&id=${id}` }); },
  deletePaymentMethod(id) { return this.request('payment-methods', { method: 'DELETE', params: `&id=${id}` }); },

  // Horarios
  getHours() { return this.request('hours'); },
  updateHours(hours) { return this.request('hours', { method: 'PUT', body: { hours } }); },

  // Empleados
  getEmployees() { return this.request('employees'); },
  createEmployee(data) { return this.request('employees', { method: 'POST', body: data }); },
  updateEmployee(id, data) { return this.request('employees', { method: 'PUT', body: data, params: `&id=${id}` }); },
  deleteEmployee(id) { return this.request('employees', { method: 'DELETE', params: `&id=${id}` }); }
};
