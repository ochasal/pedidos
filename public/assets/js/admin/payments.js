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
          { label: 'Comprobante', render: row => row.requires_proof ? '✓ Requerido' : 'No' },
          { label: 'Activo', render: row => row.is_active ?
            '<span style="color:var(--color-success)">✓</span>' :
            '<span style="color:var(--color-error)">✗</span>'
          }
        ],
        methods,
        {
          emptyMessage: 'No tienes métodos de pago configurados.',
          actions: row => `
            <button class="btn btn-sm btn-ghost" onclick="showPaymentMethodForm('${row.id}')">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="deletePaymentMethod('${row.id}', '${row.name}')">🗑️</button>
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
    'cash': '💵 Efectivo',
    'transfer': '🏦 Transferencia',
    'mobile_payment': '📱 Pago Móvil',
    'zelle': '💲 Zelle',
    'crypto': '₿ Crypto',
    'other': '📄 Otro'
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
      ${UI.formGroup('Nombre *', `<input type="text" name="name" class="form-input" value="${method?.name || ''}" required placeholder="Pago Móvil BDV">`)}
      <div class="form-row">
        ${UI.formGroup('Tipo *', UI.select('type', [
          { value: 'cash', label: '💵 Efectivo' },
          { value: 'transfer', label: '🏦 Transferencia' },
          { value: 'mobile_payment', label: '📱 Pago Móvil' },
          { value: 'zelle', label: '💲 Zelle' },
          { value: 'crypto', label: '₿ Crypto' },
          { value: 'other', label: '📄 Otro' }
        ], method?.type || 'transfer'))}
        ${UI.formGroup('Moneda *', UI.select('currency_id',
          cachedCurrencies.map(c => ({ value: c.id, label: `${c.symbol} ${c.name}` })),
          method?.currency_id || cachedCurrencies[0]?.id
        ))}
      </div>
      ${UI.formGroup('Instrucciones', `<textarea name="instructions" class="form-input" placeholder="Datos bancarios, número de cuenta, etc.">${method?.instructions || ''}</textarea>`, 'El cliente verá estas instrucciones al seleccionar este método')}
      <div class="form-group">
        <label class="toggle">
          <input type="checkbox" name="requires_proof" ${method?.requires_proof !== false ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
        <span style="margin-left:0.5rem;">Requiere comprobante</span>
      </div>
      ${UI.formGroup('Orden de aparición', `<input type="number" name="sort_order" class="form-input" value="${method?.sort_order || 0}">`)}
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
