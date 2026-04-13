// clientes.js — gestión del directorio de clientes
// Depende de: supabase.js, ui.js

const Clientes = {
  _lista: [],
  _modal: null,
  _modalHistorial: null,

  async cargar(filtro = '') {
    try {
      this._lista = await fetchClientes(filtro);
      this._renderTabla();
    } catch (err) {
      UI.mostrarToast('Error cargando clientes: ' + err.message, 'error');
    }
  },

  _renderTabla() {
    const tbody = document.getElementById('clientes-tbody');
    if (!tbody) return;

    if (!this._lista.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state text-center py-4">No hay clientes registrados</td></tr>`;
      return;
    }

    tbody.innerHTML = this._lista.map(c => `
      <tr>
        <td style="font-family:'Lora',serif;color:var(--bronze)">#${c.id}</td>
        <td style="font-weight:400">${c.nombre_completo}</td>
        <td style="color:var(--text-body);font-size:.82rem">${c.telefono ?? '—'}</td>
        <td style="color:var(--text-body);font-size:.82rem">${c.ci ?? '—'}</td>
        <td style="color:var(--text-dim);font-size:.78rem;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.direccion ?? '—'}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-luxury-outline me-1" data-action="historial" data-id="${c.id}" title="Ver compras">
            <i class="bi bi-clock-history"></i>
          </button>
          <button class="btn btn-sm btn-luxury-outline me-1" data-action="editar" data-id="${c.id}">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-luxury-outline" data-action="eliminar" data-id="${c.id}" style="border-color:rgba(224,112,112,.25);color:#e07070">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>`).join('');

    tbody.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const { action, id } = btn.dataset;
        const cliente = this._lista.find(c => String(c.id) === String(id));
        if (action === 'editar')    this.abrirModal(cliente);
        if (action === 'eliminar')  this._eliminar(cliente);
        if (action === 'historial') this._mostrarHistorial(cliente);
      });
    });
  },

  abrirModal(cliente = null) {
    document.getElementById('modal-cliente-titulo').textContent = cliente ? 'Editar Cliente' : 'Nuevo Cliente';
    document.getElementById('cliente-id').value          = cliente?.id ?? '';
    document.getElementById('cliente-nombre').value      = cliente?.nombre_completo ?? '';
    document.getElementById('cliente-tel').value         = cliente?.telefono ?? '';
    document.getElementById('cliente-ci').value          = cliente?.ci ?? '';
    document.getElementById('cliente-direccion').value   = cliente?.direccion ?? '';
    document.getElementById('cliente-notas').value       = cliente?.notas ?? '';

    if (!this._modal) this._modal = new bootstrap.Modal(document.getElementById('modal-cliente'));
    this._modal.show();
  },

  async guardar() {
    const id     = document.getElementById('cliente-id').value;
    const nombre = document.getElementById('cliente-nombre').value.trim();
    if (!nombre) return UI.mostrarToast('El nombre es obligatorio', 'error');

    const payload = {
      nombre_completo: nombre,
      telefono:  document.getElementById('cliente-tel').value.trim()      || null,
      ci:        document.getElementById('cliente-ci').value.trim()        || null,
      direccion: document.getElementById('cliente-direccion').value.trim() || null,
      notas:     document.getElementById('cliente-notas').value.trim()     || null,
    };

    const spinner = document.getElementById('btn-guardar-cliente-spinner');
    const label   = document.getElementById('btn-guardar-cliente-label');
    spinner.classList.remove('d-none');
    label.textContent = 'Guardando...';

    try {
      if (id) {
        await updateCliente(id, payload);
        UI.mostrarToast('Cliente actualizado', 'success');
      } else {
        await insertCliente(payload);
        UI.mostrarToast('Cliente registrado', 'success');
      }
      this._modal?.hide();
      await this.cargar();
    } catch (err) {
      UI.mostrarToast('Error: ' + err.message, 'error');
    } finally {
      spinner.classList.add('d-none');
      label.textContent = 'Guardar';
    }
  },

  async _eliminar(cliente) {
    const ok = await UI.confirmarEliminacion(cliente.nombre_completo);
    if (!ok) return;
    try {
      await deleteCliente(cliente.id);
      UI.mostrarToast('Cliente eliminado', 'success');
      await this.cargar();
    } catch (err) {
      UI.mostrarToast('Error: ' + err.message, 'error');
    }
  },

  async _mostrarHistorial(cliente) {
    const body   = document.getElementById('cliente-historial-body');
    const titulo = document.getElementById('modal-cliente-historial-titulo');
    titulo.textContent = `Compras — ${cliente.nombre_completo}`;
    body.innerHTML = `<div class="empty-state text-center py-3">Cargando...</div>`;

    if (!this._modalHistorial)
      this._modalHistorial = new bootstrap.Modal(document.getElementById('modal-cliente-historial'));
    this._modalHistorial.show();

    try {
      const ventas = await fetchVentasDeCliente(cliente.id);

      if (!ventas.length) {
        body.innerHTML = `<div class="empty-state text-center py-3">Sin compras registradas</div>`;
        return;
      }

      const totalHistorico = ventas.reduce((s, v) => s + Number(v.total), 0);

      body.innerHTML = `
        <div class="d-flex justify-content-between mb-3" style="font-size:.8rem;color:var(--text-dim)">
          <span>${ventas.length} compra${ventas.length !== 1 ? 's' : ''}</span>
          <span class="text-gold">Total histórico: <strong>$${totalHistorico.toFixed(2)}</strong></span>
        </div>
        <table class="detalle-items-table w-100">
          <thead>
            <tr>
              <th>#</th>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Pago</th>
              <th class="text-end">Total</th>
            </tr>
          </thead>
          <tbody>
            ${ventas.map(v => `
              <tr>
                <td style="color:var(--bronze);font-family:'Lora',serif">#${v.id}</td>
                <td style="font-size:.78rem">${new Date(v.fecha).toLocaleString('es',{dateStyle:'short',timeStyle:'short'})}</td>
                <td><span class="badge-tipo ${v.tipo_entrega === 'domicilio' ? 'badge-domicilio' : 'badge-recogida'}">${v.tipo_entrega}</span></td>
                <td><span class="badge-pago">${v.metodo_pago}</span></td>
                <td class="text-end text-gold">$${Number(v.total).toFixed(2)}</td>
              </tr>`).join('')}
          </tbody>
        </table>`;
    } catch (err) {
      body.innerHTML = `<div class="empty-state text-center py-3">Error: ${err.message}</div>`;
    }
  },

  get lista() { return this._lista; },
};
