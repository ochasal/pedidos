/**
 * Sección: Horarios de Atención
 */
const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

async function renderHours(container) {
  try {
    const data = await AdminAPI.getHours();
    const hours = data.hours;

    // Crear array completo de 7 días
    const allDays = DAY_NAMES.map((name, idx) => {
      const existing = hours.find(h => h.day_of_week === idx);
      return {
        day_of_week: idx,
        day_name: name,
        open_time: existing?.open_time || '08:00',
        close_time: existing?.close_time || '18:00',
        is_active: existing?.is_active || false
      };
    });

    container.innerHTML = `
      <div class="content-header">
        <h2>Horarios de Atención</h2>
      </div>

      <div class="card">
        <p style="color:var(--color-text-light); margin-bottom:1.5rem;">
          Configura los días y horas en que tu negocio acepta pedidos. Los clientes no podrán pedir fuera de horario.
        </p>
        <form id="hours-form" onsubmit="saveHours(event)">
          ${allDays.map(day => `
            <div style="display:flex; align-items:center; gap:1rem; padding:0.75rem 0; border-bottom:1px solid var(--color-border);">
              <label class="toggle" style="flex-shrink:0;">
                <input type="checkbox" name="active_${day.day_of_week}" ${day.is_active ? 'checked' : ''}>
                <span class="slider"></span>
              </label>
              <span style="width:100px; font-weight:500;">${day.day_name}</span>
              <input type="time" name="open_${day.day_of_week}" class="form-input" style="width:auto;" value="${day.open_time.substring(0,5)}">
              <span>a</span>
              <input type="time" name="close_${day.day_of_week}" class="form-input" style="width:auto;" value="${day.close_time.substring(0,5)}">
            </div>
          `).join('')}
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">💾 Guardar Horarios</button>
          </div>
        </form>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Error: ${err.message}</p></div>`;
  }
}

async function saveHours(e) {
  e.preventDefault();
  const form = e.target;

  const hours = DAY_NAMES.map((_, idx) => ({
    day_of_week: idx,
    is_active: form[`active_${idx}`].checked,
    open_time: form[`open_${idx}`].value,
    close_time: form[`close_${idx}`].value
  }));

  try {
    await AdminAPI.updateHours(hours);
    UI.toast('Horarios guardados');
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}
