// storefront.js — Lógica de la tienda para clientes
// Depende de: supabase.js, ui.js, auth.js

const Storefront = {
  _carrito: [],
  _productos: [],
  _tipoEntrega: 'recogida',

  async iniciar() {
    // Mostrar nombre del cliente
    const badge = document.getElementById('storefront-user-badge');
    if (badge) {
      badge.textContent = `${Auth.perfil?.nombre_completo} · Cliente`;
    }

    await this._cargarProductos();
    this._bindEventos();
  },

  async _cargarProductos() {
    try {
      this._productos = await fetchProductos();
      this._renderCatalogo();
    } catch (err) {
      UI.mostrarToast('Error cargando productos: ' + err.message, 'error');
    }
  },

  _renderCatalogo(filtro = '') {
    const container = document.getElementById('storefront-catalogo');
    const filtrados = filtro
      ? this._productos.filter(p => p.nombre.toLowerCase().includes(filtro.toLowerCase()))
      : this._productos;

    if (!filtrados.length) {
      container.innerHTML = `<div class="empty-state">No hay productos</div>`;
      return;
    }

    container.innerHTML = filtrados.map(p => `
      <div class="producto-card" data-id="${p.id}">
        ${p.imagen_url
          ? `<img src="${p.imagen_url}" alt="${p.nombre}">`
          : `<div class="pc-icon"><i class="bi bi-box-seam"></i></div>`}
        <div class="pc-nombre">${p.nombre}</div>
        <div class="pc-precio">$${Number(p.precio).toFixed(2)}</div>
      </div>
    `).join('');

    container.querySelectorAll('.producto-card').forEach(card => {
      card.addEventListener('click', () => {
        const prod = filtrados.find(p => String(p.id) === card.dataset.id);
        if (prod) this._agregarAlCarrito(prod);
      });
    });
  },

  _agregarAlCarrito(producto) {
    const existente = this._carrito.find(i => i.productoId === producto.id);
    if (existente) {
      existente.cantidad++;
    } else {
      this._carrito.push({
        productoId: producto.id,
        nombre: producto.nombre,
        precio: Number(producto.precio),
        cantidad: 1,
      });
    }
    this._renderCarrito();
  },

  _renderCarrito() {
    const container = document.getElementById('storefront-carrito-items');
    const btnConfirmar = document.getElementById('btn-confirmar-pedido');

    if (!this._carrito.length) {
      container.innerHTML = `<div class="empty-state text-center py-5"><i class="bi bi-bag" style="font-size:2rem;opacity:.2"></i><p class="mt-2 small">Aún no has agregado productos</p></div>`;
      btnConfirmar.disabled = true;
      this._actualizarTotales();
      return;
    }

    container.innerHTML = this._carrito.map(item => `
      <div class="carrito-item">
        <span class="ci-nombre">${item.nombre}</span>
        <div class="ci-controls">
          <button class="ci-btn" data-action="dec" data-id="${item.productoId}">−</button>
          <span class="ci-qty">${item.cantidad}</span>
          <button class="ci-btn" data-action="inc" data-id="${item.productoId}">+</button>
        </div>
        <span class="ci-subtotal">$${(item.precio * item.cantidad).toFixed(2)}</span>
        <button class="ci-remove" data-action="remove" data-id="${item.productoId}"><i class="bi bi-x"></i></button>
      </div>
    `).join('');

    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        if (btn.dataset.action === 'inc')    this._cambiarCantidad(id, +1);
        if (btn.dataset.action === 'dec')    this._cambiarCantidad(id, -1);
        if (btn.dataset.action === 'remove') { 
          this._carrito = this._carrito.filter(i => i.productoId !== id); 
          this._renderCarrito(); 
        }
      });
    });

    btnConfirmar.disabled = false;
    this._actualizarTotales();
  },

  _cambiarCantidad(productoId, delta) {
    const item = this._carrito.find(i => i.productoId === productoId);
    if (!item) return;
    item.cantidad += delta;
    if (item.cantidad <= 0) this._carrito = this._carrito.filter(i => i.productoId !== productoId);
    this._renderCarrito();
  },

  _actualizarTotales() {
    const subtotal = this._carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);
    const cargo = this._tipoEntrega === 'domicilio'
      ? Number(document.getElementById('storefront-cargo')?.value ?? 0) || 0
      : 0;
    const total = subtotal + cargo;

    document.getElementById('storefront-subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('storefront-cargo-valor').textContent = `$${cargo.toFixed(2)}`;
    document.getElementById('storefront-total').textContent = `$${total.toFixed(2)}`;

    const cargoDisplay = document.getElementById('storefront-cargo-display');
    if (cargoDisplay) cargoDisplay.style.setProperty('display', this._tipoEntrega === 'domicilio' ? 'flex' : 'none', 'important');
  },

  _bindEventos() {
    document.getElementById('storefront-buscar')?.addEventListener('input', e => {
      this._renderCatalogo(e.target.value);
    });

    document.querySelectorAll('#storefront-view .btn-entrega').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#storefront-view .btn-entrega').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._tipoEntrega = btn.dataset.tipo;
        document.getElementById('storefront-cargo-row').classList.toggle('d-none', this._tipoEntrega !== 'domicilio');
        this._actualizarTotales();
      });
    });

    document.getElementById('storefront-cargo')?.addEventListener('input', () => this._actualizarTotales());

    document.getElementById('btn-confirmar-pedido')?.addEventListener('click', () => this.confirmarPedido());
  },

  async confirmarPedido() {
    if (!this._carrito.length) return;

    const subtotal = this._carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);
    const cargo = this._tipoEntrega === 'domicilio'
      ? Number(document.getElementById('storefront-cargo')?.value ?? 0) || 0
      : 0;
    const metodoPago = document.getElementById('storefront-metodo-pago').value;
    const notas = document.getElementById('storefront-notas').value.trim() || null;

    const ventaPayload = {
      tipo_entrega: this._tipoEntrega,
      cargo_domicilio: cargo,
      metodo_pago: metodoPago,
      notas: notas,
      total: subtotal + cargo,
      estado: 'pendiente',           // ← Pedido nuevo pendiente
      cliente_id: Auth.perfil.id,    // ← El cliente es el usuario actual
      vendedor_id: null,
    };

    const detalles = this._carrito.map(i => ({
      producto_id: i.productoId,
      cantidad: i.cantidad,
      precio_unitario: i.precio,
      subtotal: i.precio * i.cantidad,
    }));

    UI.toggleLoader(true);
    try {
      const venta = await insertVenta(ventaPayload, detalles);
      await notificarNuevaVenta(venta, this._carrito, Auth.perfil);
      UI.mostrarToast('¡Pedido realizado! Te notificaremos cuando esté listo.', 'success');
      this._resetear();
    } catch (err) {
      UI.mostrarToast('Error al realizar el pedido: ' + err.message, 'error');
    } finally {
      UI.toggleLoader(false);
    }
  },

  _resetear() {
    this._carrito = [];
    this._tipoEntrega = 'recogida';
    document.getElementById('storefront-metodo-pago').value = 'efectivo';
    document.getElementById('storefront-notas').value = '';
    document.getElementById('storefront-cargo').value = '0';
    document.querySelectorAll('#storefront-view .btn-entrega').forEach(b => {
      b.classList.toggle('active', b.dataset.tipo === 'recogida');
    });
    document.getElementById('storefront-cargo-row').classList.add('d-none');
    this._renderCarrito();
  },
};