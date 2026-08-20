/**
 * Tienda Pública - Catálogo + Carrito + Checkout completo
 */
let storeTenant = null;
let storeProducts = [];
let storeCategories = [];
let storePaymentMethods = [];
let storeExchangeRates = [];
let cart = JSON.parse(localStorage.getItem('cart') || '[]');
let currentView = 'catalog'; // catalog, cart, checkout, confirmation

(async function() {
  const slug = getTenantSlug();
  if (!slug) {
    document.getElementById('app').innerHTML = '<div class="loading-spinner"><p>URL inválida</p></div>';
    return;
  }

  try {
    // Cargar tenant
    const tenantData = await apiRequest(`/store?slug=${slug}&action=tenant`);
    storeTenant = tenantData.tenant;
    applyTenantTheme(storeTenant);

    // Verificar horarios
    const hoursData = await apiRequest(`/store?slug=${slug}&action=hours`);
    
    // Cargar catálogo
    const catalogData = await apiRequest(`/store?slug=${slug}&action=products`);
    storeProducts = catalogData.products;
    storeCategories = catalogData.categories;

    // Cargar métodos de pago
    const payData = await apiRequest(`/store?slug=${slug}&action=payments`);
    storePaymentMethods = payData.payment_methods;
    storeExchangeRates = payData.exchange_rates || [];

    renderStoreHeader();
    
    if (!hoursData.is_open && storeTenant.config.auto_close_after_hours) {
      renderClosedMessage(hoursData);
    } else {
      renderCatalog();
    }

    renderCartFab();
  } catch (err) {
    document.getElementById('app').innerHTML = `
      <div class="loading-spinner">
        <p>No se pudo cargar la tienda: ${err.message}</p>
      </div>
    `;
  }
})();

// ===== HEADER =====
function renderStoreHeader() {
  const header = document.getElementById('store-header');
  header.innerHTML = `
    <div class="brand">
      ${storeTenant.config.logo_url ? `<img src="${storeTenant.config.logo_url}" alt="${storeTenant.name}">` : ''}
      <h1>${storeTenant.name}</h1>
    </div>
    <span class="store-tagline">${storeTenant.config.tagline || ''}</span>
  `;
}

// ===== CERRADO =====
function renderClosedMessage(hoursData) {
  const content = document.getElementById('store-content');
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  
  content.innerHTML = `
    <div class="closed-banner">
      <div class="closed-icon">🕐</div>
      <h2>Estamos cerrados</h2>
      <p>Actualmente no estamos recibiendo pedidos.</p>
      <div class="hours-list">
        <h4>Nuestros horarios:</h4>
        ${hoursData.hours.filter(h => h.is_active).map(h => `
          <div class="hours-row">
            <span>${h.day_name || dayNames[h.day_of_week]}</span>
            <span>${h.open_time.substring(0,5)} - ${h.close_time.substring(0,5)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ===== CATÁLOGO =====
function renderCatalog() {
  const content = document.getElementById('store-content');
  currentView = 'catalog';

  // Filtro por categorías
  let html = '<div class="category-tabs">';
  html += `<button class="cat-tab active" onclick="filterByCategory(null)">Todos</button>`;
  storeCategories.forEach(cat => {
    html += `<button class="cat-tab" onclick="filterByCategory('${cat.id}')">${cat.name}</button>`;
  });
  html += '</div>';

  html += '<div class="products-grid" id="products-grid">';
  storeProducts.forEach(product => {
    html += renderProductCard(product);
  });
  html += '</div>';

  if (storeProducts.length === 0) {
    html = '<div class="empty-state"><p>No hay productos disponibles en este momento.</p></div>';
  }

  content.innerHTML = html;
}

function renderProductCard(product) {
  const inCart = cart.find(i => i.product_id === product.id);
  const qtyInCart = inCart ? inCart.quantity : 0;

  return `
    <div class="product-card" data-category="${product.category_id || ''}">
      ${product.image_url ? `<img src="${product.image_url}" alt="${product.name}" loading="lazy">` : '<div class="product-no-img">🛍️</div>'}
      <div class="info">
        <h3>${product.name}</h3>
        ${product.description ? `<p class="product-desc">${product.description}</p>` : ''}
        <div class="product-footer">
          <div class="price">${product.currency_symbol}${parseFloat(product.price).toFixed(2)}</div>
          ${qtyInCart > 0 ? `
            <div class="qty-control">
              <button onclick="updateCartQty('${product.id}', -1)">−</button>
              <span>${qtyInCart}</span>
              <button onclick="updateCartQty('${product.id}', 1)">+</button>
            </div>
          ` : `
            <button class="btn btn-primary btn-sm" onclick="addToCart('${product.id}')">Agregar</button>
          `}
        </div>
      </div>
    </div>
  `;
}

function filterByCategory(categoryId) {
  document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');

  const cards = document.querySelectorAll('.product-card');
  cards.forEach(card => {
    if (!categoryId || card.dataset.category === categoryId) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
    }
  });
}

// ===== CARRITO =====
function addToCart(productId) {
  const product = storeProducts.find(p => p.id === productId);
  if (!product) return;

  const existing = cart.find(i => i.product_id === productId);
  if (existing) {
    existing.quantity++;
  } else {
    cart.push({
      product_id: productId,
      name: product.name,
      price: parseFloat(product.price),
      currency_symbol: product.currency_symbol,
      quantity: 1,
      notes: ''
    });
  }
  saveCart();
  renderCatalog();
  renderCartFab();
}

function updateCartQty(productId, delta) {
  const item = cart.find(i => i.product_id === productId);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    cart = cart.filter(i => i.product_id !== productId);
  }
  saveCart();

  if (currentView === 'catalog') renderCatalog();
  else if (currentView === 'cart') renderCartView();
  renderCartFab();
}

function removeFromCart(productId) {
  cart = cart.filter(i => i.product_id !== productId);
  saveCart();
  if (currentView === 'cart') renderCartView();
  renderCartFab();
}

function saveCart() {
  localStorage.setItem('cart', JSON.stringify(cart));
}

function getCartTotal() {
  return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

function getCartCount() {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

function renderCartFab() {
  let fab = document.getElementById('cart-fab');
  if (!fab) {
    fab = document.createElement('div');
    fab.id = 'cart-fab';
    fab.className = 'cart-fab';
    fab.onclick = () => renderCartView();
    document.body.appendChild(fab);
  }

  const count = getCartCount();
  fab.innerHTML = `
    🛒
    ${count > 0 ? `<span class="badge">${count}</span>` : ''}
  `;
  fab.style.display = count > 0 || currentView === 'catalog' ? '' : 'none';
}

function renderCartView() {
  const content = document.getElementById('store-content');
  currentView = 'cart';

  if (cart.length === 0) {
    content.innerHTML = `
      <div class="cart-empty">
        <h2>Tu carrito está vacío</h2>
        <p>Agrega productos del catálogo para comenzar.</p>
        <button class="btn btn-primary mt-4" onclick="renderCatalog()">← Ver Catálogo</button>
      </div>
    `;
    return;
  }

  const total = getCartTotal();
  const minOrder = parseFloat(storeTenant.config.min_order_amount || 0);
  const deliveryFee = parseFloat(storeTenant.config.delivery_fee || 0);
  const canCheckout = total >= minOrder;

  content.innerHTML = `
    <div class="cart-view">
      <div class="cart-header">
        <button class="btn btn-ghost" onclick="renderCatalog()">← Seguir Comprando</button>
        <h2>Tu Pedido</h2>
      </div>

      <div class="cart-items">
        ${cart.map(item => `
          <div class="cart-item">
            <div class="cart-item-info">
              <strong>${item.name}</strong>
              <span class="cart-item-price">${item.currency_symbol}${item.price.toFixed(2)} c/u</span>
            </div>
            <div class="cart-item-actions">
              <div class="qty-control">
                <button onclick="updateCartQty('${item.product_id}', -1)">−</button>
                <span>${item.quantity}</span>
                <button onclick="updateCartQty('${item.product_id}', 1)">+</button>
              </div>
              <span class="cart-item-subtotal">${item.currency_symbol}${(item.price * item.quantity).toFixed(2)}</span>
              <button class="btn-icon" onclick="removeFromCart('${item.product_id}')">🗑️</button>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="cart-summary">
        <div class="summary-row"><span>Subtotal</span><span>$${total.toFixed(2)}</span></div>
        ${deliveryFee > 0 ? `<div class="summary-row"><span>Delivery</span><span>$${deliveryFee.toFixed(2)}</span></div>` : ''}
        <div class="summary-row total"><span>Total</span><span>$${(total + deliveryFee).toFixed(2)}</span></div>
        ${minOrder > 0 && !canCheckout ? `<p class="min-order-warning">⚠️ Pedido mínimo: $${minOrder.toFixed(2)}</p>` : ''}
      </div>

      <button class="btn btn-primary btn-lg" onclick="renderCheckout()" ${!canCheckout ? 'disabled' : ''} style="width:100%; justify-content:center; padding:1rem; font-size:1rem;">
        Continuar al Checkout →
      </button>
    </div>
  `;
}

// ===== CHECKOUT =====
function renderCheckout() {
  const content = document.getElementById('store-content');
  currentView = 'checkout';
  document.getElementById('cart-fab').style.display = 'none';

  const total = getCartTotal();
  const deliveryFee = parseFloat(storeTenant.config.delivery_fee || 0);
  const deliveryEnabled = storeTenant.config.delivery_enabled;
  const pickupEnabled = storeTenant.config.pickup_enabled;

  content.innerHTML = `
    <div class="checkout-view">
      <div class="cart-header">
        <button class="btn btn-ghost" onclick="renderCartView()">← Volver al Carrito</button>
        <h2>Checkout</h2>
      </div>

      <form id="checkout-form" onsubmit="submitOrder(event)">
        <!-- Datos del cliente -->
        <div class="checkout-section">
          <h3>📋 Tus Datos</h3>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Nombre completo *</label>
              <input type="text" name="customer_name" class="form-input" required placeholder="Tu nombre">
            </div>
            <div class="form-group">
              <label class="form-label">Teléfono / WhatsApp *</label>
              <input type="tel" name="customer_phone" class="form-input" required placeholder="+58 412...">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Email (opcional)</label>
            <input type="email" name="customer_email" class="form-input" placeholder="tu@email.com">
          </div>
        </div>

        <!-- Tipo de entrega -->
        <div class="checkout-section">
          <h3>🚚 Tipo de Entrega</h3>
          <div class="delivery-options">
            ${deliveryEnabled ? `
              <label class="delivery-option">
                <input type="radio" name="order_type" value="delivery" checked>
                <div class="option-card">
                  <span class="option-icon">🛵</span>
                  <span class="option-label">Delivery</span>
                  ${deliveryFee > 0 ? `<span class="option-fee">+$${deliveryFee.toFixed(2)}</span>` : '<span class="option-fee">Gratis</span>'}
                </div>
              </label>
            ` : ''}
            ${pickupEnabled ? `
              <label class="delivery-option">
                <input type="radio" name="order_type" value="pickup" ${!deliveryEnabled ? 'checked' : ''}>
                <div class="option-card">
                  <span class="option-icon">🏪</span>
                  <span class="option-label">Retiro en Tienda</span>
                  <span class="option-fee">Sin costo</span>
                </div>
              </label>
            ` : ''}
          </div>
          <div id="address-field" class="form-group mt-2" ${!deliveryEnabled ? 'style="display:none"' : ''}>
            <label class="form-label">Dirección de entrega *</label>
            <textarea name="customer_address" class="form-input" placeholder="Calle, número, referencia..." rows="2"></textarea>
          </div>
        </div>

        <!-- Método de pago -->
        <div class="checkout-section">
          <h3>💳 Método de Pago</h3>
          <div class="payment-options">
            ${storePaymentMethods.map(pm => `
              <label class="payment-option">
                <input type="radio" name="payment_method_id" value="${pm.id}" ${storePaymentMethods[0].id === pm.id ? 'checked' : ''}>
                <div class="option-card">
                  <span class="option-label">${pm.name}</span>
                  <span class="option-fee">${pm.currencies?.symbol || ''} ${pm.currencies?.code || ''}</span>
                </div>
              </label>
            `).join('')}
          </div>
          <div id="payment-instructions" class="payment-instructions mt-2"></div>
        </div>

        <!-- Notas -->
        <div class="checkout-section">
          <div class="form-group">
            <label class="form-label">Notas adicionales (opcional)</label>
            <textarea name="notes" class="form-input" placeholder="Instrucciones especiales, alergias, etc." rows="2"></textarea>
          </div>
        </div>

        <!-- Resumen final -->
        <div class="checkout-summary">
          <h3>Resumen del Pedido</h3>
          ${cart.map(item => `
            <div class="summary-item">
              <span>${item.quantity}x ${item.name}</span>
              <span>${item.currency_symbol}${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          `).join('')}
          <div class="summary-row"><span>Subtotal</span><span>$${total.toFixed(2)}</span></div>
          <div class="summary-row" id="delivery-fee-row"><span>Delivery</span><span>$${deliveryFee.toFixed(2)}</span></div>
          <div class="summary-row total"><span>Total</span><span id="checkout-total">$${(total + deliveryFee).toFixed(2)}</span></div>
        </div>

        <button type="submit" class="btn btn-primary btn-lg" id="submit-order-btn" style="width:100%; justify-content:center; padding:1rem; font-size:1rem;">
          ✅ Confirmar Pedido
        </button>
      </form>
    </div>
  `;

  // Event listeners
  const orderTypeRadios = document.querySelectorAll('input[name="order_type"]');
  orderTypeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const addressField = document.getElementById('address-field');
      const feeRow = document.getElementById('delivery-fee-row');
      const totalEl = document.getElementById('checkout-total');

      if (e.target.value === 'delivery') {
        addressField.style.display = '';
        feeRow.style.display = '';
        totalEl.textContent = `$${(total + deliveryFee).toFixed(2)}`;
      } else {
        addressField.style.display = 'none';
        feeRow.style.display = 'none';
        totalEl.textContent = `$${total.toFixed(2)}`;
      }
    });
  });

  // Mostrar instrucciones del método de pago seleccionado
  const pmRadios = document.querySelectorAll('input[name="payment_method_id"]');
  pmRadios.forEach(radio => {
    radio.addEventListener('change', updatePaymentInstructions);
  });
  updatePaymentInstructions();
}

function updatePaymentInstructions() {
  const selected = document.querySelector('input[name="payment_method_id"]:checked');
  const container = document.getElementById('payment-instructions');
  if (!selected || !container) return;

  const method = storePaymentMethods.find(m => m.id === selected.value);
  if (method && method.instructions) {
    container.innerHTML = `<div class="instructions-box"><strong>${method.name}:</strong><br>${method.instructions}</div>`;
    container.style.display = '';
  } else {
    container.style.display = 'none';
  }
}

// ===== SUBMIT ORDER =====
async function submitOrder(e) {
  e.preventDefault();
  const form = e.target;
  const btn = document.getElementById('submit-order-btn');
  btn.disabled = true;
  btn.textContent = 'Enviando pedido...';

  const orderType = form.order_type?.value || 'pickup';

  // Validar dirección si es delivery
  if (orderType === 'delivery' && !form.customer_address.value.trim()) {
    alert('Por favor ingresa tu dirección de entrega');
    btn.disabled = false;
    btn.textContent = '✅ Confirmar Pedido';
    return;
  }

  const orderData = {
    customer_name: form.customer_name.value,
    customer_phone: form.customer_phone.value,
    customer_email: form.customer_email.value || null,
    customer_address: form.customer_address?.value || null,
    order_type: orderType,
    notes: form.notes.value || null,
    source: 'web',
    items: cart.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      notes: item.notes || ''
    }))
  };

  try {
    const slug = getTenantSlug();
    const result = await apiRequest(`/orders?slug=${slug}&action=create`, {
      method: 'POST',
      body: JSON.stringify(orderData)
    });

    // Guardar info del método de pago seleccionado para la confirmación
    const selectedPM = form.payment_method_id?.value;
    const paymentMethod = storePaymentMethods.find(m => m.id === selectedPM);

    // Limpiar carrito
    cart = [];
    saveCart();
    renderCartFab();

    // Mostrar confirmación
    renderConfirmation(result, paymentMethod);
  } catch (err) {
    alert('Error al crear el pedido: ' + err.message);
    btn.disabled = false;
    btn.textContent = '✅ Confirmar Pedido';
  }
}

// ===== CONFIRMACIÓN =====
function renderConfirmation(orderResult, paymentMethod) {
  const content = document.getElementById('store-content');
  currentView = 'confirmation';
  document.getElementById('cart-fab').style.display = 'none';

  const order = orderResult.order;
  const trackingUrl = orderResult.tracking_url;
  const requiresProof = paymentMethod && paymentMethod.requires_proof;

  content.innerHTML = `
    <div class="confirmation-view">
      <div class="confirmation-icon">🎉</div>
      <h2>¡Pedido Confirmado!</h2>
      <p class="confirmation-number">Pedido #${order.order_number}</p>
      <p style="color:var(--color-text-light);">Total: <strong>$${parseFloat(order.total).toFixed(2)}</strong></p>

      ${requiresProof ? `
        <div class="proof-upload-section">
          <h3>📎 Subir Comprobante de Pago</h3>
          <p>Sube una foto o captura de tu comprobante para agilizar el proceso.</p>
          
          <div class="upload-area" id="upload-area">
            <input type="file" id="proof-file" accept="image/*" onchange="handleProofUpload('${order.id}', '${paymentMethod.id}')">
            <div class="upload-placeholder">
              <span>📷</span>
              <p>Toca para subir comprobante</p>
            </div>
            <div class="upload-progress hidden" id="upload-progress">
              <div class="spinner"></div>
              <p>Subiendo...</p>
            </div>
          </div>

          <div class="form-group mt-2">
            <label class="form-label">Número de referencia (opcional)</label>
            <input type="text" id="reference-number" class="form-input" placeholder="Últimos 4 dígitos o referencia">
          </div>

          <button class="btn btn-primary" id="send-payment-btn" onclick="submitPaymentProof('${order.id}', '${paymentMethod.id}')" style="width:100%; justify-content:center;">
            Enviar Comprobante
          </button>
        </div>
      ` : `
        <div class="proof-upload-section">
          <p>✅ Tu pedido ha sido registrado. ${paymentMethod?.type === 'cash' ? 'Pagarás al recibir.' : ''}</p>
        </div>
      `}

      <div class="tracking-section">
        <h3>📍 Seguimiento</h3>
        <p>Puedes seguir el estado de tu pedido aquí:</p>
        <a href="${trackingUrl}" class="btn btn-primary" style="display:inline-flex;">Ver Estado del Pedido →</a>
      </div>

      <button class="btn btn-ghost mt-4" onclick="renderCatalog()" style="width:100%; justify-content:center;">
        ← Volver al Catálogo
      </button>
    </div>
  `;
}

// ===== SUBIDA DE COMPROBANTE =====
async function handleProofUpload(orderId, paymentMethodId) {
  const fileInput = document.getElementById('proof-file');
  const file = fileInput.files[0];
  if (!file) return;

  const uploadArea = document.getElementById('upload-area');
  const progress = document.getElementById('upload-progress');
  progress.classList.remove('hidden');

  try {
    // Subir a Supabase Storage
    const fileName = `${orderId}_${Date.now()}.${file.name.split('.').pop()}`;
    const { data, error } = await supabaseClient.storage
      .from('payment-proofs')
      .upload(fileName, file, { cacheControl: '3600', upsert: false });

    if (error) throw error;

    // Obtener URL pública
    const { data: urlData } = supabaseClient.storage
      .from('payment-proofs')
      .getPublicUrl(fileName);

    window._uploadedProofUrl = urlData.publicUrl;
    
    progress.innerHTML = '<p style="color:var(--color-success);">✅ Comprobante subido</p>';
  } catch (err) {
    progress.innerHTML = `<p style="color:var(--color-error);">Error: ${err.message}</p>`;
    progress.classList.remove('hidden');
  }
}

async function submitPaymentProof(orderId, paymentMethodId) {
  const btn = document.getElementById('send-payment-btn');
  const reference = document.getElementById('reference-number').value;
  const proofUrl = window._uploadedProofUrl || null;

  if (!proofUrl && !reference) {
    alert('Por favor sube un comprobante o ingresa un número de referencia');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Enviando...';

  // Obtener el total del pedido para el monto
  const total = getCartTotal() || parseFloat(document.querySelector('.confirmation-view .confirmation-number')?.nextElementSibling?.textContent?.replace(/[^0-9.]/g, '') || '0');

  try {
    const slug = getTenantSlug();
    await apiRequest(`/orders?slug=${slug}&action=pay`, {
      method: 'POST',
      body: JSON.stringify({
        order_id: orderId,
        payment_method_id: paymentMethodId,
        amount: total,
        proof_url: proofUrl,
        reference_number: reference
      })
    });

    btn.textContent = '✅ Comprobante Enviado';
    btn.style.background = 'var(--color-success)';
    
    // Mostrar mensaje
    const section = btn.parentElement;
    section.innerHTML += '<p style="margin-top:1rem; color:var(--color-success); font-weight:500;">¡Comprobante enviado! Te avisaremos cuando sea verificado.</p>';
  } catch (err) {
    alert('Error enviando comprobante: ' + err.message);
    btn.disabled = false;
    btn.textContent = 'Enviar Comprobante';
  }
}
