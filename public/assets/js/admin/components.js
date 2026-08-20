/**
 * Componentes UI reutilizables del panel admin
 */
const UI = {
  /**
   * Modal genérico
   */
  modal(id, title, bodyHtml, footerHtml = '') {
    return `
      <div class="modal-overlay" id="${id}" onclick="UI.closeModal('${id}', event)">
        <div class="modal" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h3>${title}</h3>
            <button class="modal-close" onclick="UI.closeModal('${id}')">&times;</button>
          </div>
          <div class="modal-body">${bodyHtml}</div>
          ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
        </div>
      </div>
    `;
  },

  openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  },

  closeModal(id, event) {
    if (event && event.target !== event.currentTarget) return;
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  },

  /**
   * Toast notification
   */
  toast(message, type = 'success') {
    const container = document.getElementById('toast-container') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  /**
   * Confirm dialog
   */
  confirm(message) {
    return window.confirm(message);
  },

  /**
   * Tabla genérica
   */
  table(columns, rows, options = {}) {
    const { emptyMessage = 'No hay datos', actions = null } = options;

    if (rows.length === 0) {
      return `<div class="empty-state"><p>${emptyMessage}</p></div>`;
    }

    let html = '<div class="table-responsive"><table class="admin-table"><thead><tr>';
    columns.forEach(col => {
      html += `<th>${col.label}</th>`;
    });
    if (actions) html += '<th>Acciones</th>';
    html += '</tr></thead><tbody>';

    rows.forEach(row => {
      html += '<tr>';
      columns.forEach(col => {
        const value = col.render ? col.render(row) : (row[col.key] || '');
        html += `<td>${value}</td>`;
      });
      if (actions) html += `<td class="actions-cell">${actions(row)}</td>`;
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    return html;
  },

  /**
   * Badge de estado
   */
  statusBadge(status) {
    const statusConfig = {
      'recibido': { color: 'blue', label: 'Recibido' },
      'procesando_pago': { color: 'yellow', label: 'Procesando Pago' },
      'en_preparacion': { color: 'orange', label: 'En Preparación' },
      'preparado': { color: 'purple', label: 'Preparado' },
      'en_camino': { color: 'cyan', label: 'En Camino' },
      'completado': { color: 'green', label: 'Completado' },
      'cancelado': { color: 'red', label: 'Cancelado' },
      'pending': { color: 'yellow', label: 'Pendiente' },
      'verified': { color: 'green', label: 'Verificado' },
      'rejected': { color: 'red', label: 'Rechazado' }
    };
    const cfg = statusConfig[status] || { color: 'gray', label: status };
    return `<span class="badge badge-${cfg.color}">${cfg.label}</span>`;
  },

  /**
   * Card de estadística
   */
  statCard(label, value, icon = '') {
    return `
      <div class="stat-card">
        ${icon ? `<div class="stat-icon">${icon}</div>` : ''}
        <div class="stat-info">
          <div class="stat-value">${value}</div>
          <div class="stat-label">${label}</div>
        </div>
      </div>
    `;
  },

  /**
   * Form group helper
   */
  formGroup(label, inputHtml, helpText = '') {
    return `
      <div class="form-group">
        <label class="form-label">${label}</label>
        ${inputHtml}
        ${helpText ? `<small class="form-help">${helpText}</small>` : ''}
      </div>
    `;
  },

  /**
   * Select input
   */
  select(name, options, selected = '', attrs = '') {
    let html = `<select name="${name}" class="form-input" ${attrs}>`;
    options.forEach(opt => {
      const sel = opt.value == selected ? 'selected' : '';
      html += `<option value="${opt.value}" ${sel}>${opt.label}</option>`;
    });
    html += '</select>';
    return html;
  },

  /**
   * Loading spinner
   */
  loading(text = 'Cargando...') {
    return `<div class="loading-spinner"><div class="spinner"></div><p>${text}</p></div>`;
  },

  /**
   * Paginación
   */
  pagination(current, total, onClickFn) {
    if (total <= 1) return '';
    let html = '<div class="pagination">';
    for (let i = 1; i <= total; i++) {
      const active = i === current ? 'active' : '';
      html += `<button class="page-btn ${active}" onclick="${onClickFn}(${i})">${i}</button>`;
    }
    html += '</div>';
    return html;
  }
};

function createToastContainer() {
  const container = document.createElement('div');
  container.id = 'toast-container';
  document.body.appendChild(container);
  return container;
}
