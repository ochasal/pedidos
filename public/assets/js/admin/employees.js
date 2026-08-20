/**
 * Sección: Empleados
 */
async function renderEmployees(container) {
  try {
    const data = await AdminAPI.getEmployees();
    const employees = data.employees;

    container.innerHTML = `
      <div class="content-header">
        <h2>Empleados (${employees.length})</h2>
        <button class="btn btn-primary" onclick="showEmployeeForm()">+ Agregar Empleado</button>
      </div>

      ${UI.table(
        [
          { label: 'Nombre', render: row => `<strong>${row.name}</strong>` },
          { label: 'Rol', render: row => getRoleBadge(row.role) },
          { label: 'Estado', render: row => row.is_active 
            ? '<span class="badge badge-green">Activo</span>' 
            : '<span class="badge badge-red">Inactivo</span>' 
          },
          { label: 'Desde', render: row => new Date(row.created_at).toLocaleDateString('es') }
        ],
        employees,
        {
          emptyMessage: 'No hay empleados registrados.',
          actions: row => `
            <button class="btn btn-sm btn-ghost" onclick="showEmployeeForm('${row.id}')">Editar</button>
            ${row.role !== 'owner' ? `<button class="btn btn-sm btn-danger" onclick="deleteEmployee('${row.id}', '${row.name}')">Eliminar</button>` : ''}
          `
        }
      )}
      <div id="employee-modal-container"></div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Error: ${err.message}</p></div>`;
  }
}

function getRoleBadge(role) {
  const roles = {
    'owner': '<span class="badge badge-purple">Owner</span>',
    'admin': '<span class="badge badge-blue">Admin</span>',
    'operator': '<span class="badge badge-gray">Operador</span>'
  };
  return roles[role] || role;
}

async function showEmployeeForm(employeeId = null) {
  let employee = null;
  if (employeeId) {
    const data = await AdminAPI.getEmployees();
    employee = data.employees.find(e => e.id === employeeId);
  }

  const isEdit = !!employee;
  const title = isEdit ? 'Editar Empleado' : 'Agregar Empleado';

  const formHtml = `
    <form onsubmit="saveEmployee(event, '${employeeId || ''}')">
      ${UI.formGroup('Nombre *', `<input type="text" name="name" class="form-input" value="${employee?.name || ''}" required>`)}
      ${!isEdit ? UI.formGroup('Email *', `<input type="email" name="email" class="form-input" required placeholder="empleado@email.com">`, 'Se creará una cuenta con este email') : ''}
      ${!isEdit ? UI.formGroup('Contraseña', `<input type="password" name="password" class="form-input" placeholder="Dejar vacío para generar una temporal">`) : ''}
      ${UI.formGroup('Rol', UI.select('role', [
        { value: 'operator', label: 'Operador - Gestiona pedidos' },
        { value: 'admin', label: 'Admin - Gestiona todo' }
      ], employee?.role || 'operator'))}
      ${isEdit ? `
        <div class="form-group">
          <label class="toggle">
            <input type="checkbox" name="is_active" ${employee?.is_active ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
          <span style="margin-left:0.5rem;">Activo</span>
        </div>
      ` : ''}
      <div class="form-actions">
        <button type="button" class="btn btn-ghost" onclick="UI.closeModal('employee-modal')">Cancelar</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Guardar' : 'Crear Empleado'}</button>
      </div>
    </form>
  `;

  document.getElementById('employee-modal-container').innerHTML = UI.modal('employee-modal', title, formHtml);
  UI.openModal('employee-modal');
}

async function saveEmployee(e, employeeId) {
  e.preventDefault();
  const form = e.target;

  try {
    if (employeeId) {
      await AdminAPI.updateEmployee(employeeId, {
        name: form.name.value,
        role: form.role.value,
        is_active: form.is_active?.checked
      });
      UI.toast('Empleado actualizado');
    } else {
      await AdminAPI.createEmployee({
        name: form.name.value,
        email: form.email.value,
        password: form.password.value || undefined,
        role: form.role.value
      });
      UI.toast('Empleado creado');
    }
    UI.closeModal('employee-modal');
    renderEmployees(document.getElementById('admin-content'));
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

async function deleteEmployee(id, name) {
  if (!UI.confirm(`¿Desactivar al empleado "${name}"?`)) return;
  try {
    await AdminAPI.deleteEmployee(id);
    UI.toast('Empleado desactivado');
    renderEmployees(document.getElementById('admin-content'));
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}
