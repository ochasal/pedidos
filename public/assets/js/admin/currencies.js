/**
 * Sección: Monedas y Tasas de Cambio
 */
async function renderCurrencies(container) {
  try {
    const [currData, ratesData] = await Promise.all([
      AdminAPI.getCurrencies(),
      AdminAPI.getExchangeRates()
    ]);

    const currencies = currData.currencies;
    const rates = ratesData.exchange_rates;

    container.innerHTML = `
      <div class="content-header">
        <h2>Monedas y Tasas de Cambio</h2>
        <button class="btn btn-primary" onclick="showCurrencyForm()">+ Nueva Moneda</button>
      </div>

      <div class="card mb-4">
        <h3 style="margin-bottom:1rem;">Monedas</h3>
        ${UI.table(
          [
            { label: 'Código', render: row => `<strong>${row.code}</strong>` },
            { label: 'Nombre', key: 'name' },
            { label: 'Símbolo', key: 'symbol' },
            { label: 'Base', render: row => row.is_base ? '<span class="badge badge-green">BASE</span>' : '' },
            { label: 'Activa', render: row => row.is_active ? '✓' : '✗' }
          ],
          currencies,
          {
            actions: row => `
              <button class="btn btn-sm btn-ghost" onclick="showCurrencyForm('${row.id}')">✏️</button>
              ${!row.is_base ? `<button class="btn btn-sm btn-danger" onclick="deleteCurrency('${row.id}', '${row.code}')">🗑️</button>` : ''}
            `
          }
        )}
      </div>

      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <h3>Tasas de Cambio</h3>
          <button class="btn btn-primary btn-sm" onclick="showExchangeRateForm()">+ Nueva Tasa</button>
        </div>
        ${rates.length === 0 ? '<p style="color:var(--color-text-light)">No hay tasas configuradas</p>' : `
          ${UI.table(
            [
              { label: 'De', render: row => `${row.from_currency?.symbol} ${row.from_currency?.code}` },
              { label: 'A', render: row => `${row.to_currency?.symbol} ${row.to_currency?.code}` },
              { label: 'Tasa', render: row => `<strong>${parseFloat(row.rate).toFixed(4)}</strong>` },
              { label: 'Actualizado', render: row => new Date(row.updated_at).toLocaleString('es', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) }
            ],
            rates,
            {
              actions: row => `
                <button class="btn btn-sm btn-ghost" onclick="showEditRateForm('${row.id}', ${row.rate})">✏️</button>
                <button class="btn btn-sm btn-danger" onclick="deleteExchangeRate('${row.id}')">🗑️</button>
              `
            }
          )}
        `}
      </div>
      <div id="currency-modal-container"></div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Error: ${err.message}</p></div>`;
  }
}

async function showCurrencyForm(currencyId = null) {
  let currency = null;
  if (currencyId) {
    const data = await AdminAPI.getCurrencies();
    currency = data.currencies.find(c => c.id === currencyId);
  }

  const title = currency ? 'Editar Moneda' : 'Nueva Moneda';
  const formHtml = `
    <form onsubmit="saveCurrency(event, '${currencyId || ''}')">
      <div class="form-row">
        ${UI.formGroup('Código *', `<input type="text" name="code" class="form-input" value="${currency?.code || ''}" required placeholder="USD" maxlength="10" ${currency ? 'readonly' : ''}>`)}
        ${UI.formGroup('Símbolo *', `<input type="text" name="symbol" class="form-input" value="${currency?.symbol || ''}" required placeholder="$" maxlength="10">`)}
      </div>
      ${UI.formGroup('Nombre *', `<input type="text" name="name" class="form-input" value="${currency?.name || ''}" required placeholder="Dólar Estadounidense">`)}
      <div class="form-group">
        <label class="toggle">
          <input type="checkbox" name="is_base" ${currency?.is_base ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
        <span style="margin-left:0.5rem;">Moneda base (para cálculos)</span>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-ghost" onclick="UI.closeModal('currency-modal')">Cancelar</button>
        <button type="submit" class="btn btn-primary">${currency ? 'Guardar' : 'Crear'}</button>
      </div>
    </form>
  `;

  document.getElementById('currency-modal-container').innerHTML = UI.modal('currency-modal', title, formHtml);
  UI.openModal('currency-modal');
}

async function saveCurrency(e, currencyId) {
  e.preventDefault();
  const form = e.target;
  const data = {
    code: form.code.value.toUpperCase(),
    symbol: form.symbol.value,
    name: form.name.value,
    is_base: form.is_base.checked
  };

  try {
    if (currencyId) {
      await AdminAPI.updateCurrency(currencyId, data);
      UI.toast('Moneda actualizada');
    } else {
      await AdminAPI.createCurrency(data);
      UI.toast('Moneda creada');
    }
    UI.closeModal('currency-modal');
    renderCurrencies(document.getElementById('admin-content'));
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

async function deleteCurrency(id, code) {
  if (!UI.confirm(`¿Eliminar la moneda ${code}?`)) return;
  try {
    await AdminAPI.deleteCurrency(id);
    UI.toast('Moneda eliminada');
    renderCurrencies(document.getElementById('admin-content'));
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

async function showExchangeRateForm() {
  const currData = await AdminAPI.getCurrencies();
  const currencies = currData.currencies.filter(c => c.is_active);

  const formHtml = `
    <form onsubmit="saveExchangeRate(event)">
      <div class="form-row">
        ${UI.formGroup('De (moneda origen)', UI.select('from_currency_id', currencies.map(c => ({ value: c.id, label: `${c.symbol} ${c.code}` }))))}
        ${UI.formGroup('A (moneda destino)', UI.select('to_currency_id', currencies.map(c => ({ value: c.id, label: `${c.symbol} ${c.code}` })), currencies[1]?.id))}
      </div>
      ${UI.formGroup('Tasa *', `<input type="number" name="rate" class="form-input" step="0.0001" required placeholder="36.50">`, 'Cuántas unidades de la moneda destino equivalen a 1 unidad de la origen')}
      <div class="form-actions">
        <button type="button" class="btn btn-ghost" onclick="UI.closeModal('currency-modal')">Cancelar</button>
        <button type="submit" class="btn btn-primary">Guardar Tasa</button>
      </div>
    </form>
  `;

  document.getElementById('currency-modal-container').innerHTML = UI.modal('currency-modal', 'Nueva Tasa de Cambio', formHtml);
  UI.openModal('currency-modal');
}

async function saveExchangeRate(e) {
  e.preventDefault();
  const form = e.target;
  try {
    await AdminAPI.saveExchangeRate({
      from_currency_id: form.from_currency_id.value,
      to_currency_id: form.to_currency_id.value,
      rate: form.rate.value
    });
    UI.toast('Tasa guardada');
    UI.closeModal('currency-modal');
    renderCurrencies(document.getElementById('admin-content'));
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

async function showEditRateForm(rateId, currentRate) {
  const formHtml = `
    <form onsubmit="updateRate(event, '${rateId}')">
      ${UI.formGroup('Nueva Tasa', `<input type="number" name="rate" class="form-input" step="0.0001" value="${currentRate}" required>`)}
      <div class="form-actions">
        <button type="button" class="btn btn-ghost" onclick="UI.closeModal('currency-modal')">Cancelar</button>
        <button type="submit" class="btn btn-primary">Actualizar</button>
      </div>
    </form>
  `;
  document.getElementById('currency-modal-container').innerHTML = UI.modal('currency-modal', 'Editar Tasa', formHtml);
  UI.openModal('currency-modal');
}

async function updateRate(e, rateId) {
  e.preventDefault();
  try {
    await AdminAPI.updateExchangeRate(rateId, { rate: e.target.rate.value });
    UI.toast('Tasa actualizada');
    UI.closeModal('currency-modal');
    renderCurrencies(document.getElementById('admin-content'));
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

async function deleteExchangeRate(id) {
  if (!UI.confirm('¿Eliminar esta tasa de cambio?')) return;
  try {
    await AdminAPI.deleteExchangeRate(id);
    UI.toast('Tasa eliminada');
    renderCurrencies(document.getElementById('admin-content'));
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}
