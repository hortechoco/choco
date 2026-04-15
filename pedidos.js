// pedidos.js — gestión de pedidos pendientes de clientes
// Depende de: supabase.js, ui.js, auth.js

const Pedidos = {
  _lista: [],
  _modal: null,
  _ventaActual: null,

  async cargar() {
    const tbody = document.getElementById('pedidos-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="empty-state text-center py-4">Cargando...</td></tr>`;
    try {
      this._lista = await fetchPedidosPendientes();
      this._renderTabla();
    } catch (err) {
      UI.mostrarToast('Error cargando pedidos: ' + err.message, 'error');
    }
  },

  _renderTabla() {
    const tbody = document.getElementById('pedidos-tbody');
    if (!tbody) return;

    // Badge contador en nav
    const badge = document.getElementById('pedidos-count-badge');
    if (badge) {
      badge.textContent  = this._lista.length || '';
      badge.style.display = this._lista.length ? 'inline' : 'none';
    }

    if (!this._lista.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-state text-center py-4">No hay pedidos pendientes</td></tr>`;
      return;
    }

    tbody.innerHTML = this._lista.map(v => {
      const cliente = v.perfiles;
      const fecha   = new Date(v.fecha).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' });
      const tipoBadge = `<span class="badge-tipo ${v.tipo_entrega === 'domicilio' ? 'badge-domicilio' : 'badge-recogida'}">${v.tipo_entrega}</span>`;
      return `
        <tr>
          <td style="font-family:'Lora',serif;color:var(--bronze)">#${v.id}</td>
          <td style="font-size:.78rem;color:var(--text-body)">${fecha}</td>
          <td style="font-size:.82rem">${cliente?.nombre_completo ?? '<span style="color:var(--text-dim)">Anónimo</span>'}</td>
          <td>${tipoBadge}</td>
          <td><span class="badge-pago">${v.metodo_pago}</span></td>
          <td class="text-gold" style="font-weight:500">$${Number(v.total).toFixed(2)}</td>
          <td><span class="badge-estado badge-estado-${v.estado}">${v.estado}</span></td>
          <td class="text-end">
            <button class="btn btn-sm btn-luxury" data-action="gestionar" data-id="${v.id}">
              <i class="bi bi-pencil-square me-1"></i>Gestionar
            </button>
          </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('[data-action="gestionar"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const venta = this._lista.find(v => String(v.id) === btn.dataset.id);
        if (venta) this.abrirModal(venta);
      });
    });
  },

  async abrirModal(venta) {
    this._ventaActual = venta;
    const cliente = venta.perfiles;

    // Info de sólo lectura
    document.getElementById('pedido-id-label').textContent      = `#${venta.id}`;
    document.getElementById('pedido-fecha-label').textContent   = new Date(venta.fecha).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
    document.getElementById('pedido-cliente-label').textContent = cliente?.nombre_completo ?? 'Sin cliente';
    document.getElementById('pedido-tel-label').textContent     = cliente?.telefono ?? '—';
    document.getElementById('pedido-dir-label').textContent     = cliente?.direccion ?? '—';
    document.getElementById('pedido-tipo-label').innerHTML      =
      `<span class="badge-tipo ${venta.tipo_entrega === 'domicilio' ? 'badge-domicilio' : 'badge-recogida'}">${venta.tipo_entrega}</span>`;
    document.getElementById('pedido-pago-label').innerHTML      = `<span class="badge-pago">${venta.metodo_pago}</span>`;
    document.getElementById('pedido-notas-label').textContent   = venta.notas || '—';

    // Campos editables
    document.getElementById('pedido-estado').value                = venta.estado;
    document.getElementById('pedido-cargo-domicilio').value       = venta.cargo_domicilio ?? 0;
    document.getElementById('pedido-cargo-transferencia').value   = venta.cargo_transferencia ?? 0;

    // Mostrar/ocultar filas según tipo
    document.getElementById('pedido-domicilio-row').classList.toggle('d-none', venta.tipo_entrega !== 'domicilio');
    document.getElementById('pedido-transf-row').classList.toggle('d-none', venta.metodo_pago !== 'transferencia');

    // Cargar items
    const itemsEl = document.getElementById('pedido-items-body');
    itemsEl.innerHTML = `<tr><td colspan="4" class="empty-state text-center py-2">Cargando...</td></tr>`;

    if (!this._modal)
      this._modal = new bootstrap.Modal(document.getElementById('modal-gestionar-pedido'));
    this._modal.show();

    try {
      const items = await fetchDetalleVenta(venta.id);
      if (!items.length) {
        itemsEl.innerHTML = `<tr><td colspan="4" class="empty-state py-2 text-center">Sin items</td></tr>`;
      } else {
        itemsEl.innerHTML = items.map(i => `
          <tr>
            <td>${i.productos?.nombre ?? `Producto #${i.producto_id}`}</td>
            <td class="text-center">${i.cantidad}</td>
            <td class="text-end" style="color:var(--text-body)">$${Number(i.precio_unitario).toFixed(2)}</td>
            <td class="text-end text-gold">$${Number(i.subtotal).toFixed(2)}</td>
          </tr>`).join('');
      }
      this._ventaActual._items = items;
      this._actualizarTotalModal();
    } catch (err) {
      itemsEl.innerHTML = `<tr><td colspan="4" class="empty-state py-2 text-center">Error: ${err.message}</td></tr>`;
    }
  },

  _actualizarTotalModal() {
    const venta = this._ventaActual;
    if (!venta) return;
    const items    = venta._items ?? [];
    const subtotal = items.reduce((s, i) => s + Number(i.subtotal), 0);
    const cargo    = venta.tipo_entrega === 'domicilio'
      ? Number(document.getElementById('pedido-cargo-domicilio')?.value) || 0 : 0;
    const transf   = venta.metodo_pago === 'transferencia'
      ? Number(document.getElementById('pedido-cargo-transferencia')?.value) || 0 : 0;
    const total = subtotal + cargo + transf;

    document.getElementById('pedido-subtotal').textContent   = `$${subtotal.toFixed(2)}`;
    document.getElementById('pedido-total-val').textContent  = `$${total.toFixed(2)}`;

    const cargoRow = document.getElementById('pedido-cargo-row-display');
    if (cargoRow) cargoRow.style.setProperty('display', cargo > 0 ? 'flex' : 'none', 'important');
    const transfRow = document.getElementById('pedido-transf-row-display');
    if (transfRow) transfRow.style.setProperty('display', transf > 0 ? 'flex' : 'none', 'important');
    document.getElementById('pedido-cargo-display').textContent  = `$${cargo.toFixed(2)}`;
    document.getElementById('pedido-transf-display').textContent = `$${transf.toFixed(2)}`;
  },

  async guardar() {
    const venta = this._ventaActual;
    if (!venta) return;

    const estado = document.getElementById('pedido-estado').value;
    const cargo_domicilio = venta.tipo_entrega === 'domicilio'
      ? Number(document.getElementById('pedido-cargo-domicilio').value) || 0 : 0;
    const cargo_transferencia = venta.metodo_pago === 'transferencia'
      ? Number(document.getElementById('pedido-cargo-transferencia').value) || 0 : 0;
    const items    = venta._items ?? [];
    const subtotal = items.reduce((s, i) => s + Number(i.subtotal), 0);
    const total    = subtotal + cargo_domicilio + cargo_transferencia;

    const payload = {
      estado,
      cargo_domicilio,
      cargo_transferencia,
      total,
      vendedor_id: Auth.perfil?.id ?? null,
    };

    const spinner = document.getElementById('btn-guardar-pedido-spinner');
    const label   = document.getElementById('btn-guardar-pedido-label');
    spinner.classList.remove('d-none');
    label.textContent = 'Guardando...';

    try {
      await updateVenta(venta.id, payload);
      UI.mostrarToast(`Pedido #${venta.id} actualizado`, 'success');
      this._modal?.hide();
      await this.cargar();
    } catch (err) {
      UI.mostrarToast('Error: ' + err.message, 'error');
    } finally {
      spinner.classList.add('d-none');
      label.textContent = 'Guardar';
    }
  },

  iniciarEscuchas() {
    document.getElementById('pedido-cargo-domicilio')?.addEventListener('input', () => this._actualizarTotalModal());
    document.getElementById('pedido-cargo-transferencia')?.addEventListener('input', () => this._actualizarTotalModal());
    document.getElementById('btn-guardar-pedido')?.addEventListener('click', () => this.guardar());
  },
};
