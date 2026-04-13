// historial.js — carga, filtrado y detalle de ventas
// Depende de: supabase.js, ui.js

const Historial = {
  _modal: null,

  async cargar(desde, hasta) {
    const tbody = document.getElementById('historial-tbody');
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state text-center py-4">Cargando...</td></tr>`;

    try {
      const ventas = await fetchVentas({ desde, hasta });

      if (!ventas.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state text-center py-4">Sin ventas en el período</td></tr>`;
        return;
      }

      tbody.innerHTML = ventas.map(v => {
        const fecha = new Date(v.fecha).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' });
        const tipoBadge = v.tipo_entrega === 'domicilio'
          ? `<span class="badge-tipo badge-domicilio">Domicilio</span>`
          : `<span class="badge-tipo badge-recogida">Recogida</span>`;
        return `
          <tr>
            <td style="color:var(--bronze);font-family:'Lora',serif">#${v.id}</td>
            <td style="font-size:.8rem;color:var(--text-body)">${fecha}</td>
            <td>${tipoBadge}</td>
            <td><span class="badge-pago">${v.metodo_pago}</span></td>
            <td class="text-gold" style="font-weight:500">$${Number(v.total).toFixed(2)}</td>
            <td style="font-size:.78rem;color:var(--text-dim);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.notas ?? '—'}</td>
            <td class="text-end">
              <button class="btn btn-sm btn-luxury-outline" data-action="detalle" data-id="${v.id}">
                <i class="bi bi-eye"></i>
              </button>
            </td>
          </tr>`;
      }).join('');

      tbody.querySelectorAll('[data-action="detalle"]').forEach(btn => {
        btn.addEventListener('click', () => this._mostrarDetalle(btn.dataset.id, ventas));
      });

    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state text-center py-4">Error: ${err.message}</td></tr>`;
    }
  },

  async _mostrarDetalle(id, ventas) {
    const venta = ventas.find(v => String(v.id) === String(id));
    const body  = document.getElementById('detalle-venta-body');
    body.innerHTML = `<div class="empty-state text-center py-3">Cargando...</div>`;

    if (!this._modal) this._modal = new bootstrap.Modal(document.getElementById('modal-detalle-venta'));
    this._modal.show();

    try {
      const items = await fetchDetalleVenta(id);
      const fecha = new Date(venta.fecha).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });

      body.innerHTML = `
        <div class="detalle-grid">
          <div class="detalle-field"><label>Fecha</label><span>${fecha}</span></div>
          <div class="detalle-field"><label>Tipo</label><span>${venta.tipo_entrega}</span></div>
          <div class="detalle-field"><label>Pago</label><span>${venta.metodo_pago}</span></div>
          <div class="detalle-field"><label>Total</label><span class="text-gold" style="font-size:1rem;font-family:'Lora',serif">$${Number(venta.total).toFixed(2)}</span></div>
        </div>
        ${venta.notas ? `<div class="mb-3" style="font-size:.82rem;color:var(--text-body);font-style:italic">"${venta.notas}"</div>` : ''}
        <table class="detalle-items-table">
          <thead><tr><th>Producto</th><th class="text-center">Cant.</th><th class="text-end">Unitario</th><th class="text-end">Subtotal</th></tr></thead>
          <tbody>
            ${items.map(i => `
              <tr>
                <td>${i.productos?.nombre ?? `Producto #${i.producto_id}`}</td>
                <td class="text-center">${i.cantidad}</td>
                <td class="text-end" style="color:var(--text-body)">$${Number(i.precio_unitario).toFixed(2)}</td>
                <td class="text-end text-gold">$${Number(i.subtotal).toFixed(2)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
        ${venta.cargo_domicilio > 0 ? `<div class="d-flex justify-content-between mt-2" style="font-size:.82rem;color:var(--text-dim)"><span>Cargo domicilio</span><span>$${Number(venta.cargo_domicilio).toFixed(2)}</span></div>` : ''}`;

    } catch (err) {
      body.innerHTML = `<div class="empty-state text-center py-3">Error: ${err.message}</div>`;
    }
  },

  iniciarFiltros() {
    const hoy = new Date().toISOString().split('T')[0];
    const hace7 = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    document.getElementById('filtro-desde').value = hace7;
    document.getElementById('filtro-hasta').value = hoy;

    document.getElementById('btn-filtrar')?.addEventListener('click', () => {
      const desde = document.getElementById('filtro-desde').value;
      const hasta = document.getElementById('filtro-hasta').value;
      this.cargar(desde, hasta);
    });
  },
};
