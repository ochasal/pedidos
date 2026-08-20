/**
 * Panel Super-Admin de Plataforma - Main Controller
 */
(async function() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    showPlatformLogin();
    return;
  }

  // Verificar acceso platform admin
  try {
    await PlatformAPI.getDashboard();
    initPlatformPanel();
  } catch (err) {
    if (err.message.includes('403') || err.message.includes('plataforma')) {
      document.getElementById('app').innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;">
          <div class="card text-center" style="max-width:400px;">
            <h2>Acceso Denegado</h2>
            <p class="mt-2" style="color:var(--color-text-light)">Tu cuenta no tiene permisos de administrador de plataforma.</p>
            <button class="btn btn-ghost mt-4" onclick="supabaseClient.auth.signOut().then(()=>location.reload())">Cerrar Sesión</button>
          </div>
        </div>
      `;
    } else {
      showPlatformLogin();
    }
  }
})();

function showPlatformLogin() {
  document.getElementById('app').innerHTML = `
    <div style="display:flex; align-items:center; justify-content:center; min-height:100vh; background:var(--color-bg); width:100%;">
      <div class="card" style="width:100%; max-width:380px; padding:32px;">
        <div style="text-align:center; margin-bottom:24px;">
          <span class="platform-badge">Platform Admin</span>
          <h2 style="margin-top:12px; font-size:20px; font-weight:700;">Panel de Plataforma</h2>
          <p style="color:var(--color-text-muted); margin-top:6px; font-size:13px;">Solo administradores autorizados</p>
        </div>
        <form id="login-form">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" id="login-email" class="form-input" required placeholder="admin@plataforma.com">
          </div>
          <div class="form-group">
            <label class="form-label">Contraseña</label>
            <input type="password" id="login-password" class="form-input" required>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%; justify-content:center; padding:10px; margin-top:8px;">
            Acceder
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

function initPlatformPanel() {
  const sidebar = document.getElementById('admin-sidebar');
  const content = document.getElementById('admin-content');

  sidebar.innerHTML = `
    <div class="logo">
      <span class="platform-badge">Platform</span>
      <br><strong style="margin-top:0.5rem; display:inline-block;">Pedidos Admin</strong>
    </div>
    <div class="nav-section">Principal</div>
    <a class="nav-item active" data-section="dashboard">📊 Dashboard</a>
    <a class="nav-item" data-section="tenants">🏪 Negocios</a>
    <div style="flex:1"></div>
    <a class="nav-item" data-section="logout" style="color:var(--color-error);">🚪 Salir</a>
  `;

  sidebar.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const section = item.dataset.section;
      if (!section) return;
      sidebar.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      platformNavigate(section);
    });
  });

  platformNavigate('dashboard');
}

async function platformNavigate(section) {
  const content = document.getElementById('admin-content');

  switch (section) {
    case 'dashboard':
      content.innerHTML = UI.loading('Cargando métricas...');
      await renderPlatformDashboard(content);
      break;
    case 'tenants':
      content.innerHTML = UI.loading('Cargando negocios...');
      await renderPlatformTenants(content);
      break;
    case 'logout':
      await supabaseClient.auth.signOut();
      window.location.reload();
      break;
  }
}

// ===== Dashboard =====
async function renderPlatformDashboard(container) {
  try {
    const data = await PlatformAPI.getDashboard();

    container.innerHTML = `
      <div class="content-header">
        <h2>Dashboard de Plataforma</h2>
        <span class="platform-badge">Super Admin</span>
      </div>

      <div class="stats-grid">
        ${UI.statCard('Negocios Activos', `${data.overview.active_tenants}/${data.overview.total_tenants}`, '🏪')}
        ${UI.statCard('Pedidos Hoy', data.today.orders, '📋')}
        ${UI.statCard('Ingresos Hoy', '$' + data.today.revenue.toFixed(2), '💰')}
        ${UI.statCard('Pedidos Semana', data.week.orders, '📈')}
        ${UI.statCard('Empleados Activos', data.overview.total_employees, '👥')}
      </div>

      ${data.tenants_activity.length > 0 ? `
        <div class="card mt-4">
          <h3 style="margin-bottom:1rem;">Actividad por Negocio (última semana)</h3>
          ${UI.table(
            [
              { label: 'Negocio', render: row => `<strong>${row.name}</strong> <small style="color:var(--color-text-light)">/${row.slug}</small>` },
              { label: 'Estado', render: row => row.is_active ? '<span class="badge badge-green">Activo</span>' : '<span class="badge badge-red">Inactivo</span>' },
              { label: 'Pedidos (7d)', render: row => `<strong>${row.orders_this_week}</strong>` }
            ],
            data.tenants_activity,
            {}
          )}
        </div>
      ` : ''}
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Error: ${err.message}</p></div>`;
  }
}

// ===== Tenants =====
async function renderPlatformTenants(container) {
  try {
    const data = await PlatformAPI.getTenants();
    const tenants = data.tenants;

    container.innerHTML = `
      <div class="content-header">
        <h2>Negocios (${tenants.length})</h2>
        <button class="btn btn-primary" onclick="showCreateTenantForm()">+ Nuevo Negocio</button>
      </div>

      ${tenants.length === 0 ? '<div class="empty-state"><p>No hay negocios registrados. ¡Crea el primero!</p></div>' : ''}

      <div id="tenants-list">
        ${tenants.map(t => `
          <div class="tenant-card">
            <div class="tenant-info">
              <div class="tenant-name">
                ${t.tenant_config?.logo_url ? `<img src="${t.tenant_config.logo_url}" style="width:24px;height:24px;border-radius:4px;vertical-align:middle;margin-right:0.5rem;">` : ''}
                ${t.name}
                ${!t.is_active ? '<span class="badge badge-red" style="margin-left:0.5rem;">Inactivo</span>' : ''}
              </div>
              <div class="tenant-slug">/${t.slug}</div>
              <div class="tenant-meta">
                <span>📋 ${t.orders_count} pedidos</span>
                <span>👥 ${t.employees_count} empleados</span>
                <span>📅 ${new Date(t.created_at).toLocaleDateString('es')}</span>
              </div>
            </div>
            <div style="display:flex; gap:0.5rem; align-items:center;">
              <a href="/${t.slug}/admin" target="_blank" class="btn btn-sm btn-ghost">Panel ↗</a>
              <a href="/${t.slug}" target="_blank" class="btn btn-sm btn-ghost">Tienda ↗</a>
              <button class="btn btn-sm ${t.is_active ? 'btn-warning' : 'btn-success'}" onclick="toggleTenantStatus('${t.id}', ${t.is_active})">
                ${t.is_active ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          </div>
        `).join('')}
      </div>

      <div id="tenant-modal-container"></div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Error: ${err.message}</p></div>`;
  }
}

function showCreateTenantForm() {
  const formHtml = `
    <form onsubmit="createTenant(event)">
      <h4 style="margin-bottom:0.5rem; color:var(--color-text-light);">Datos del Negocio</h4>
      <div class="form-row">
        ${UI.formGroup('Nombre *', `<input type="text" name="name" class="form-input" required placeholder="Mi Restaurante">`)}
        ${UI.formGroup('Slug (URL) *', `<input type="text" name="slug" class="form-input" required placeholder="mi-restaurante" pattern="[a-z0-9-]+">`, 'Solo letras minúsculas, números y guiones')}
      </div>
      ${UI.formGroup('Color primario', `<input type="color" name="primary_color" class="form-input" value="#2563eb">`)}
      ${UI.formGroup('Tagline', `<input type="text" name="tagline" class="form-input" placeholder="Descripción corta del negocio">`)}

      <hr style="margin:1.5rem 0; border-color:var(--color-border);">
      <h4 style="margin-bottom:0.5rem; color:var(--color-text-light);">Owner (Administrador Principal)</h4>
      <div class="form-row">
        ${UI.formGroup('Nombre *', `<input type="text" name="owner_name" class="form-input" required placeholder="Juan Pérez">`)}
        ${UI.formGroup('Email *', `<input type="email" name="owner_email" class="form-input" required placeholder="juan@email.com">`)}
      </div>
      ${UI.formGroup('Contraseña', `<input type="password" name="owner_password" class="form-input" placeholder="Dejar vacío para generar una automática">`, 'Si se deja vacío se generará una contraseña temporal')}

      <div class="form-actions">
        <button type="button" class="btn btn-ghost" onclick="UI.closeModal('tenant-modal')">Cancelar</button>
        <button type="submit" class="btn btn-primary">Crear Negocio</button>
      </div>
    </form>
  `;

  document.getElementById('tenant-modal-container').innerHTML = UI.modal('tenant-modal', 'Nuevo Negocio', formHtml);
  UI.openModal('tenant-modal');
}

async function createTenant(e) {
  e.preventDefault();
  const form = e.target;

  const data = {
    name: form.name.value,
    slug: form.slug.value.toLowerCase().trim(),
    primary_color: form.primary_color.value,
    tagline: form.tagline.value,
    owner_name: form.owner_name.value,
    owner_email: form.owner_email.value,
    owner_password: form.owner_password.value || undefined
  };

  try {
    await PlatformAPI.createTenant(data);
    UI.toast('Negocio creado exitosamente');
    UI.closeModal('tenant-modal');
    renderPlatformTenants(document.getElementById('admin-content'));
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

async function toggleTenantStatus(id, currentlyActive) {
  const action = currentlyActive ? 'desactivar' : 'activar';
  if (!UI.confirm(`¿${action.charAt(0).toUpperCase() + action.slice(1)} este negocio?`)) return;

  try {
    await PlatformAPI.toggleTenant(id);
    UI.toast(`Negocio ${action}do`);
    renderPlatformTenants(document.getElementById('admin-content'));
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}
