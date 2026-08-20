/**
 * Sección: Categorías
 */
async function renderCategories(container) {
  try {
    const data = await AdminAPI.getCategories();
    const categories = data.categories.filter(c => c.is_active);

    container.innerHTML = `
      <div class="content-header">
        <h2>Categorías (${categories.length})</h2>
        <button class="btn btn-primary" onclick="showCategoryForm()">+ Nueva Categoría</button>
      </div>

      ${UI.table(
        [
          { label: 'Nombre', render: row => `<strong>${row.name}</strong>` },
          { label: 'Descripción', render: row => row.description || '-' },
          { label: 'Orden', key: 'sort_order' }
        ],
        categories,
        {
          emptyMessage: 'No tienes categorías. Crea la primera para organizar tus productos.',
          actions: row => `
            <button class="btn btn-sm btn-ghost" onclick="showCategoryForm('${row.id}')">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="deleteCategory('${row.id}', '${row.name}')">🗑️</button>
          `
        }
      )}
      <div id="category-modal-container"></div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Error: ${err.message}</p></div>`;
  }
}

async function showCategoryForm(categoryId = null) {
  let category = null;
  if (categoryId) {
    const data = await AdminAPI.getCategories();
    category = data.categories.find(c => c.id === categoryId);
  }

  const title = category ? 'Editar Categoría' : 'Nueva Categoría';
  const formHtml = `
    <form id="category-form" onsubmit="saveCategory(event, '${categoryId || ''}')">
      ${UI.formGroup('Nombre *', `<input type="text" name="name" class="form-input" value="${category?.name || ''}" required>`)}
      ${UI.formGroup('Descripción', `<textarea name="description" class="form-input">${category?.description || ''}</textarea>`)}
      ${UI.formGroup('Orden', `<input type="number" name="sort_order" class="form-input" value="${category?.sort_order || 0}">`)}
      <div class="form-actions">
        <button type="button" class="btn btn-ghost" onclick="UI.closeModal('category-modal')">Cancelar</button>
        <button type="submit" class="btn btn-primary">${category ? 'Guardar' : 'Crear'}</button>
      </div>
    </form>
  `;

  document.getElementById('category-modal-container').innerHTML = UI.modal('category-modal', title, formHtml);
  UI.openModal('category-modal');
}

async function saveCategory(e, categoryId) {
  e.preventDefault();
  const form = e.target;
  const data = {
    name: form.name.value,
    description: form.description.value,
    sort_order: parseInt(form.sort_order.value) || 0
  };

  try {
    if (categoryId) {
      await AdminAPI.updateCategory(categoryId, data);
      UI.toast('Categoría actualizada');
    } else {
      await AdminAPI.createCategory(data);
      UI.toast('Categoría creada');
    }
    UI.closeModal('category-modal');
    renderCategories(document.getElementById('admin-content'));
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

async function deleteCategory(id, name) {
  if (!UI.confirm(`¿Eliminar la categoría "${name}"?`)) return;
  try {
    await AdminAPI.deleteCategory(id);
    UI.toast('Categoría eliminada');
    renderCategories(document.getElementById('admin-content'));
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}
