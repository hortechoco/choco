// mispedidos.js — seguimiento y acciones sobre pedidos propios del cliente
// Depende de: supabase.js, ui.js, auth.js, notificaciones.js

const MisPedidos = {
  _lista: [],
  _modalEditar: null,

  async cargar() {
    const container = document.getElementById('mispedidos-lista');
    if (container) container.innerHTML = `<div class="empty-state text-center py-5">Cargando...</div>`;
    try {
      this._lista = await fetchMisPedidos(Auth.perfil.id);
      this._render();
    } catch (err) {
      UI.mostrarToast('Error cargando pedidos: ' + err.message, 'error');
    }
  },

  _render() {
    const container = document.getElementById('mispedidos-lista');
    if (!container) return;

    if (!this._lista.length) {
      container.innerHTML = `
        <div class="empty-state text-center py-5">
          <i class="bi bi-bag" style="font-size:2.5rem;opacity:.2"></i>
          <p class="mt-3">Aún no tienes pedidos</p>
          <p class="small" style="color:var(--text-dim)">Ve al catálogo para hacer tu primer pedido</p>
        </div>`;
      return;
    }

    container.innerHTML = this._lista.map(v => this._renderCard(v)).join('');

    container.querySelectorAll('[data-pedido-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const accion = btn.dataset.pedidoAction;
        const pedido = this._lista.find(v => String(v.id) === String(btn.dataset.id));
        if (!pedido) return;
        if (accion === 'cancelar')  this._cancelar(pedido);
        if (accion === 'aprobar')   this._aprobar(pedido);
        if (accion === 'confirmar') this._confirmarEntrega(pedido);
        if (accion === 'editar')    this._editar(pedido);
      });
    });
  },

  _renderCard(v) {
    const items    = v.detalle_ventas ?? [];
    const resumen  = items.slice(0, 2).map(i => `${i.cantidad}× ${i.productos?.nombre ?? '?'}`).join(', ');
    const masItems = items.length > 2
      ? ` <span style="color:var(--text-dim)">+${items.length - 2} más</span>` : '';
    const fecha    = new Date(v.fecha).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' });
    const acciones = this._acciones(v);

    let entregaInfo = '';
    if (v.fecha_entrega) {
      const fechaEnt = new Date(v.fecha_entrega + 'T00:00:00').toLocaleDateString('es', { dateStyle: 'medium' });
      const horaEnt  = v.hora_entrega ? ` · ${v.hora_entrega}` : '';
      entregaInfo = `
        <div class="pedido-entrega-info mt-1">
          <i class="bi bi-calendar-event me-1"></i>${v.tipo_entrega === 'domicilio' ? 'Entrega' : 'Recogida'}: <strong>${fechaEnt}${horaEnt}</strong>
        </div>`;
    }

    let dirInfo = '';
    if (v.tipo_entrega === 'domicilio' && v.direccion_entrega) {
      dirInfo = `
        <div class="pedido-entrega-info mt-1">
          <i class="bi bi-geo-alt me-1"></i>${v.direccion_entrega}
        </div>`;
    }

    // Cargo currency symbol (from vendor)
    const cargoSimb = v.cargo_moneda_simbolo ?? '$';

    // Banner de aprobación
    let banner = '';
    if (v.aprobacion_cliente === 'pendiente') {
      const cargos = Number(v.cargo_domicilio || 0) + Number(v.cargo_transferencia || 0);
      const cargoNombre = v.cargo_moneda_nombre ? ` (${v.cargo_moneda_nombre})` : '';
      banner = `
        <div class="aprobacion-banner">
          <i class="bi bi-exclamation-circle me-2"></i>
          El vendedor añadió cargos adicionales de <strong>${cargoSimb}${cargos.toFixed(2)}${cargoNombre}</strong>.
          Total actualizado: <strong>$${Number(v.total).toFixed(2)}</strong>
        </div>`;
    }

    // Badges extra
    let extraBadges = '';
    if (v.aprobacion_cliente === 'pendiente') {
      extraBadges += `<span class="badge-aprobacion"><i class="bi bi-clock me-1"></i>Aprobación requerida</span>`;
    }
    if (v.cliente_confirmo_entrega) {
      extraBadges += `<span class="badge-confirmado"><i class="bi bi-check2 me-1"></i>Recepción confirmada</span>`;
    } else if (v.vendedor_confirmo_entrega) {
      extraBadges += `<span class="badge-confirmado" style="opacity:.7"><i class="bi bi-check2 me-1"></i>Entregado por vendedor</span>`;
    }

    // Desglose de cargos con moneda del vendedor
    let desglose = '';
    const subtotal = items.reduce((s, i) => s + Number(i.subtotal), 0);
    const cargoD   = Number(v.cargo_domicilio || 0);
    const cargoT   = Number(v.cargo_transferencia || 0);
    if (cargoD > 0 || cargoT > 0) {
      desglose = `
        <div class="pedido-desglose mt-2">
          <span>Subtotal: $${subtotal.toFixed(2)}</span>
          ${cargoD > 0 ? `<span>Domicilio: ${cargoSimb}${cargoD.toFixed(2)}</span>` : ''}
          ${cargoT > 0 ? `<span>Transferencia: ${cargoSimb}${cargoT.toFixed(2)}</span>` : ''}
        </div>`;
    }

    return `
      <div class="pedido-card">
        <div class="pedido-card-header">
          <div class="d-flex align-items-center gap-2 flex-wrap">
            <span class="pedido-num">#${v.id}</span>
            <span class="badge-estado badge-estado-${v.estado}">${v.estado.replace('_', ' ')}</span>
            ${extraBadges}
          </div>
          <span class="pedido-fecha">${fecha}</span>
        </div>
        ${banner}
        <div class="pedido-card-body">
          <div class="pedido-resumen">${resumen}${masItems}</div>
          ${entregaInfo}${dirInfo}
          ${desglose}
          <div class="d-flex align-items-center justify-content-between mt-2 flex-wrap gap-2">
            <div class="d-flex gap-2 align-items-center flex-wrap">
              <span class="badge-tipo ${v.tipo_entrega === 'domicilio' ? 'badge-domicilio' : 'badge-recogida'}">${v.tipo_entrega}</span>
              <span class="badge-pago">${v.metodo_pago}</span>
            </div>
            <span class="pedido-total text-gold">$${Number(v.total).toFixed(2)}</span>
          </div>
          ${v.notas ? `<div class="pedido-notas mt-2"><i class="bi bi-chat-text me-1"></i>${v.notas}</div>` : ''}
        </div>
        ${acciones.length ? `
        <div class="pedido-card-footer">
          ${acciones.map(a => `
            <button class="btn btn-sm ${a.clase}" data-pedido-action="${a.accion}" data-id="${v.id}">
              <i class="bi ${a.icono} me-1"></i>${a.label}
            </button>`).join('')}
        </div>` : ''}
      </div>`;
  },

  _acciones(v) {
    if (v.estado === 'cancelado') return [];
    const acc = [];

    // Aprobar cargos (prioridad visual)
    if (v.aprobacion_cliente === 'pendiente') {
      acc.push({ accion: 'aprobar', label: 'Aprobar cargos', icono: 'bi-check-circle', clase: 'btn-luxury' });
    }

    // Confirmar llegada/recepción — bloqueado mientras haya aprobación pendiente
    const aprobPendiente = v.aprobacion_cliente === 'pendiente';
    const puedeConfirmar = !v.cliente_confirmo_entrega && !aprobPendiente && (
      v.estado === 'completado' ||
      (v.tipo_entrega === 'domicilio' && (v.estado === 'en_proceso' || v.estado === 'pendiente'))
    );
    if (puedeConfirmar) {
      const esDomicilio = v.tipo_entrega === 'domicilio';
      acc.push({
        accion: 'confirmar',
        label:  esDomicilio ? 'Confirmar llegada' : 'Confirmar recepción',
        icono:  esDomicilio ? 'bi-bicycle'        : 'bi-bag-check',
        clase:  'btn-luxury',
      });
    }

    // Editar fecha/hora/dirección
    const puedeEditar = (v.estado === 'pendiente' || v.estado === 'en_proceso')
      && !v.cliente_confirmo_entrega;
    if (puedeEditar) {
      acc.push({ accion: 'editar', label: 'Editar entrega', icono: 'bi-pencil', clase: 'btn-luxury-outline' });
    }

    // Cancelar
    const puedeCanc = v.estado === 'pendiente' ||
      (v.estado === 'en_proceso' && v.aprobacion_cliente !== 'aprobado');
    if (puedeCanc) {
      acc.push({ accion: 'cancelar', label: 'Cancelar pedido', icono: 'bi-x-circle', clase: 'btn-danger-luxury' });
    }

    return acc;
  },

  async _cancelar(pedido) {
    const ok = window.confirm(
      `¿Cancelar el pedido #${pedido.id}?\nEsta acción no se puede deshacer.`
    );
    if (!ok) return;
    UI.toggleLoader(true);
    try {
      await updateVentaCliente(pedido.id, { estado: 'cancelado' });
      await notificarCambioPedidoCliente(pedido, 'cancelado_cliente', Auth.perfil);
      UI.mostrarToast(`Pedido #${pedido.id} cancelado`, 'info');
      await this.cargar();
    } catch (err) {
      UI.mostrarToast('Error: ' + err.message, 'error');
    } finally {
      UI.toggleLoader(false);
    }
  },

  async _aprobar(pedido) {
    const cargoSimb = pedido.cargo_moneda_simbolo ?? '$';
    const cargoNombre = pedido.cargo_moneda_nombre ? ` ${pedido.cargo_moneda_nombre}` : '';
    const cargos = Number(pedido.cargo_domicilio || 0) + Number(pedido.cargo_transferencia || 0);
    const ok = window.confirm(
      `¿Aprobar los cargos adicionales (${cargoSimb}${cargos.toFixed(2)}${cargoNombre})?\nTotal final: $${Number(pedido.total).toFixed(2)}`
    );
    if (!ok) return;
    UI.toggleLoader(true);
    try {
      await updateVentaCliente(pedido.id, { aprobacion_cliente: 'aprobado' });
      await notificarCambioPedidoCliente(pedido, 'aprobado_cliente', Auth.perfil);
      UI.mostrarToast('Cargos aprobados', 'success');
      await this.cargar();
    } catch (err) {
      UI.mostrarToast('Error: ' + err.message, 'error');
    } finally {
      UI.toggleLoader(false);
    }
  },

  async _confirmarEntrega(pedido) {
    const esDomicilio = pedido.tipo_entrega === 'domicilio';
    const accion = esDomicilio ? 'la llegada del domicilio' : 'el retiro en tienda';
    const ok = window.confirm(`¿Confirmar ${accion} del pedido #${pedido.id}?`);
    if (!ok) return;
    UI.toggleLoader(true);
    try {
      await updateVentaCliente(pedido.id, { cliente_confirmo_entrega: true });
      await notificarCambioPedidoCliente(pedido, 'confirmado_entrega', Auth.perfil);
      UI.mostrarToast(
        esDomicilio ? '¡Llegada confirmada! Gracias por tu compra.' : '¡Recepción confirmada! Gracias por tu compra.',
        'success'
      );
      await this.cargar();
    } catch (err) {
      UI.mostrarToast('Error: ' + err.message, 'error');
    } finally {
      UI.toggleLoader(false);
    }
  },

  _editar(pedido) {
    document.getElementById('edit-pedido-id').value         = pedido.id;
    document.getElementById('edit-pedido-fecha').value      = pedido.fecha_entrega ?? '';
    document.getElementById('edit-pedido-hora').value       = pedido.hora_entrega ?? '';
    document.getElementById('edit-pedido-dir').value        = pedido.direccion_entrega ?? '';

    const hoy = new Date().toISOString().split('T')[0];
    const fechaInput = document.getElementById('edit-pedido-fecha');
    if (fechaInput) fechaInput.min = hoy;

    const dirRow = document.getElementById('edit-pedido-dir-row');
    if (dirRow) dirRow.classList.toggle('d-none', pedido.tipo_entrega !== 'domicilio');

    const titulo = document.getElementById('edit-pedido-titulo');
    if (titulo) titulo.textContent = `Editar pedido #${pedido.id}`;

    if (!this._modalEditar)
      this._modalEditar = new bootstrap.Modal(document.getElementById('modal-editar-pedido'));
    this._modalEditar.show();
  },

  async _guardarEdicion() {
    const id              = document.getElementById('edit-pedido-id').value;
    const fecha_entrega   = document.getElementById('edit-pedido-fecha').value  || null;
    const hora_entrega    = document.getElementById('edit-pedido-hora').value   || null;
    const direccion_entrega = document.getElementById('edit-pedido-dir').value.trim() || null;

    if (!fecha_entrega) return UI.mostrarToast('La fecha de entrega es obligatoria', 'error');

    const spinner = document.getElementById('btn-guardar-edit-pedido-spinner');
    const label   = document.getElementById('btn-guardar-edit-pedido-label');
    if (spinner) spinner.classList.remove('d-none');
    if (label)   label.textContent = 'Guardando...';

    UI.toggleLoader(true);
    try {
      await updateVentaCliente(Number(id), { fecha_entrega, hora_entrega, direccion_entrega });
      UI.mostrarToast('Pedido actualizado', 'success');
      this._modalEditar?.hide();
      await this.cargar();
    } catch (err) {
      UI.mostrarToast('Error: ' + err.message, 'error');
    } finally {
      UI.toggleLoader(false);
      if (spinner) spinner.classList.add('d-none');
      if (label)   label.textContent = 'Guardar';
    }
  },

  contarAccionesPendientes(lista = this._lista) {
    return lista.filter(v =>
      v.aprobacion_cliente === 'pendiente' ||
      (v.estado === 'completado' && !v.cliente_confirmo_entrega) ||
      (v.tipo_entrega === 'domicilio' && (v.estado === 'en_proceso' || v.estado === 'pendiente') && !v.cliente_confirmo_entrega)
    ).length;
  },
};
