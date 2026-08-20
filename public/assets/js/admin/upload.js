/**
 * Upload de imágenes a Supabase Storage
 * El usuario solo ve un botón/área para seleccionar archivo
 * La URL de Supabase se maneja internamente, nunca se muestra
 */

async function uploadImage(file, bucket, folder = '') {
  if (!file) return null;

  const ext = file.name.split('.').pop().toLowerCase();
  const allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
  if (!allowed.includes(ext)) {
    throw new Error('Formato no permitido. Usa JPG, PNG o WEBP.');
  }

  // Max 5MB
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('La imagen no puede pesar más de 5MB.');
  }

  const fileName = `${folder ? folder + '/' : ''}${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

  const { data, error } = await supabaseClient.storage
    .from(bucket)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) throw new Error('Error subiendo imagen: ' + error.message);

  // Obtener URL pública
  const { data: urlData } = supabaseClient.storage
    .from(bucket)
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

/**
 * Handler genérico para el input de imagen en productos
 */
async function handleProductImageUpload(input) {
  const file = input.files[0];
  if (!file) return;

  const status = document.getElementById('product-image-status');
  const urlInput = document.getElementById('product-image-url');
  const area = document.getElementById('product-image-area');

  status.textContent = 'Subiendo imagen...';
  status.style.color = 'var(--color-primary)';

  try {
    const url = await uploadImage(file, 'product-images', getTenantSlug());
    urlInput.value = url;

    // Mostrar preview
    area.innerHTML = `
      <img src="${url}" class="image-preview" id="product-preview">
      <input type="file" id="product-image-file" accept="image/*" capture="environment" onchange="handleProductImageUpload(this)" style="display:none;">
      <input type="hidden" name="image_url" id="product-image-url" value="${url}">
      <button type="button" class="btn btn-sm btn-ghost" onclick="removeProductImage()" style="position:absolute; top:8px; right:8px;">Quitar</button>
    `;
    status.textContent = 'Imagen subida correctamente';
    status.style.color = 'var(--color-success)';
  } catch (err) {
    status.textContent = err.message;
    status.style.color = 'var(--color-error)';
  }
}

function removeProductImage() {
  const area = document.getElementById('product-image-area');
  area.innerHTML = `
    <div class="image-placeholder" id="product-preview-placeholder">Toca para subir imagen</div>
    <input type="file" id="product-image-file" accept="image/*" capture="environment" onchange="handleProductImageUpload(this)" style="display:none;">
    <input type="hidden" name="image_url" id="product-image-url" value="">
  `;
  document.getElementById('product-image-status').textContent = '';
}

/**
 * Handler para logo del negocio
 */
async function handleLogoUpload(input) {
  const file = input.files[0];
  if (!file) return;

  const status = document.getElementById('logo-upload-status');
  status.textContent = 'Subiendo...';
  status.style.color = 'var(--color-primary)';

  try {
    const url = await uploadImage(file, 'tenant-assets', getTenantSlug() + '/logo');
    document.getElementById('logo-url-value').value = url;
    document.getElementById('logo-preview').innerHTML = `<img src="${url}" class="image-preview">`;
    status.textContent = 'Logo actualizado';
    status.style.color = 'var(--color-success)';
  } catch (err) {
    status.textContent = err.message;
    status.style.color = 'var(--color-error)';
  }
}

// Los clicks en image-upload-area se manejan con onclick inline en cada elemento
