/**
 * Sección: Pedidos
 */
let ordersFilters = { status: '', page: 1 };

async function renderOrders(container) {
  try {
    const data = await AdminAPI.getOrders(ordersFilters);

    container.innerHTML = `
      <div class="content-header">
        <h2>Pedidos</h2>
      </div>

      <div class="filters-bar">
        <select class="form-input" onchange="filterOrders('status', this.value)">
          <option value="">Todos los estados</option>
          <option value="recibido" ${ordersFilters.status === 'recibido' ? 'selected' : ''}>Recibido</option>
          <option value="procesando_pago" ${ordersFilters.status === 'procesando_pago' ? 'selected' : ''}>Procesando Pago</option>
          <option value="en_preparacion" ${ordersFilters.status === 'en_preparacion' ? 'selected' : ''}>En Preparación</option>
          <option value="preparado" ${ordersFilters.status === 'preparado' ? 'selected' : ''}>Preparado</option>
          <option value="en_camino" ${ordersFilters.status === 'en_camino' ? 'selected' : ''}>En Camino</option>
          <option value="completado" ${ordersFilters.status === 'completado' ? 'selected' : ''}>Completado</option>
          <option value="cancelado" ${ordersFilters.status === 'cancelado' ? 'selected' : ''}>Cancelado</option>
        </select>
        <input type="search" class="form-input" placeholder="Buscar cliente..." 
          onchange="filterOrders('search', this.value)" value="${ordersFilters.search || ''}">
      </div>

      ${data.orders.length === 0 ? '<div class="empty-state"><p>No hay pedidos</p></div>' : `
        ${UI.table(
          [
            { label: '#', render: row => `<strong>${row.order_number}</strong>` },
            { label: 'Cliente', render: row => `${row.customer_name}<br><small style="color:var(--color-text-light)">${row.customer_phone || ''}</small>` },
            { label: 'Estado', render: row => UI.statusBadge(row.status) },
            { label: 'Total', render: row => `$${parseFloat(row.total).toFixed(2)}` },
            { label: 'Pagado', render: row => row.payment_complete ? '<span style="color:var(--color-success)">✓ Sí</span>' : `$${parseFloat(row.total_paid).toFixed(2)}` },
            { label: 'Pendientes', render: row => row.pending_payments > 0 ? `<span class="badge badge-yellow">${row.pending_payments} pago(s)</span>` : '-' },
            { label: 'Fecha', render: row => new Date(row.created_at).toLocaleString('es', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) }
          ],
          data.orders,
          {
            actions: row => `
              <button class="btn btn-sm btn-primary" onclick="viewOrderDetail('${row.id}')">Ver detalle</button>
            `
          }
        )}

        ${UI.pagination(data.pagination.page, data.pagination.pages, 'goToOrdersPage')}
      `}
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Error: ${err.message}</p></div>`;
  }
}

function filterOrders(key, value) {
  ordersFilters[key] = value;
  ordersFilters.page = 1;
  renderOrders(document.getElementById('admin-content'));
}

function goToOrdersPage(page) {
  ordersFilters.page = page;
  renderOrders(document.getElementById('admin-content'));
}

async function viewOrderDetail(orderId) {
  const content = document.getElementById('admin-content');
  content.innerHTML = UI.loading('Cargando detalle...');

  try {
    const data = await AdminAPI.getOrder(orderId);
    const order = data.order;

    const nextStatuses = getNextStatuses(order.status);

    content.innerHTML = `
      <div class="content-header">
        <h2>
          <button class="btn btn-ghost btn-sm" onclick="renderOrders(document.getElementById('admin-content'))">← Volver</button>
          Pedido #${order.order_number}
        </h2>
        ${UI.statusBadge(order.status)}
      </div>

      <div class="order-detail-grid">
        <div class="order-info-card">
          <h4>Cliente</h4>
          <p><strong>${order.customer_name}</strong></p>
          <p>📱 ${order.customer_phone || 'No registrado'}</p>
          <p>📧 ${order.customer_email || 'No registrado'}</p>
          ${order.customer_address ? `<p>📍 ${order.customer_address}</p>` : ''}
          <p style="margin-top:0.5rem;">Tipo: <strong>${order.order_type === 'delivery' ? '🛵 Delivery' : '🏪 Retiro'}</strong></p>
          ${order.notes ? `<p style="margin-top:0.5rem; padding:0.5rem; background:var(--color-bg); border-radius:var(--radius);">📝 ${order.notes}</p>` : ''}
        </div>

        <div class="order-info-card">
          <h4>Resumen</h4>
          <p>Subtotal: <strong>$${parseFloat(order.subtotal).toFixed(2)}</strong></p>
          <p>Delivery: <strong>$${parseFloat(order.delivery_fee).toFixed(2)}</strong></p>
          <p style="font-size:1.1rem; margin-top:0.5rem;">Total: <strong>$${parseFloat(order.total).toFixed(2)}</strong></p>
          <hr style="margin:0.75rem 0; border-color:var(--color-border);">
          <p>Pagado: <strong>$${parseFloat(order.total_paid).toFixed(2)}</strong></p>
          <p>Pago completo: ${order.payment_complete ? '<span style="color:var(--color-success)">✓ Sí</span>' : '<span style="color:var(--color-error)">✗ No</span>'}</p>
        </div>
      </div>

      <!-- Items -->
      <div class="card mt-4">
        <h4 style="margin-bottom:0.75rem;">Productos (${order.order_items?.length || 0})</h4>
        <table class="admin-table">
          <thead><tr><th>Producto</th><th>Precio</th><th>Cant.</th><th>Subtotal</th></tr></thead>
          <tbody>
            ${(order.order_items || []).map(item => `
              <tr>
                <td>${item.product_name}${item.notes ? `<br><small>${item.notes}</small>` : ''}</td>
                <td>$${parseFloat(item.product_price).toFixed(2)}</td>
                <td>${item.quantity}</td>
                <td>$${parseFloat(item.subtotal).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Pagos -->
      <div class="card mt-4">
        <h4 style="margin-bottom:0.75rem;">Pagos (${order.order_payments?.length || 0})</h4>
        ${(order.order_payments || []).length === 0 ? '<p style="color:var(--color-text-light)">Sin pagos registrados</p>' : `
          <table class="admin-table">
            <thead><tr><th>Método</th><th>Monto</th><th>Referencia</th><th>Estado</th><th>Acción</th></tr></thead>
            <tbody>
              ${(order.order_payments || []).map(pay => `
                <tr>
                  <td>${pay.payment_methods?.name || 'N/A'} <small>(${pay.currencies?.symbol || ''})</small></td>
                  <td>${pay.currencies?.symbol || '$'}${parseFloat(pay.amount).toFixed(2)}</td>
                  <td>${pay.reference_number || '-'}${pay.proof_url ? ` <a href="${pay.proof_url}" target="_blank">📎</a>` : ''}</td>
                  <td>${UI.statusBadge(pay.status)}</td>
                  <td>
                    ${pay.status === 'pending' ? `
                      <button class="btn btn-sm btn-success" onclick="verifyPayment('${pay.id}', 'verify')">Verificar</button>
                      <button class="btn btn-sm btn-danger" onclick="rejectPayment('${pay.id}')">Rechazar</button>
                    ` : (pay.rejection_reason ? `<small>${pay.rejection_reason}</small>` : '')}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>

      <!-- Cambiar Estado -->
      ${!['completado', 'cancelado'].includes(order.status) ? `
        <div class="card mt-4">
          <h4 style="margin-bottom:0.75rem;">Cambiar Estado</h4>
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
            ${nextStatuses.map(s => `
              <button class="btn ${s === 'cancelado' ? 'btn-danger' : 'btn-primary'}" 
                onclick="changeOrderStatus('${order.id}', '${s}')">
                ${getStatusLabel(s)}
              </button>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Historial -->
      <div class="card mt-4">
        <h4 style="margin-bottom:0.75rem;">Historial</h4>
        ${(order.order_status_history || []).map(h => `
          <div style="padding:0.5rem 0; border-bottom:1px solid var(--color-border); display:flex; justify-content:space-between;">
            <div>
              ${UI.statusBadge(h.status)}
              ${h.notes ? `<small style="margin-left:0.5rem">${h.notes}</small>` : ''}
            </div>
            <small style="color:var(--color-text-light)">
              ${new Date(h.created_at).toLocaleString('es')}
              ${h.employees ? ` - ${h.employees.name}` : ''}
            </small>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><p>Error: ${err.message}</p></div>`;
  }
}

async function changeOrderStatus(orderId, newStatus) {
  let notes = '';
  if (newStatus === 'cancelado') {
    notes = prompt('Razón de cancelación:');
    if (notes === null) return;
  }

  try {
    await AdminAPI.updateOrderStatus(orderId, newStatus, notes);
    UI.toast(`Estado cambiado a: ${getStatusLabel(newStatus)}`);
    viewOrderDetail(orderId);
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

async function verifyPayment(paymentId, action) {
  try {
    const result = await AdminAPI.verifyPayment(paymentId, action);
    UI.toast('Pago verificado');
    // Recargar el detalle del pedido actual
    const backBtn = document.querySelector('[onclick*="renderOrders"]');
    const orderId = window._currentOrderId;
    location.reload();
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

async function rejectPayment(paymentId) {
  const reason = prompt('Razón del rechazo:');
  if (!reason) return;

  try {
    await AdminAPI.verifyPayment(paymentId, 'reject', reason);
    UI.toast('Pago rechazado', 'warning');
    location.reload();
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

function getNextStatuses(current) {
  const transitions = {
    'recibido': ['procesando_pago', 'en_preparacion', 'cancelado'],
    'procesando_pago': ['en_preparacion', 'cancelado'],
    'en_preparacion': ['preparado', 'cancelado'],
    'preparado': ['en_camino', 'cancelado'],
    'en_camino': ['completado', 'cancelado']
  };
  return transitions[current] || [];
}

function getStatusLabel(status) {
  const labels = {
    'recibido': 'Recibido',
    'procesando_pago': 'Procesando Pago',
    'en_preparacion': 'En Preparación',
    'preparado': 'Preparado',
    'en_camino': 'En Camino',
    'completado': 'Completado',
    'cancelado': 'Cancelar'
  };
  return labels[status] || status;
}
