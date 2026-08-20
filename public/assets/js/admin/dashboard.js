/**
 * Sección: Dashboard
 */
async function renderDashboard(container) {
  try {
    const data = await AdminAPI.getDashboard();

    container.innerHTML = `
      <div class="content-header">
        <h2>Dashboard</h2>
        <span style="color:var(--color-text-light); font-size:0.85rem;">
          ${new Date().toLocaleDateString('es', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
      </div>

      <div class="stats-grid">
        ${UI.statCard('Pedidos Hoy', data.today.orders, '📋')}
        ${UI.statCard('Ingresos Hoy', '$' + data.today.revenue.toFixed(2), '💰')}
        ${UI.statCard('Pedidos Pendientes', data.pending.orders, '⏳')}
        ${UI.statCard('Pagos por Verificar', data.pending.payments, '🔔')}
      </div>

      <div class="stats-grid">
        ${UI.statCard('Ingresos Semana', '$' + data.week.revenue.toFixed(2), '📈')}
        ${UI.statCard('Completados Semana', data.week.orders_completed, '✅')}
        ${UI.statCard('Productos Activos', data.totals.active_products, '🛍️')}
      </div>

      ${Object.keys(data.today.by_status).length > 0 ? `
        <div class="card mt-4">
          <h3 style="margin-bottom:1rem;">Pedidos de hoy por estado</h3>
          <div style="display:flex; gap:1rem; flex-wrap:wrap;">
            ${Object.entries(data.today.by_status).map(([status, count]) => 
              `<div>${UI.statusBadge(status)} <strong>${count}</strong></div>`
            ).join('')}
          </div>
        </div>
      ` : ''}

      ${data.pending.payments > 0 ? `
        <div class="card mt-4" style="border-left: 4px solid var(--color-warning);">
          <h3>⚠️ Atención</h3>
          <p class="mt-2">Tienes <strong>${data.pending.payments}</strong> pago(s) pendientes de verificación.</p>
          <button class="btn btn-warning mt-2" onclick="navigateTo('orders')">Ver Pedidos</button>
        </div>
      ` : ''}
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Error cargando dashboard: ${err.message}</p></div>`;
  }
}
