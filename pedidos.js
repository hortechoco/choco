// pedidos.js — gestión de pedidos pendientes de clientes
// Depende de: supabase.js, ui.js, auth.js, notificaciones.js

const Pedidos = {
  _lista: [],
  _modal: null,
  _ventaActual: null,
  _monedas: [],
  _cargoTransfTipo: 'fijo',   // 'fijo' | 'porcentaje'

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

  async _cargarMonedas() {
    try {
      this._monedas = await fetchMonedas(true);
      const sel = document.getElementById('pedido-cargo-moneda');
      if (!sel) return;
      sel.innerHTML = this._monedas.map(m =>
        `<option value="${m.id}" data-tasa="${m.tasa_cambio}" data-simbolo="${m.simbolo}" data-nombre="${m.nombre}">${m.nombre} (${m.simbolo})</option>`
      ).join('');
    } catch (err) {
      console.warn('Error cargando monedas para cargos:', err.message);
    }
  },

  _renderTabla() {
    const tbody = document.getElementById('pedidos-tbody');
    if (!tbody) return;

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
      const cliente   = v.perfiles;
      const fecha     = new Date(v.fecha).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' });
      const tipoBadge = `<span class="badge-tipo ${v.tipo_entrega === 'domicilio' ? 'badge-domicilio' : 'badge-recogida'}">${v.tipo_entrega}</span>`;

      let estadoBadge = `<span class="badge-estado badge-estado-${v.estado}">${v.estado}</span>`;
      if (v.aprobacion_cliente === 'pendiente') {
        estadoBadge += ` <span class="badge-aprobacion" title="El cliente aún no aprobó los cargos">
          <i class="bi bi-clock"></i> Aprob.
        </span>`;
      }
      if (v.cliente_confirmo_entrega) {
        estadoBadge += ` <span class="badge-confirmado" title="Cliente confirmó recepción">
          <i class="bi bi-check2"></i>
        </span>`;
      }
      if (v.vendedor_confirmo_entrega) {
        estadoBadge += ` <span class="badge-confirmado" title="Vendedor confirmó entrega" style="opacity:.7">
          <i class="bi bi-check2-all"></i>
        </span>`;
      }

      const fechaEntrega = v.fecha_entrega
        ? `<div style="font-size:.68rem;color:var(--bronze);margin-top:2px"><i class="bi bi-calendar-event me-1"></i>${new Date(v.fecha_entrega + 'T00:00:00').toLocaleDateString('es',{dateStyle:'short'})}${v.hora_entrega ? ' ' + v.hora_entrega : ''}</div>`
        : '';

      return `
        <tr>
          <td style="font-family:'Lora',serif;color:var(--bronze)">#${v.id}</td>
          <td style="font-size:.78rem;color:var(--text-body)">${fecha}${fechaEntrega}</td>
          <td style="font-size:.82rem">${cliente?.nombre_completo ?? '<span style="color:var(--text-dim)">Anónimo</span>'}</td>
          <td>${tipoBadge}</td>
          <td><span class="badge-pago">${v.metodo_pago}</span></td>
          <td class="text-gold" style="font-weight:500">$${Number(v.total).toFixed(2)}</td>
          <td>${estadoBadge}</td>
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
    this._cargoTransfTipo = 'fijo';
    const cliente = venta.perfiles;

    document.getElementById('pedido-id-label').textContent      = `#${venta.id}`;
    document.getElementById('pedido-fecha-label').textContent   = new Date(venta.fecha).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
    document.getElementById('pedido-cliente-label').textContent = cliente?.nombre_completo ?? 'Sin cliente';
    document.getElementById('pedido-tel-label').textContent     = cliente?.telefono ?? '—';
    document.getElementById('pedido-dir-label').textContent     = cliente?.direccion ?? '—';
    document.getElementById('pedido-tipo-label').innerHTML      =
      `<span class="badge-tipo ${venta.tipo_entrega === 'domicilio' ? 'badge-domicilio' : 'badge-recogida'}">${venta.tipo_entrega}</span>`;
    document.getElementById('pedido-pago-label').innerHTML      = `<span class="badge-pago">${venta.metodo_pago}</span>`;
    document.getElementById('pedido-notas-label').textContent   = venta.notas || '—';

    const fechaEntEl = document.getElementById('pedido-fecha-entrega-row');
    const fechaEntLbl = document.getElementById('pedido-fecha-entrega-label');
    if (fechaEntEl && fechaEntLbl) {
      if (venta.fecha_entrega) {
        const fe = new Date(venta.fecha_entrega + 'T00:00:00').toLocaleDateString('es', { dateStyle: 'medium' });
        const he = venta.hora_entrega ? ` · ${venta.hora_entrega}` : '';
        fechaEntLbl.textContent = `${fe}${he}`;
        fechaEntEl.classList.remove('d-none');
      } else {
        fechaEntEl.classList.add('d-none');
      }
    }

    const dirEntEl  = document.getElementById('pedido-dir-entrega-row');
    const dirEntLbl = document.getElementById('pedido-dir-entrega-label');
    if (dirEntEl && dirEntLbl) {
      if (venta.tipo_entrega === 'domicilio' && venta.direccion_entrega) {
        dirEntLbl.textContent = venta.direccion_entrega;
        dirEntEl.classList.remove('d-none');
      } else {
        dirEntEl.classList.add('d-none');
      }
    }

    const aprobEl = document.getElementById('pedido-aprobacion-row');
    if (aprobEl) {
      if (!venta.cliente_id) {
        aprobEl.classList.add('d-none');
      } else {
        aprobEl.classList.remove('d-none');
        const aprobSpan = document.getElementById('pedido-aprobacion-label');
        if (aprobSpan) {
          if (!venta.aprobacion_cliente) {
            aprobSpan.innerHTML = `<span style="color:var(--text-dim);font-size:.78rem">Sin cargos — no requerida</span>`;
          } else if (venta.aprobacion_cliente === 'pendiente') {
            aprobSpan.innerHTML = `<span class="badge-aprobacion"><i class="bi bi-clock me-1"></i>Pendiente de cliente</span>`;
          } else {
            aprobSpan.innerHTML = `<span class="badge-confirmado"><i class="bi bi-check2 me-1"></i>Aprobado por cliente</span>`;
          }
        }
      }
    }

    const confirmaEl = document.getElementById('pedido-confirmacion-row');
    if (confirmaEl) {
      if (!venta.cliente_id) {
        confirmaEl.classList.add('d-none');
      } else {
        confirmaEl.classList.remove('d-none');
        const confirmaSpan = document.getElementById('pedido-confirmacion-label');
        if (confirmaSpan) {
          const cli  = venta.cliente_confirmo_entrega ? `<span class="badge-confirmado me-1"><i class="bi bi-person-check me-1"></i>Cliente ✓</span>` : '';
          const vend = venta.vendedor_confirmo_entrega ? `<span class="badge-confirmado"><i class="bi bi-check2-all me-1"></i>Vendedor ✓</span>` : '';
          confirmaSpan.innerHTML = (cli || vend)
            ? `${cli}${vend}`
            : `<span style="color:var(--text-dim);font-size:.78rem">Aún no confirmado</span>`;
        }
      }
    }

    document.getElementById('pedido-estado').value              = venta.estado;
    document.getElementById('pedido-cargo-domicilio').value     = venta.cargo_domicilio ?? 0;
    document.getElementById('pedido-cargo-transferencia').value = venta.cargo_transferencia ?? 0;

    document.getElementById('pedido-domicilio-row').classList.toggle('d-none', venta.tipo_entrega !== 'domicilio');
    document.getElementById('pedido-transf-row').classList.toggle('d-none', venta.metodo_pago !== 'transferencia');

    // Reset cargo tipo buttons
    document.querySelectorAll('.btn-cargo-tipo-pedido').forEach(b =>
      b.classList.toggle('active', b.dataset.cargoTipo === 'fijo'));
    this._sincronizarPrefixCargo();

    // Set cargo moneda (restore if previously set, else default to base)
    const cargoMonedaSel = document.getElementById('pedido-cargo-moneda');
    if (cargoMonedaSel) {
      if (venta.cargo_moneda_id) {
        cargoMonedaSel.value = String(venta.cargo_moneda_id);
      } else {
        // Default to base currency (tasa === 1)
        const baseOpt = Array.from(cargoMonedaSel.options).find(o => parseFloat(o.dataset.tasa) === 1);
        if (baseOpt) cargoMonedaSel.value = baseOpt.value;
        else cargoMonedaSel.selectedIndex = 0;
      }
    }

    const btnConfEnt = document.getElementById('btn-confirmar-entrega-pedido');
    if (btnConfEnt) {
      const yaConfirmado = venta.vendedor_confirmo_entrega;
      const terminado    = venta.estado === 'cancelado';
      btnConfEnt.disabled = yaConfirmado || terminado;
      const labelEnt = venta.tipo_entrega === 'domicilio' ? 'Confirmar entrega' : 'Confirmar recogida';
      btnConfEnt.innerHTML = yaConfirmado
        ? `<i class="bi bi-check2-all me-1"></i>${labelEnt} ✓`
        : `<i class="bi bi-check2-all me-1"></i>${labelEnt}`;
    }

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

    // Cargo moneda
    const cargoMonedaSel = document.getElementById('pedido-cargo-moneda');
    const cargoOpt  = cargoMonedaSel?.selectedOptions[0];
    const cargoTasa = parseFloat(cargoOpt?.dataset.tasa ?? 1);
    const cargoSimb = cargoOpt?.dataset.simbolo ?? '$';

    // Cargo domicilio in cargo_moneda units
    const cargoRaw = venta.tipo_entrega === 'domicilio'
      ? Number(document.getElementById('pedido-cargo-domicilio')?.value) || 0 : 0;

    // Cargo transferencia — fijo or % of subtotal (base), expressed in cargo_moneda units
    let cargoTransfRaw = 0;
    if (venta.metodo_pago === 'transferencia') {
      const val = Number(document.getElementById('pedido-cargo-transferencia')?.value) || 0;
      cargoTransfRaw = this._cargoTransfTipo === 'porcentaje'
        ? (subtotal * val / 100) / cargoTasa
        : val;
    }

    // Convert to base for total
    const total = subtotal + cargoRaw * cargoTasa + cargoTransfRaw * cargoTasa;

    document.getElementById('pedido-subtotal').textContent  = `$${subtotal.toFixed(2)}`;
    document.getElementById('pedido-total-val').textContent = `$${total.toFixed(2)}`;

    const cargoRow = document.getElementById('pedido-cargo-row-display');
    if (cargoRow) cargoRow.style.setProperty('display', cargoRaw > 0 ? 'flex' : 'none', 'important');
    const transfRow = document.getElementById('pedido-transf-row-display');
    if (transfRow) transfRow.style.setProperty('display', cargoTransfRaw > 0 ? 'flex' : 'none', 'important');

    document.getElementById('pedido-cargo-display').textContent  = `${cargoSimb}${cargoRaw.toFixed(2)}`;
    document.getElementById('pedido-transf-display').textContent = `${cargoSimb}${cargoTransfRaw.toFixed(2)}`;
  },

  _sincronizarPrefixCargo() {
    const prefix = document.getElementById('pedido-cargo-transf-prefix');
    if (!prefix) return;
    prefix.textContent = this._cargoTransfTipo === 'porcentaje' ? '%' : '$';
  },

  async guardar() {
    const venta = this._ventaActual;
    if (!venta) return;

    const estado = document.getElementById('pedido-estado').value;

    const cargoMonedaSel    = document.getElementById('pedido-cargo-moneda');
    const cargoOpt          = cargoMonedaSel?.selectedOptions[0];
    const cargoTasa         = parseFloat(cargoOpt?.dataset.tasa ?? 1);
    const cargo_moneda_id      = cargoMonedaSel?.value ? Number(cargoMonedaSel.value) : null;
    const cargo_moneda_nombre  = cargoOpt?.dataset.nombre ?? null;
    const cargo_moneda_simbolo = cargoOpt?.dataset.simbolo ?? null;
    const cargo_moneda_tasa    = cargoTasa;

    const items    = venta._items ?? [];
    const subtotal = items.reduce((s, i) => s + Number(i.subtotal), 0);

    const cargo_domicilio = venta.tipo_entrega === 'domicilio'
      ? Number(document.getElementById('pedido-cargo-domicilio').value) || 0 : 0;

    let cargo_transferencia = 0;
    if (venta.metodo_pago === 'transferencia') {
      const val = Number(document.getElementById('pedido-cargo-transferencia')?.value) || 0;
      cargo_transferencia = this._cargoTransfTipo === 'porcentaje'
        ? (subtotal * val / 100) / cargoTasa
        : val;
    }

    // Total in base currency
    const total = subtotal + cargo_domicilio * cargoTasa + cargo_transferencia * cargoTasa;

    const tieneNuevosCargos = cargo_domicilio > 0 || cargo_transferencia > 0;
    const yaAprobado = venta.aprobacion_cliente === 'aprobado';
    const necesitaAprobacion = tieneNuevosCargos && venta.cliente_id != null && !yaAprobado;

    const payload = {
      estado,
      cargo_domicilio,
      cargo_transferencia,
      cargo_moneda_id,
      cargo_moneda_nombre,
      cargo_moneda_simbolo,
      cargo_moneda_tasa,
      total,
      vendedor_id: Auth.perfil?.id ?? null,
      ...(necesitaAprobacion ? { aprobacion_cliente: 'pendiente' } : {}),
    };

    const spinner = document.getElementById('btn-guardar-pedido-spinner');
    const label   = document.getElementById('btn-guardar-pedido-label');
    spinner.classList.remove('d-none');
    label.textContent = 'Guardando...';

    try {
      const ventaActualizada = await updateVenta(venta.id, payload);
      await notificarModificacionPedido(venta, ventaActualizada, Auth.perfil);
      UI.mostrarToast(
        necesitaAprobacion
          ? `Pedido #${venta.id} actualizado — el cliente debe aprobar los cargos`
          : `Pedido #${venta.id} actualizado`,
        'success'
      );
      this._modal?.hide();
      await this.cargar();
    } catch (err) {
      UI.mostrarToast('Error: ' + err.message, 'error');
    } finally {
      spinner.classList.add('d-none');
      label.textContent = 'Guardar cambios';
    }
  },

  async confirmarEntregaVendedor() {
    const venta = this._ventaActual;
    if (!venta) return;

    const esDomicilio = venta.tipo_entrega === 'domicilio';
    const accion = esDomicilio ? 'la entrega a domicilio' : 'la recogida en tienda';
    const ok = window.confirm(`¿Confirmar ${accion} del pedido #${venta.id}?\nEsto marcará el pedido como completado.`);
    if (!ok) return;

    UI.toggleLoader(true);
    try {
      const payload = {
        estado:                    'completado',
        vendedor_confirmo_entrega: true,
        vendedor_id:               Auth.perfil?.id ?? null,
      };
      const ventaActualizada = await updateVenta(venta.id, payload);
      await notificarModificacionPedido(venta, ventaActualizada, Auth.perfil);
      UI.mostrarToast(
        esDomicilio ? `Entrega del pedido #${venta.id} confirmada` : `Recogida del pedido #${venta.id} confirmada`,
        'success'
      );
      this._modal?.hide();
      await this.cargar();
    } catch (err) {
      UI.mostrarToast('Error: ' + err.message, 'error');
    } finally {
      UI.toggleLoader(false);
    }
  },

  iniciarEscuchas() {
    this._cargarMonedas();

    document.getElementById('pedido-cargo-domicilio')?.addEventListener('input', () => this._actualizarTotalModal());
    document.getElementById('pedido-cargo-transferencia')?.addEventListener('input', () => this._actualizarTotalModal());
    document.getElementById('pedido-cargo-moneda')?.addEventListener('change', () => this._actualizarTotalModal());
    document.getElementById('btn-guardar-pedido')?.addEventListener('click', () => this.guardar());
    document.getElementById('btn-confirmar-entrega-pedido')?.addEventListener('click', () => this.confirmarEntregaVendedor());

    document.querySelectorAll('.btn-cargo-tipo-pedido').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-cargo-tipo-pedido').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._cargoTransfTipo = btn.dataset.cargoTipo;
        this._sincronizarPrefixCargo();
        this._actualizarTotalModal();
      });
    });
  },
};
