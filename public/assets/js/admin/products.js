/**
 * Sección: Productos
 */
let cachedCategories = [];
let cachedCurrencies = [];

async function renderProducts(container) {
  try {
    const [prodData, catData, currData] = await Promise.all([
      AdminAPI.getProducts(),
      AdminAPI.getCategories(),
      AdminAPI.getCurrencies()
    ]);

    cachedCategories = catData.categories.filter(c => c.is_active);
    cachedCurrencies = currData.currencies.filter(c => c.is_active);

    const products = prodData.products.filter(p => p.is_active);

    container.innerHTML = `
      <div class="content-header">
        <h2>Productos (${products.length})</h2>
        <button class="btn btn-primary" onclick="showProductForm()">+ Nuevo Producto</button>
      </div>

      ${UI.table(
        [
          { label: 'Imagen', render: row => row.image_url ? `<img src="${row.image_url}" class="img-preview">` : '<span style="color:var(--color-text-light)">-</span>' },
          { label: 'Nombre', render: row => `<strong>${row.name}</strong>${row.categories ? `<br><small style="color:var(--color-text-light)">${row.categories.name}</small>` : ''}` },
          { label: 'Precio', render: row => `${row.currencies?.symbol || '$'}${parseFloat(row.price).toFixed(2)}` },
          { label: 'Disponible', render: row => `
            <label class="toggle">
              <input type="checkbox" ${row.is_available ? 'checked' : ''} onchange="toggleProductAvailability('${row.id}')">
              <span class="slider"></span>
            </label>
          `},
          { label: 'Orden', key: 'sort_order' }
        ],
        products,
        {
          emptyMessage: 'No tienes productos. ¡Crea el primero!',
          actions: row => `
            <button class="btn btn-sm btn-ghost" onclick="showProductForm('${row.id}')">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="deleteProduct('${row.id}', '${row.name}')">🗑️</button>
          `
        }
      )}

      <div id="product-modal-container"></div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Error: ${err.message}</p></div>`;
  }
}

async function showProductForm(productId = null) {
  let product = null;
  if (productId) {
    const data = await AdminAPI.getProducts();
    product = data.products.find(p => p.id === productId);
  }

  const title = product ? 'Editar Producto' : 'Nuevo Producto';

  const formHtml = `
    <form id="product-form" onsubmit="saveProduct(event, '${productId || ''}')">
      ${UI.formGroup('Nombre *', `<input type="text" name="name" class="form-input" value="${product?.name || ''}" required>`)}
      ${UI.formGroup('Descripción', `<textarea name="description" class="form-input">${product?.description || ''}</textarea>`)}
      <div class="form-row">
        ${UI.formGroup('Precio *', `<input type="number" name="price" class="form-input" step="0.01" min="0" value="${product?.price || ''}" required>`)}
        ${UI.formGroup('Moneda *', UI.select('currency_id',
          cachedCurrencies.map(c => ({ value: c.id, label: `${c.symbol} ${c.name}` })),
          product?.currency_id || cachedCurrencies[0]?.id
        ))}
      </div>
      <div class="form-row">
        ${UI.formGroup('Categoría', UI.select('category_id',
          [{ value: '', label: 'Sin categoría' }, ...cachedCategories.map(c => ({ value: c.id, label: c.name }))],
          product?.category_id || ''
        ))}
        ${UI.formGroup('Orden', `<input type="number" name="sort_order" class="form-input" value="${product?.sort_order || 0}">`)}
      </div>
      ${UI.formGroup('URL de imagen', `<input type="url" name="image_url" class="form-input" value="${product?.image_url || ''}" placeholder="https://...">`, 'Sube la imagen a Supabase Storage y pega la URL aquí')}
      <div class="form-group">
        <label class="toggle">
          <input type="checkbox" name="is_available" ${product?.is_available !== false ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
        <span style="margin-left:0.5rem; font-size:0.85rem;">Disponible para venta</span>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-ghost" onclick="UI.closeModal('product-modal')">Cancelar</button>
        <button type="submit" class="btn btn-primary">${product ? 'Guardar Cambios' : 'Crear Producto'}</button>
      </div>
    </form>
  `;

  document.getElementById('product-modal-container').innerHTML = UI.modal('product-modal', title, formHtml);
  UI.openModal('product-modal');
}

async function saveProduct(e, productId) {
  e.preventDefault();
  const form = e.target;
  const data = {
    name: form.name.value,
    description: form.description.value,
    price: form.price.value,
    currency_id: form.currency_id.value,
    category_id: form.category_id.value || null,
    sort_order: parseInt(form.sort_order.value) || 0,
    image_url: form.image_url.value || null,
    is_available: form.is_available.checked
  };

  try {
    if (productId) {
      await AdminAPI.updateProduct(productId, data);
      UI.toast('Producto actualizado');
    } else {
      await AdminAPI.createProduct(data);
      UI.toast('Producto creado');
    }
    UI.closeModal('product-modal');
    renderProducts(document.getElementById('admin-content'));
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

async function toggleProductAvailability(id) {
  try {
    await AdminAPI.toggleProduct(id);
  } catch (err) {
    UI.toast(err.message, 'error');
    renderProducts(document.getElementById('admin-content'));
  }
}

async function deleteProduct(id, name) {
  if (!UI.confirm(`¿Eliminar "${name}"? Se desactivará del catálogo.`)) return;
  try {
    await AdminAPI.deleteProduct(id);
    UI.toast('Producto eliminado');
    renderProducts(document.getElementById('admin-content'));
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}
