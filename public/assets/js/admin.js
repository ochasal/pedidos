/**
 * Panel Admin - Main Controller
 * Maneja auth, layout, navegación y carga de secciones
 */
let adminTenant = null;
let currentEmployee = null;

(async function() {
  // Cargar info del tenant primero (es pública)
  const slug = getTenantSlug();
  if (!slug) {
    document.getElementById('app').innerHTML = '<div class="loading-spinner"><p>Slug no encontrado en URL</p></div>';
    return;
  }

  try {
    const tenantData = await apiRequest(`/store?slug=${slug}&action=tenant`);
    adminTenant = tenantData.tenant;
    applyTenantTheme(adminTenant);
  } catch (err) {
    document.getElementById('app').innerHTML = `<div class="loading-spinner"><p>Negocio no encontrado</p></div>`;
    return;
  }

  // Verificar sesión
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    showLogin();
    return;
  }

  initAdminPanel(session);
})();

function showLogin() {
  const logo = adminTenant?.config?.logo_url;
  const name = adminTenant?.name || 'Panel Admin';
  const color = adminTenant?.config?.primary_color || 'var(--color-primary)';

  document.getElementById('app').innerHTML = `
    <div style="display:flex; align-items:center; justify-content:center; min-height:100vh; background:var(--color-bg); width:100%;">
      <div class="card" style="width:100%; max-width:380px; padding:32px;">
        <div style="text-align:center; margin-bottom:24px;">
          ${logo ? `<img src="${logo}" style="height:48px; border-radius:var(--radius); margin-bottom:12px;">` : ''}
          <h2 style="font-size:20px; font-weight:700;">${name}</h2>
          <p style="color:var(--color-text-muted); margin-top:6px; font-size:13px;">Inicia sesión para administrar</p>
        </div>
        <form id="login-form">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" id="login-email" class="form-input" required placeholder="tu@email.com">
          </div>
          <div class="form-group">
            <label class="form-label">Contraseña</label>
            <input type="password" id="login-password" class="form-input" required placeholder="••••••••">
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%; justify-content:center; padding:10px; margin-top:8px; background:${color}; border-color:${color};">
            Iniciar Sesión
          </button>
          <p id="login-error" class="hidden" style="color:var(--color-error); text-align:center; margin-top:12px; font-size:12px;"></p>
        </form>
      </div>
    </div>
  `;

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    errorEl.classList.add('hidden');

    try {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.reload();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('hidden');
    }
  });
}

function initAdminPanel(session) {
  const sidebar = document.getElementById('admin-sidebar');
  const content = document.getElementById('admin-content');

  sidebar.innerHTML = `
    <div class="logo">
      <strong>${adminTenant.name}</strong>
      <br><small style="color:var(--color-text-muted)">Admin</small>
    </div>
    <div class="nav-section">Principal</div>
    <a class="nav-item active" data-section="dashboard">📊 Dashboard</a>
    <a class="nav-item" data-section="orders">📋 Pedidos</a>
    <div class="nav-section">Catálogo</div>
    <a class="nav-item" data-section="products">🛍 Productos</a>
    <a class="nav-item" data-section="categories">📁 Categorías</a>
    <div class="nav-section">Configuración</div>
    <a class="nav-item" data-section="payments">💳 Métodos de Pago</a>
    <a class="nav-item" data-section="currencies">💱 Monedas</a>
    <a class="nav-item" data-section="hours">🕐 Horarios</a>
    <a class="nav-item" data-section="config">⚙ Mi Negocio</a>
    <a class="nav-item" data-section="employees">👥 Empleados</a>
    <div style="flex:1"></div>
    <a class="nav-item" data-section="logout" style="color:var(--color-error);">🚪 Cerrar Sesión</a>
  `;

  // Mobile menu toggle
  const mobileToggle = document.createElement('button');
  mobileToggle.className = 'btn btn-ghost mobile-menu-btn';
  mobileToggle.innerHTML = '☰';
  mobileToggle.style.cssText = 'display:none; position:fixed; top:1rem; left:1rem; z-index:50;';
  mobileToggle.onclick = () => sidebar.classList.toggle('open');
  document.body.appendChild(mobileToggle);

  if (window.innerWidth <= 768) mobileToggle.style.display = 'block';
  window.addEventListener('resize', () => {
    mobileToggle.style.display = window.innerWidth <= 768 ? 'block' : 'none';
  });

  // Navegación
  sidebar.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const section = item.dataset.section;
      if (!section) return;

      sidebar.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      sidebar.classList.remove('open');
      navigateTo(section);
    });
  });

  // Cargar dashboard
  navigateTo('dashboard');
}

async function navigateTo(section) {
  const content = document.getElementById('admin-content');

  switch (section) {
    case 'dashboard':
      content.innerHTML = UI.loading('Cargando dashboard...');
      await renderDashboard(content);
      break;
    case 'orders':
      content.innerHTML = UI.loading('Cargando pedidos...');
      await renderOrders(content);
      break;
    case 'products':
      content.innerHTML = UI.loading('Cargando productos...');
      await renderProducts(content);
      break;
    case 'categories':
      content.innerHTML = UI.loading('Cargando categorías...');
      await renderCategories(content);
      break;
    case 'payments':
      content.innerHTML = UI.loading('Cargando métodos de pago...');
      await renderPaymentMethods(content);
      break;
    case 'currencies':
      content.innerHTML = UI.loading('Cargando monedas...');
      await renderCurrencies(content);
      break;
    case 'hours':
      content.innerHTML = UI.loading('Cargando horarios...');
      await renderHours(content);
      break;
    case 'config':
      content.innerHTML = UI.loading('Cargando configuración...');
      await renderConfig(content);
      break;
    case 'employees':
      content.innerHTML = UI.loading('Cargando empleados...');
      await renderEmployees(content);
      break;
    case 'logout':
      await supabaseClient.auth.signOut();
      window.location.reload();
      break;
  }
}
