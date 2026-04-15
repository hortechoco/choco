// storefront.js — Lógica de la tienda para clientes
// Depende de: supabase.js, ui.js, auth.js, notificaciones.js

const Storefront = {
  _carrito: [],
  _productos: [],
  _tipoEntrega: 'recogida',
  _usarDirGuardada: true,
  _monedas: [],

  async iniciar() {
    const badge = document.getElementById('storefront-user-badge');
    if (badge) badge.textContent = `${Auth.perfil?.nombre_completo} · Cliente`;

    // Min fecha = hoy
    const hoy = new Date().toISOString().split('T')[0];
    const fechaInput = document.getElementById('storefront-fecha-entrega');
    if (fechaInput) fechaInput.min = hoy;

    // Pre-cargar dirección guardada
    const dirLabel = document.getElementById('storefront-dir-guardada-label');
    if (dirLabel) {
      const dir = Auth.perfil?.direccion;
      dirLabel.textContent = dir || 'Sin dirección guardada';
      if (!dir) {
        // Si no tiene dirección guardada, mostrar automáticamente campo libre
        document.getElementById('btn-dir-otra')?.classList.add('active');
        document.getElementById('btn-dir-guardada')?.classList.remove('active');
        document.getElementById('storefront-dir-custom')?.classList.remove('d-none');
        dirLabel.classList.add('d-none');
        this._usarDirGuardada = false;
      }
    }

    await this._cargarProductos();
    await this._cargarMonedas();
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

  async _cargarMonedas() {
    try {
      this._monedas = await fetchMonedas(true);
      const sel = document.getElementById('storefront-moneda');
      if (!sel) return;
      sel.innerHTML = this._monedas.map(m =>
        `<option value="${m.id}" data-tasa="${m.tasa_cambio}" data-simbolo="${m.simbolo}" data-nombre="${m.nombre}">${m.nombre} (${m.simbolo})</option>`
      ).join('');
    } catch (err) {
      console.warn('Error cargando monedas:', err.message);
    }
  },

  _renderCatalogo(filtro = '') {
    const container = document.getElementById('storefront-catalogo');
    const filtrados = filtro
      ? this._productos.filter(p => p.nombre.toLowerCase().includes(filtro.toLowerCase()))
      : this._productos;

    if (!filtrados.length) {
      container.innerHTML = `<div class="empty-state">No hay productos disponibles</div>`;
      return;
    }

    container.innerHTML = filtrados.map(p => `
      <div class="producto-card" data-id="${p.id}">
        ${p.imagen_url
          ? `<img src="${p.imagen_url}" alt="${p.nombre}">`
          : `<div class="pc-icon"><i class="bi bi-box-seam" style="font-size:1.2rem;color:var(--bronze)"></i></div>`}
        <div class="pc-nombre">${p.nombre}</div>
        ${p.descripcion ? `<div class="pc-desc">${p.descripcion}</div>` : ''}
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
    if (existente) existente.cantidad++;
    else this._carrito.push({ productoId: producto.id, nombre: producto.nombre, precio: Number(producto.precio), cantidad: 1 });
    this._renderCarrito();
  },

  _renderCarrito() {
    const container    = document.getElementById('storefront-carrito-items');
    const btnConfirmar = document.getElementById('btn-confirmar-pedido');

    if (!this._carrito.length) {
      container.innerHTML = `
        <div class="empty-state text-center py-5">
          <i class="bi bi-bag" style="font-size:2rem;opacity:.2"></i>
          <p class="mt-2 small">Aún no has agregado productos</p>
        </div>`;
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
      </div>`).join('');

    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        if (btn.dataset.action === 'inc')    this._cambiarCantidad(id, +1);
        if (btn.dataset.action === 'dec')    this._cambiarCantidad(id, -1);
        if (btn.dataset.action === 'remove') { this._carrito = this._carrito.filter(i => i.productoId !== id); this._renderCarrito(); }
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
    // Los cargos (domicilio, transferencia) los aplica el vendedor al gestionar el pedido.
    // El cliente solo ve el subtotal de los productos seleccionados.
    const total = this._carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);

    document.getElementById('storefront-subtotal').textContent = `$${total.toFixed(2)}`;
    document.getElementById('storefront-total').textContent   = `$${total.toFixed(2)}`;

    // Equivalente moneda
    const monedaSel = document.getElementById('storefront-moneda');
    const opt    = monedaSel?.selectedOptions[0];
    const tasa   = parseFloat(opt?.dataset.tasa ?? 1);
    const simbolo = opt?.dataset.simbolo ?? '$';
    const nombreM = opt?.dataset.nombre ?? '';
    const equivEl = document.getElementById('storefront-moneda-equivalente');
    if (equivEl) {
      if (tasa && tasa !== 1) {
        equivEl.textContent = `≈ ${simbolo}${(total / tasa).toFixed(2)} ${nombreM}`;
        equivEl.classList.remove('d-none');
      } else {
        equivEl.classList.add('d-none');
      }
    }
  },

  _bindEventos() {
    document.getElementById('storefront-buscar')?.addEventListener('input', e => {
      this._renderCatalogo(e.target.value);
    });

    // Tipo entrega
    document.querySelectorAll('#storefront-view .btn-entrega[data-tipo]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#storefront-view .btn-entrega[data-tipo]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._tipoEntrega = btn.dataset.tipo;
        document.getElementById('storefront-direccion-row').classList.toggle('d-none', this._tipoEntrega !== 'domicilio');
        this._actualizarTotales();
      });
    });

    // Toggle dirección guardada / otra
    document.querySelectorAll('#storefront-view [data-dir]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#storefront-view [data-dir]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._usarDirGuardada = btn.dataset.dir === 'guardada';
        document.getElementById('storefront-dir-guardada-label').classList.toggle('d-none', !this._usarDirGuardada);
        document.getElementById('storefront-dir-custom').classList.toggle('d-none', this._usarDirGuardada);
      });
    });

    document.getElementById('storefront-moneda')?.addEventListener('change', () => this._actualizarTotales());
    document.getElementById('btn-confirmar-pedido')?.addEventListener('click', () => this.confirmarPedido());
  },

  async confirmarPedido() {
    if (!this._carrito.length) return;

    // Validar fecha obligatoria
    const fechaEntrega = document.getElementById('storefront-fecha-entrega')?.value || null;
    if (!fechaEntrega) {
      UI.mostrarToast('Selecciona una fecha de entrega', 'error');
      document.getElementById('storefront-fecha-entrega')?.focus();
      return;
    }

    const horaEntrega = document.getElementById('storefront-hora-entrega')?.value || null;

    // Dirección de entrega (solo domicilio)
    let direccionEntrega = null;
    if (this._tipoEntrega === 'domicilio') {
      if (this._usarDirGuardada) {
        direccionEntrega = Auth.perfil?.direccion ?? null;
      } else {
        direccionEntrega = document.getElementById('storefront-dir-custom')?.value.trim() || null;
      }
      if (!direccionEntrega) {
        UI.mostrarToast('Ingresa la dirección de entrega', 'error');
        document.getElementById('storefront-dir-custom')?.focus();
        return;
      }
    }

    const subtotal   = this._carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);
    // Los cargos (domicilio, transferencia) los asigna el vendedor al revisar el pedido.
    const metodoPago = document.getElementById('storefront-metodo-pago').value;
    const notas      = document.getElementById('storefront-notas').value.trim() || null;

    const monedaSel  = document.getElementById('storefront-moneda');
    const opt        = monedaSel?.selectedOptions[0];
    const monedaId   = monedaSel?.value ? Number(monedaSel.value) : null;

    const ventaPayload = {
      tipo_entrega:        this._tipoEntrega,
      cargo_domicilio:     0,   // el vendedor lo asigna al gestionar el pedido
      metodo_pago:         metodoPago,
      cargo_transferencia: 0,   // ídem
      moneda_id:           monedaId,
      moneda_nombre:       opt?.dataset.nombre ?? null,
      moneda_simbolo:      opt?.dataset.simbolo ?? null,
      moneda_tasa:         parseFloat(opt?.dataset.tasa ?? 1),
      notas,
      total:               subtotal,
      estado:              'pendiente',
      cliente_id:          Auth.perfil.id,
      vendedor_id:         null,
      fecha_entrega:       fechaEntrega,
      hora_entrega:        horaEntrega,
      direccion_entrega:   direccionEntrega,
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
      UI.mostrarToast('¡Pedido enviado! Te avisaremos cuando esté listo.', 'success');
      this._resetear();
    } catch (err) {
      UI.mostrarToast('Error al realizar el pedido: ' + err.message, 'error');
    } finally {
      UI.toggleLoader(false);
    }
  },

  _resetear() {
    this._carrito          = [];
    this._tipoEntrega      = 'recogida';
    this._usarDirGuardada  = true;

    document.getElementById('storefront-metodo-pago').value = 'efectivo';
    document.getElementById('storefront-notas').value       = '';
    document.getElementById('storefront-fecha-entrega').value = '';
    if (document.getElementById('storefront-hora-entrega'))
      document.getElementById('storefront-hora-entrega').value = '';

    document.querySelectorAll('#storefront-view .btn-entrega[data-tipo]').forEach(b => {
      b.classList.toggle('active', b.dataset.tipo === 'recogida');
    });
    document.getElementById('storefront-cargo-row').classList.add('d-none');
    document.getElementById('storefront-direccion-row').classList.add('d-none');

    // Reset dirección
    document.getElementById('btn-dir-guardada')?.classList.add('active');
    document.getElementById('btn-dir-otra')?.classList.remove('active');
    document.getElementById('storefront-dir-guardada-label')?.classList.remove('d-none');
    document.getElementById('storefront-dir-custom')?.classList.add('d-none');
    if (document.getElementById('storefront-dir-custom'))
      document.getElementById('storefront-dir-custom').value = '';

    this._renderCarrito();
  },
};
