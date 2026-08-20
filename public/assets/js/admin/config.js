/**
 * Sección: Configuración del Negocio
 */
async function renderConfig(container) {
  try {
    const data = await AdminAPI.getConfig();
    const config = data.config;
    const tenant = data.tenant;

    container.innerHTML = `
      <div class="content-header">
        <h2>Configuración del Negocio</h2>
      </div>

      <form id="config-form" onsubmit="saveConfig(event)">
        <div class="card mb-4">
          <h3 style="margin-bottom:1rem;">Información General</h3>
          <div class="form-row">
            ${UI.formGroup('Nombre del Negocio', `<input type="text" name="name" class="form-input" value="${tenant.name}" required>`)}
            ${UI.formGroup('Tagline / Eslogan', `<input type="text" name="tagline" class="form-input" value="${config.tagline || ''}" placeholder="Los mejores pasteles...">`)}
          </div>
          <div class="form-row">
            ${UI.formGroup('Teléfono', `<input type="tel" name="phone" class="form-input" value="${config.phone || ''}">`)}
            ${UI.formGroup('WhatsApp', `<input type="tel" name="whatsapp_number" class="form-input" value="${config.whatsapp_number || ''}" placeholder="+58...">`)}
          </div>
          <div class="form-row">
            ${UI.formGroup('Email', `<input type="email" name="email" class="form-input" value="${config.email || ''}">`)}
            ${UI.formGroup('Dirección', `<input type="text" name="address" class="form-input" value="${config.address || ''}">`)}
          </div>
        </div>

        <div class="card mb-4">
          <h3 style="margin-bottom:1rem;">Branding</h3>
          <div class="form-row">
            ${UI.formGroup('Color Primario', `<input type="color" name="primary_color" class="form-input" value="${config.primary_color || '#2563eb'}">`)}
            ${UI.formGroup('Color Primario Oscuro', `<input type="color" name="primary_color_dark" class="form-input" value="${config.primary_color_dark || '#1d4ed8'}">`)}
          </div>
          <div class="form-row">
            ${UI.formGroup('Color de Acento', `<input type="color" name="accent_color" class="form-input" value="${config.accent_color || '#f59e0b'}">`)}
            <div class="form-group">
              <label class="form-label">Logo del negocio</label>
              <div class="image-upload-area" id="logo-upload-area" style="min-height:80px;">
                <div id="logo-preview">
                  ${config.logo_url ? `<img src="${config.logo_url}" class="image-preview" style="max-height:80px; width:auto; margin:auto;">` : '<div class="image-placeholder">Subir logo</div>'}
                </div>
                <input type="file" id="logo-file" accept="image/*" onchange="handleLogoUpload(this)" style="display:none;">
                <input type="hidden" name="logo_url" id="logo-url-value" value="${config.logo_url || ''}">
              </div>
              <div id="logo-upload-status" style="font-size:11px; margin-top:4px;"></div>
            </div>
          </div>
        </div>

        <div class="card mb-4">
          <h3 style="margin-bottom:1rem;">Delivery y Pedidos</h3>
          <div class="form-row">
            <div class="form-group">
              <label class="toggle">
                <input type="checkbox" name="delivery_enabled" ${config.delivery_enabled ? 'checked' : ''}>
                <span class="slider"></span>
              </label>
              <span style="margin-left:0.5rem;">Delivery habilitado</span>
            </div>
            <div class="form-group">
              <label class="toggle">
                <input type="checkbox" name="pickup_enabled" ${config.pickup_enabled ? 'checked' : ''}>
                <span class="slider"></span>
              </label>
              <span style="margin-left:0.5rem;">Retiro en tienda habilitado</span>
            </div>
          </div>
          <div class="form-row">
            ${UI.formGroup('Pedido Mínimo ($)', `<input type="number" name="min_order_amount" class="form-input" step="0.01" value="${config.min_order_amount || 0}">`)}
            ${UI.formGroup('Costo de Delivery ($)', `<input type="number" name="delivery_fee" class="form-input" step="0.01" value="${config.delivery_fee || 0}">`)}
          </div>
        </div>

        <div class="card mb-4">
          <h3 style="margin-bottom:1rem;">Reglas de Pago</h3>
          <div class="form-group">
            <label class="toggle">
              <input type="checkbox" name="require_full_payment_before_delivery" ${config.require_full_payment_before_delivery ? 'checked' : ''}>
              <span class="slider"></span>
            </label>
            <span style="margin-left:0.5rem;">Requiere pago completo antes de entregar</span>
          </div>
          <div class="form-group">
            <label class="toggle">
              <input type="checkbox" name="allow_cash_without_prepayment" ${config.allow_cash_without_prepayment ? 'checked' : ''}>
              <span class="slider"></span>
            </label>
            <span style="margin-left:0.5rem;">Permitir entrega con efectivo sin prepago</span>
          </div>
          <div class="form-group">
            <label class="toggle">
              <input type="checkbox" name="auto_close_after_hours" ${config.auto_close_after_hours ? 'checked' : ''}>
              <span class="slider"></span>
            </label>
            <span style="margin-left:0.5rem;">Cerrar pedidos fuera de horario automáticamente</span>
          </div>
        </div>

        <div class="card mb-4">
          <h3 style="margin-bottom:1rem;">WhatsApp Notifications</h3>
          <div class="form-group">
            <label class="toggle">
              <input type="checkbox" name="whatsapp_notifications_enabled" ${config.whatsapp_notifications_enabled ? 'checked' : ''}>
              <span class="slider"></span>
            </label>
            <span style="margin-left:0.5rem;">Activar notificaciones por WhatsApp</span>
          </div>
          <div class="form-row">
            ${UI.formGroup('URL API WhatsApp', `<input type="url" name="whatsapp_api_url" class="form-input" value="${config.whatsapp_api_url || ''}">`)}
            ${UI.formGroup('Token API', `<input type="password" name="whatsapp_api_token" class="form-input" value="${config.whatsapp_api_token || ''}">`)}
          </div>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary">💾 Guardar Configuración</button>
        </div>
      </form>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Error: ${err.message}</p></div>`;
  }
}

async function saveConfig(e) {
  e.preventDefault();
  const form = e.target;

  const data = {
    name: form.name.value,
    tagline: form.tagline.value,
    phone: form.phone.value,
    whatsapp_number: form.whatsapp_number.value,
    email: form.email.value,
    address: form.address.value,
    primary_color: form.primary_color.value,
    primary_color_dark: form.primary_color_dark.value,
    accent_color: form.accent_color.value,
    logo_url: form.logo_url.value,
    favicon_url: form.logo_url.value,
    delivery_enabled: form.delivery_enabled.checked,
    pickup_enabled: form.pickup_enabled.checked,
    min_order_amount: parseFloat(form.min_order_amount.value) || 0,
    delivery_fee: parseFloat(form.delivery_fee.value) || 0,
    require_full_payment_before_delivery: form.require_full_payment_before_delivery.checked,
    allow_cash_without_prepayment: form.allow_cash_without_prepayment.checked,
    auto_close_after_hours: form.auto_close_after_hours.checked,
    whatsapp_notifications_enabled: form.whatsapp_notifications_enabled.checked,
    whatsapp_api_url: form.whatsapp_api_url.value,
    whatsapp_api_token: form.whatsapp_api_token.value
  };

  try {
    await AdminAPI.updateConfig(data);
    UI.toast('Configuración guardada');
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}
