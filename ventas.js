// ventas.js — lógica del carrito y registro de venta
// Depende de: supabase.js, notificaciones.js, ui.js

const Ventas = {
  _carrito: [],
  _tipo: 'recogida',
  _cargoTransfTipo: 'fijo',   // 'fijo' | 'porcentaje'
  _monedas: [],

  async iniciar() {
    await this._cargarMonedas();
    await this._renderCatalogo();
    this._bindEventos();
  },

  async _cargarMonedas() {
    try {
      this._monedas = await fetchMonedas(true);
      const sel = document.getElementById('moneda-pago');
      if (!sel) return;
      sel.innerHTML = this._monedas.map(m =>
        `<option value="${m.id}" data-tasa="${m.tasa_cambio}" data-simbolo="${m.simbolo}" data-nombre="${m.nombre}">${m.nombre} (${m.simbolo})</option>`
      ).join('');
    } catch (err) {
      console.warn('Error cargando monedas:', err.message);
    }
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

    // Cargo domicilio
    const cargo = this._tipo === 'domicilio'
      ? Number(document.getElementById('cargo-domicilio')?.value ?? 0) || 0
      : 0;

    // Cargo transferencia
    const metodoPago = document.getElementById('metodo-pago')?.value;
    let cargoTransf = 0;
    if (metodoPago === 'transferencia') {
      const val = Number(document.getElementById('cargo-transferencia-val')?.value) || 0;
      cargoTransf = this._cargoTransfTipo === 'porcentaje'
        ? (subtotal * val / 100)
        : val;
    }

    const total = subtotal + cargo + cargoTransf;

    document.getElementById('carrito-subtotal').textContent       = `$${subtotal.toFixed(2)}`;
    document.getElementById('carrito-cargo').textContent          = `$${cargo.toFixed(2)}`;
    document.getElementById('carrito-cargo-transf').textContent   = `$${cargoTransf.toFixed(2)}`;
    document.getElementById('carrito-total-val').textContent      = `$${total.toFixed(2)}`;

    const cargoRow = document.getElementById('cargo-row');
    if (cargoRow) cargoRow.style.setProperty('display', this._tipo === 'domicilio' ? 'flex' : 'none', 'important');

    const transfRow = document.getElementById('cargo-transf-row');
    if (transfRow) transfRow.style.setProperty('display', (metodoPago === 'transferencia' && cargoTransf > 0) ? 'flex' : 'none', 'important');

    // Equivalente en moneda seleccionada
    const monedaSel = document.getElementById('moneda-pago');
    const opt = monedaSel?.selectedOptions[0];
    const tasa = parseFloat(opt?.dataset.tasa ?? 1);
    const simbolo = opt?.dataset.simbolo ?? '$';
    const nombreM = opt?.dataset.nombre ?? '';
    const equivEl = document.getElementById('moneda-equivalente');
    if (equivEl) {
      if (tasa && tasa !== 1) {
        equivEl.textContent = `≈ ${simbolo}${(total / tasa).toFixed(2)} ${nombreM}`;
        equivEl.classList.remove('d-none');
      } else {
        equivEl.classList.add('d-none');
      }
    }
  },

  async confirmar() {
    if (!this._carrito.length) return;

    const subtotal  = this._carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);
    const cargo     = this._tipo === 'domicilio'
      ? Number(document.getElementById('cargo-domicilio')?.value ?? 0) || 0
      : 0;
    const clienteId = document.getElementById('venta-cliente-id')?.value || null;
    const metodoPago = document.getElementById('metodo-pago').value;

    // Cargo transferencia
    let cargoTransf = 0;
    if (metodoPago === 'transferencia') {
      const val = Number(document.getElementById('cargo-transferencia-val')?.value) || 0;
      cargoTransf = this._cargoTransfTipo === 'porcentaje'
        ? (subtotal * val / 100)
        : val;
    }

    // Moneda
    const monedaSel = document.getElementById('moneda-pago');
    const opt = monedaSel?.selectedOptions[0];
    const monedaId     = monedaSel?.value ? Number(monedaSel.value) : null;
    const monedaNombre = opt?.dataset.nombre ?? null;
    const monedaSimbolo = opt?.dataset.simbolo ?? null;
    const monedaTasa   = parseFloat(opt?.dataset.tasa ?? 1);

    const ventaPayload = {
      tipo_entrega:        this._tipo,
      cargo_domicilio:     cargo,
      metodo_pago:         metodoPago,
      cargo_transferencia: cargoTransf,
      moneda_id:           monedaId,
      moneda_nombre:       monedaNombre,
      moneda_simbolo:      monedaSimbolo,
      moneda_tasa:         monedaTasa,
      notas:               document.getElementById('venta-notas').value.trim() || null,
      total:               subtotal + cargo + cargoTransf,
      fecha:               new Date().toISOString(),
      cliente_id:          clienteId ? Number(clienteId) : null,
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
    this._cargoTransfTipo = 'fijo';
    document.getElementById('metodo-pago').value      = 'efectivo';
    document.getElementById('venta-notas').value      = '';
    document.getElementById('cargo-domicilio').value  = '0';
    document.querySelectorAll('#view-ventas .btn-entrega[data-tipo]').forEach(b =>
      b.classList.toggle('active', b.dataset.tipo === 'recogida'));
    document.getElementById('cargo-domicilio-row').classList.add('d-none');
    document.getElementById('transferencia-cargo-box').classList.add('d-none');
    document.getElementById('cargo-transferencia-val').value = '0';
    // Reset cargo tipo buttons
    document.querySelectorAll('.btn-cargo-tipo').forEach(b =>
      b.classList.toggle('active', b.dataset.cargoTipo === 'fijo'));
    this._sincronizarPrefixCargo();

    const hiddenId     = document.getElementById('venta-cliente-id');
    const inputCliente = document.getElementById('venta-cliente-buscar');
    const btnLimpiar   = document.getElementById('btn-limpiar-cliente');
    const sugerencias  = document.getElementById('venta-cliente-sugerencias');
    if (hiddenId)     hiddenId.value = '';
    if (inputCliente) { inputCliente.value = ''; inputCliente.readOnly = false; }
    if (btnLimpiar)   btnLimpiar.style.display = 'none';
    if (sugerencias)  sugerencias.innerHTML = '';

    this._renderCarrito();
  },

  _sincronizarPrefixCargo() {
    const prefix = document.getElementById('cargo-transf-prefix');
    if (!prefix) return;
    prefix.textContent = this._cargoTransfTipo === 'porcentaje' ? '%' : '$';
  },

  _bindEventos() {
    document.getElementById('buscar-producto')?.addEventListener('input', e => {
      this._renderCatalogo(e.target.value);
    });

    // Tipo entrega
    document.querySelectorAll('#view-ventas .btn-entrega[data-tipo]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#view-ventas .btn-entrega[data-tipo]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._tipo = btn.dataset.tipo;
        document.getElementById('cargo-domicilio-row').classList.toggle('d-none', this._tipo !== 'domicilio');
        this._actualizarTotales();
      });
    });

    document.getElementById('cargo-domicilio')?.addEventListener('input', () => this._actualizarTotales());

    // Método de pago
    document.getElementById('metodo-pago')?.addEventListener('change', e => {
      const esTransf = e.target.value === 'transferencia';
      document.getElementById('transferencia-cargo-box').classList.toggle('d-none', !esTransf);
      this._actualizarTotales();
    });

    // Tipo cargo transferencia (fijo / porcentaje)
    document.querySelectorAll('.btn-cargo-tipo').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-cargo-tipo').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._cargoTransfTipo = btn.dataset.cargoTipo;
        this._sincronizarPrefixCargo();
        this._actualizarTotales();
      });
    });

    document.getElementById('cargo-transferencia-val')?.addEventListener('input', () => this._actualizarTotales());

    // Moneda
    document.getElementById('moneda-pago')?.addEventListener('change', () => this._actualizarTotales());

    // Confirmar venta
    document.getElementById('btn-confirmar-venta')?.addEventListener('click', () => this.confirmar());

    // ── Selector de cliente ────────────────────────
    const inputCliente = document.getElementById('venta-cliente-buscar');
    const sugerencias  = document.getElementById('venta-cliente-sugerencias');
    const btnLimpiar   = document.getElementById('btn-limpiar-cliente');
    const hiddenId     = document.getElementById('venta-cliente-id');

    inputCliente?.addEventListener('input', async () => {
      const q = inputCliente.value.trim();
      if (!q) { sugerencias.innerHTML = ''; return; }

      try {
        const lista = await fetchClientes(q);
        if (!lista.length) {
          sugerencias.innerHTML = `<div style="font-size:.75rem;color:var(--text-subtle);padding:.4rem .5rem">Sin resultados</div>`;
          return;
        }
        sugerencias.innerHTML = `
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden;max-height:160px;overflow-y:auto;position:absolute;width:100%;z-index:100;top:2px">
            ${lista.slice(0, 6).map(c => `
              <div class="cliente-sug-item" data-id="${c.id}" data-nombre="${c.nombre_completo}"
                   style="padding:.55rem 1rem;cursor:pointer;font-size:.82rem;color:var(--mist);transition:background .15s;display:flex;justify-content:space-between;align-items:center">
                <span>${c.nombre_completo}</span>
                ${c.telefono ? `<span style="color:var(--text-dim);font-size:.72rem">${c.telefono}</span>` : ''}
              </div>`).join('')}
          </div>`;

        sugerencias.querySelectorAll('.cliente-sug-item').forEach(el => {
          el.addEventListener('mouseenter', () => el.style.background = 'rgba(181,113,42,0.1)');
          el.addEventListener('mouseleave', () => el.style.background = '');
          el.addEventListener('click', () => {
            hiddenId.value        = el.dataset.id;
            inputCliente.value    = el.dataset.nombre;
            inputCliente.readOnly = true;
            sugerencias.innerHTML = '';
            btnLimpiar.style.display = '';
          });
        });
      } catch (_) { /* falla silenciosamente */ }
    });

    btnLimpiar?.addEventListener('click', () => {
      hiddenId.value        = '';
      inputCliente.value    = '';
      inputCliente.readOnly = false;
      btnLimpiar.style.display = 'none';
      sugerencias.innerHTML = '';
    });

    document.addEventListener('click', e => {
      if (!sugerencias?.contains(e.target) && e.target !== inputCliente) {
        if (sugerencias) sugerencias.innerHTML = '';
      }
    });
  },
};
