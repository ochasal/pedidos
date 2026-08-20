/**
 * Sección: Métodos de Pago
 */
async function renderPaymentMethods(container) {
  try {
    const [pmData, currData] = await Promise.all([
      AdminAPI.getPaymentMethods(),
      AdminAPI.getCurrencies()
    ]);

    cachedCurrencies = currData.currencies.filter(c => c.is_active);
    const methods = pmData.payment_methods;

    container.innerHTML = `
      <div class="content-header">
        <h2>Métodos de Pago (${methods.length})</h2>
        <button class="btn btn-primary" onclick="showPaymentMethodForm()">+ Nuevo Método</button>
      </div>

      ${UI.table(
        [
          { label: 'Nombre', render: row => `<strong>${row.name}</strong>` },
          { label: 'Tipo', render: row => getPaymentTypeLabel(row.type) },
          { label: 'Moneda', render: row => row.currencies ? `${row.currencies.symbol} ${row.currencies.code}` : '-' },
          { label: 'Comprobante', render: row => row.requires_proof ? '<span class="badge badge-blue">Requerido</span>' : '<span class="badge badge-gray">No</span>' },
          { label: 'Activo', render: row => row.is_active ?
            '<span class="badge badge-green">Sí</span>' :
            '<span class="badge badge-red">No</span>'
          }
        ],
        methods,
        {
          emptyMessage: 'No tienes métodos de pago. Crea uno para que tus clientes puedan pagar.',
          actions: row => `
            <button class="btn btn-sm btn-ghost" onclick="showPaymentMethodForm('${row.id}')">Editar</button>
            <button class="btn btn-sm btn-danger" onclick="deletePaymentMethod('${row.id}', '${row.name}')">Eliminar</button>
          `
        }
      )}
      <div id="pm-modal-container"></div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Error: ${err.message}</p></div>`;
  }
}

function getPaymentTypeLabel(type) {
  const labels = {
    'cash': 'Efectivo',
    'transfer': 'Transferencia',
    'mobile_payment': 'Pago Móvil',
    'zelle': 'Zelle',
    'crypto': 'Crypto',
    'other': 'Otro'
  };
  return labels[type] || type;
}

async function showPaymentMethodForm(methodId = null) {
  let method = null;
  if (methodId) {
    const data = await AdminAPI.getPaymentMethods();
    method = data.payment_methods.find(m => m.id === methodId);
  }

  const title = method ? 'Editar Método de Pago' : 'Nuevo Método de Pago';
  const formHtml = `
    <form id="pm-form" onsubmit="savePaymentMethod(event, '${methodId || ''}')">
      ${UI.formGroup('Nombre del método *', `<input type="text" name="name" class="form-input" value="${method?.name || ''}" required placeholder="Ej: Pago Móvil BDV, Zelle, Efectivo al delivery">`, 'Lo que el cliente verá al momento de pagar')}
      <div class="form-row">
        ${UI.formGroup('Tipo *', UI.select('type', [
          { value: 'cash', label: 'Efectivo' },
          { value: 'transfer', label: 'Transferencia' },
          { value: 'mobile_payment', label: 'Pago Móvil' },
          { value: 'zelle', label: 'Zelle' },
          { value: 'crypto', label: 'Crypto' },
          { value: 'other', label: 'Otro' }
        ], method?.type || 'transfer'))}
        ${UI.formGroup('Moneda *', UI.select('currency_id',
          cachedCurrencies.map(c => ({ value: c.id, label: `${c.symbol} ${c.name}` })),
          method?.currency_id || cachedCurrencies[0]?.id
        ))}
      </div>
      ${UI.formGroup('Instrucciones para el cliente', `<textarea name="instructions" class="form-input" placeholder="Banco: Venezuela\nCédula: V-12345678\nTeléfono: 0412-1234567">${method?.instructions || ''}</textarea>`, 'Datos que el cliente necesita para hacer el pago')}
      <div class="form-group" style="display:flex; align-items:center; gap:10px;">
        <label class="toggle">
          <input type="checkbox" name="requires_proof" ${method?.requires_proof !== false ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
        <span style="font-size:13px;">Requiere comprobante de pago</span>
      </div>
      ${UI.formGroup('Orden', `<input type="number" name="sort_order" class="form-input" value="${method?.sort_order || 0}" style="width:80px;">`, 'Menor = aparece primero')}
      <div class="form-actions">
        <button type="button" class="btn btn-ghost" onclick="UI.closeModal('pm-modal')">Cancelar</button>
        <button type="submit" class="btn btn-primary">${method ? 'Guardar' : 'Crear'}</button>
      </div>
    </form>
  `;

  document.getElementById('pm-modal-container').innerHTML = UI.modal('pm-modal', title, formHtml);
  UI.openModal('pm-modal');
}

async function savePaymentMethod(e, methodId) {
  e.preventDefault();
  const form = e.target;
  const data = {
    name: form.name.value,
    type: form.type.value,
    currency_id: form.currency_id.value,
    instructions: form.instructions.value,
    requires_proof: form.requires_proof.checked,
    sort_order: parseInt(form.sort_order.value) || 0
  };

  try {
    if (methodId) {
      await AdminAPI.updatePaymentMethod(methodId, data);
      UI.toast('Método actualizado');
    } else {
      await AdminAPI.createPaymentMethod(data);
      UI.toast('Método creado');
    }
    UI.closeModal('pm-modal');
    renderPaymentMethods(document.getElementById('admin-content'));
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

async function deletePaymentMethod(id, name) {
  if (!UI.confirm(`¿Eliminar "${name}"?`)) return;
  try {
    await AdminAPI.deletePaymentMethod(id);
    UI.toast('Método eliminado');
    renderPaymentMethods(document.getElementById('admin-content'));
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}
