/**
 * Tracking público de pedidos por token
 * URL: /{slug}/pedido/{token}
 */
(async function() {
  const tenant = await loadTenant();
  if (!tenant) return;

  const pathParts = window.location.pathname.split('/').filter(Boolean);
  // Formato: /{slug}/pedido/{token}
  const token = pathParts[2] || null;

  if (!token) {
    showError('No se proporcionó un token de pedido.');
    return;
  }

  await loadOrderTracking(tenant.slug, token);
})();

async function loadOrderTracking(slug, token) {
  const content = document.getElementById('tracking-content');

  try {
    const response = await apiRequest(`/tenants/${slug}/orders/track/${token}`);
    renderTracking(content, response.order);
  } catch (error) {
    showError(`No se pudo cargar el pedido: ${error.message}`);
  }
}

function renderTracking(container, order) {
  const statuses = [
    { key: 'recibido', label: 'Pedido Recibido' },
    { key: 'procesando_pago', label: 'Procesando Pago' },
    { key: 'en_preparacion', label: 'En Preparación' },
    { key: 'preparado', label: 'Preparado' },
    { key: 'en_camino', label: 'En Camino' },
    { key: 'completado', label: 'Completado' }
  ];

  const currentIndex = statuses.findIndex(s => s.key === order.status);

  let timelineHtml = '';
  statuses.forEach((status, index) => {
    let stepClass = '';
    if (index < currentIndex) stepClass = 'completed';
    else if (index === currentIndex) stepClass = 'active';

    const historyEntry = order.status_history?.find(h => h.status === status.key);
    const timeStr = historyEntry ? new Date(historyEntry.created_at).toLocaleString('es') : '';

    timelineHtml += `
      <div class="timeline-step ${stepClass}">
        <span class="dot"></span>
        <div class="step-title">${status.label}</div>
        ${timeStr ? `<div class="step-time">${timeStr}</div>` : ''}
      </div>
    `;
  });

  container.innerHTML = `
    <div class="tracking-header">
      <h1>Seguimiento de Pedido</h1>
      <p>Pedido #${order.order_number}</p>
    </div>

    <div class="tracking-timeline">
      ${timelineHtml}
    </div>

    <div class="order-summary">
      <h3>Resumen</h3>
      <p class="mt-2"><strong>Cliente:</strong> ${order.customer_name}</p>
      <p><strong>Total:</strong> ${order.total}</p>
      <p><strong>Estado:</strong> ${order.status}</p>
    </div>
  `;
}

function showError(message) {
  const content = document.getElementById('tracking-content');
  content.innerHTML = `
    <div class="card text-center">
      <h2>Error</h2>
      <p class="mt-2">${message}</p>
    </div>
  `;
}
