// mispedidos.js — seguimiento y acciones sobre pedidos propios del cliente
// Depende de: supabase.js, ui.js, auth.js, notificaciones.js

const MisPedidos = {
  _lista: [],

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

    // Banner de aprobación
    let banner = '';
    if (v.aprobacion_cliente === 'pendiente') {
      const cargos = Number(v.cargo_domicilio || 0) + Number(v.cargo_transferencia || 0);
      banner = `
        <div class="aprobacion-banner">
          <i class="bi bi-exclamation-circle me-2"></i>
          El vendedor añadió cargos adicionales de <strong>$${cargos.toFixed(2)}</strong>.
          Total actualizado: <strong>$${Number(v.total).toFixed(2)}</strong>
        </div>`;
    }

    // Badges extra
    let extraBadges = '';
    if (v.aprobacion_cliente === 'pendiente') {
      extraBadges += `<span class="badge-aprobacion"><i class="bi bi-clock me-1"></i>Aprobación requerida</span>`;
    }
    if (v.cliente_confirmo_entrega) {
      extraBadges += `<span class="badge-confirmado"><i class="bi bi-check2 me-1"></i>Entrega confirmada</span>`;
    }

    // Desglose de cargos
    let desglose = '';
    const subtotal = items.reduce((s, i) => s + Number(i.subtotal), 0);
    const cargoD   = Number(v.cargo_domicilio || 0);
    const cargoT   = Number(v.cargo_transferencia || 0);
    if (cargoD > 0 || cargoT > 0) {
      desglose = `
        <div class="pedido-desglose mt-2">
          <span>Subtotal: $${subtotal.toFixed(2)}</span>
          ${cargoD > 0 ? `<span>Domicilio: $${cargoD.toFixed(2)}</span>` : ''}
          ${cargoT > 0 ? `<span>Transferencia: $${cargoT.toFixed(2)}</span>` : ''}
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

    // Confirmar recepción
    if (v.estado === 'completado' && !v.cliente_confirmo_entrega) {
      acc.push({ accion: 'confirmar', label: 'Confirmar recepción', icono: 'bi-bag-check', clase: 'btn-luxury' });
    }

    // Cancelar (sólo si pendiente, o en_proceso y aún no aprobó los cargos)
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
    const cargos = Number(pedido.cargo_domicilio || 0) + Number(pedido.cargo_transferencia || 0);
    const ok = window.confirm(
      `¿Aprobar los cargos adicionales ($${cargos.toFixed(2)})?\nTotal final confirmado: $${Number(pedido.total).toFixed(2)}`
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
    const tipo = pedido.tipo_entrega === 'domicilio' ? 'la llegada a domicilio' : 'el retiro en tienda';
    const ok = window.confirm(`¿Confirmar ${tipo} del pedido #${pedido.id}?`);
    if (!ok) return;
    UI.toggleLoader(true);
    try {
      await updateVentaCliente(pedido.id, { cliente_confirmo_entrega: true });
      await notificarCambioPedidoCliente(pedido, 'confirmado_entrega', Auth.perfil);
      UI.mostrarToast('¡Recepción confirmada! Gracias por tu compra.', 'success');
      await this.cargar();
    } catch (err) {
      UI.mostrarToast('Error: ' + err.message, 'error');
    } finally {
      UI.toggleLoader(false);
    }
  },

  // Devuelve cuántos pedidos requieren acción del cliente (para badge en nav)
  contarAccionesPendientes(lista = this._lista) {
    return lista.filter(v =>
      v.aprobacion_cliente === 'pendiente' ||
      (v.estado === 'completado' && !v.cliente_confirmo_entrega)
    ).length;
  },
};
