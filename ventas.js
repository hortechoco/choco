// ventas.js — lógica del carrito y registro de venta
// Depende de: supabase.js, notificaciones.js, ui.js

const Ventas = {
  _carrito: [],       // [{ productoId, nombre, precio, cantidad }]
  _tipo: 'recogida',

  async iniciar() {
    await this._renderCatalogo();
    this._bindEventos();
  },

  async _renderCatalogo(filtro = '') {
    const container = document.getElementById('catalogo-productos');
    const productos = Productos.lista;

    const filtrados = filtro
      ? productos.filter(p => p.nombre.toLowerCase().includes(filtro.toLowerCase()))
      : productos;

    if (!filtrados.length) {
      container.innerHTML = `<div class="empty-state">Sin resultados</div>`;
      return;
    }

    container.innerHTML = filtrados.map(p => `
      <div class="producto-card" data-id="${p.id}">
        ${p.imagen_url
          ? `<img src="${p.imagen_url}" alt="${p.nombre}">`
          : `<div class="pc-icon"><i class="bi bi-box-seam" style="font-size:1.2rem;color:var(--bronze)"></i></div>`}
        <div class="pc-nombre">${p.nombre}</div>
        <div class="pc-precio">$${Number(p.precio).toFixed(2)}</div>
      </div>`).join('');

    container.querySelectorAll('.producto-card').forEach(card => {
      card.addEventListener('click', () => {
        const prod = filtrados.find(p => String(p.id) === String(card.dataset.id));
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

  _cambiarCantidad(productoId, delta) {
    const item = this._carrito.find(i => i.productoId === productoId);
    if (!item) return;
    item.cantidad += delta;
    if (item.cantidad <= 0) this._carrito = this._carrito.filter(i => i.productoId !== productoId);
    this._renderCarrito();
  },

  _renderCarrito() {
    const container = document.getElementById('carrito-items');

    if (!this._carrito.length) {
      container.innerHTML = `<div class="empty-state text-center py-5"><i class="bi bi-bag" style="font-size:2rem;opacity:.2"></i><p class="mt-2 small">Sin productos aún</p></div>`;
      document.getElementById('btn-confirmar-venta').disabled = true;
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
      </div>`).join('');

    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        if (btn.dataset.action === 'inc')    this._cambiarCantidad(id, +1);
        if (btn.dataset.action === 'dec')    this._cambiarCantidad(id, -1);
        if (btn.dataset.action === 'remove') { this._carrito = this._carrito.filter(i => i.productoId !== id); this._renderCarrito(); }
      });
    });

    document.getElementById('btn-confirmar-venta').disabled = false;
    this._actualizarTotales();
  },

  _actualizarTotales() {
    const subtotal = this._carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);
    const cargo    = this._tipo === 'domicilio'
      ? Number(document.getElementById('cargo-domicilio')?.value ?? 0) || 0
      : 0;
    const total = subtotal + cargo;

    document.getElementById('carrito-subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('carrito-cargo').textContent    = `$${cargo.toFixed(2)}`;
    document.getElementById('carrito-total-val').textContent = `$${total.toFixed(2)}`;

    const cargoRow = document.getElementById('cargo-row');
    if (cargoRow) cargoRow.style.setProperty('display', this._tipo === 'domicilio' ? 'flex' : 'none', 'important');
  },

  async confirmar() {
    if (!this._carrito.length) return;

    const subtotal = this._carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);
    const cargo    = this._tipo === 'domicilio'
      ? Number(document.getElementById('cargo-domicilio')?.value ?? 0) || 0
      : 0;

    const ventaPayload = {
      tipo_entrega:      this._tipo,
      cargo_domicilio:   cargo,
      metodo_pago:       document.getElementById('metodo-pago').value,
      notas:             document.getElementById('venta-notas').value.trim() || null,
      total:             subtotal + cargo,
      fecha:             new Date().toISOString(),
    };

    const detalles = this._carrito.map(i => ({
      producto_id:     i.productoId,
      cantidad:        i.cantidad,
      precio_unitario: i.precio,
      subtotal:        i.precio * i.cantidad,
    }));

    UI.toggleLoader(true);
    try {
      const venta = await insertVenta(ventaPayload, detalles);
      await notificarNuevaVenta(venta, this._carrito.map(i => ({ nombre: i.nombre, cantidad: i.cantidad })), Auth.perfil);
      UI.mostrarToast(`✓ Venta #${venta.id} registrada — $${Number(venta.total).toFixed(2)}`, 'success');
      this._resetear();
    } catch (err) {
      UI.mostrarToast('Error al registrar la venta: ' + err.message, 'error');
    } finally {
      UI.toggleLoader(false);
    }
  },

  _resetear() {
    this._carrito = [];
    this._tipo = 'recogida';
    document.getElementById('metodo-pago').value = 'efectivo';
    document.getElementById('venta-notas').value = '';
    document.getElementById('cargo-domicilio').value = '0';
    document.querySelectorAll('.btn-entrega').forEach(b => b.classList.toggle('active', b.dataset.tipo === 'recogida'));
    document.getElementById('cargo-domicilio-row').classList.add('d-none');
    this._renderCarrito();
  },

  _bindEventos() {
    // Búsqueda
    document.getElementById('buscar-producto')?.addEventListener('input', e => {
      this._renderCatalogo(e.target.value);
    });

    // Tipo entrega
    document.querySelectorAll('.btn-entrega').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-entrega').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._tipo = btn.dataset.tipo;
        document.getElementById('cargo-domicilio-row').classList.toggle('d-none', this._tipo !== 'domicilio');
        this._actualizarTotales();
      });
    });

    // Cargo domicilio
    document.getElementById('cargo-domicilio')?.addEventListener('input', () => this._actualizarTotales());

    // Confirmar
    document.getElementById('btn-confirmar-venta')?.addEventListener('click', () => this.confirmar());
  },
};
