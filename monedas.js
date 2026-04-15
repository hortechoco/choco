// monedas.js — gestión de monedas (admin)
// Depende de: supabase.js, ui.js

const Monedas = {
  _lista: [],
  _modal: null,

  async cargar() {
    const tbody = document.getElementById('monedas-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="empty-state text-center py-4">Cargando...</td></tr>`;
    try {
      this._lista = await fetchMonedas();
      this._renderTabla();
    } catch (err) {
      UI.mostrarToast('Error cargando monedas: ' + err.message, 'error');
    }
  },

  _renderTabla() {
    const tbody = document.getElementById('monedas-tbody');
    if (!tbody) return;

    if (!this._lista.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state text-center py-4">No hay monedas configuradas</td></tr>`;
      return;
    }

    tbody.innerHTML = this._lista.map(m => `
      <tr>
        <td><span style="font-family:'Lora',serif;font-size:1.1rem;color:var(--gold)">${m.simbolo}</span></td>
        <td style="font-weight:400">${m.nombre}</td>
        <td style="font-size:.82rem;color:var(--text-body)">${Number(m.tasa_cambio).toFixed(4)}</td>
        <td>
          ${m.es_base
            ? `<span class="badge-estado" style="background:rgba(212,166,85,0.15);color:var(--gold)">Base</span>`
            : ''}
        </td>
        <td>
          <span class="badge-estado ${m.activa ? 'badge-estado-completado' : 'badge-estado-cancelado'}">
            ${m.activa ? 'Activa' : 'Inactiva'}
          </span>
        </td>
        <td class="text-end">
          <button class="btn btn-sm btn-luxury-outline me-1" data-action="editar" data-id="${m.id}">
            <i class="bi bi-pencil"></i>
          </button>
          ${m.es_base ? '' : `
          <button class="btn btn-sm btn-luxury-outline" data-action="eliminar" data-id="${m.id}"
                  style="border-color:rgba(224,112,112,.25);color:#e07070">
            <i class="bi bi-trash"></i>
          </button>`}
        </td>
      </tr>`).join('');

    tbody.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const { action, id } = btn.dataset;
        const m = this._lista.find(x => String(x.id) === String(id));
        if (action === 'editar')   this.abrirModal(m);
        if (action === 'eliminar') this._eliminar(m);
      });
    });
  },

  abrirModal(moneda = null) {
    document.getElementById('modal-moneda-titulo').textContent = moneda ? 'Editar Moneda' : 'Nueva Moneda';
    document.getElementById('moneda-id').value          = moneda?.id ?? '';
    document.getElementById('moneda-nombre').value      = moneda?.nombre ?? '';
    document.getElementById('moneda-simbolo').value     = moneda?.simbolo ?? '';
    document.getElementById('moneda-tasa').value        = moneda?.tasa_cambio ?? '1';
    document.getElementById('moneda-es-base').checked  = moneda?.es_base ?? false;
    document.getElementById('moneda-activa').checked    = moneda?.activa ?? true;

    if (!this._modal) this._modal = new bootstrap.Modal(document.getElementById('modal-moneda'));
    this._modal.show();
  },

  async guardar() {
    const id      = document.getElementById('moneda-id').value;
    const nombre  = document.getElementById('moneda-nombre').value.trim();
    const simbolo = document.getElementById('moneda-simbolo').value.trim();
    const tasa    = parseFloat(document.getElementById('moneda-tasa').value);

    if (!nombre)              return UI.mostrarToast('El nombre es obligatorio', 'error');
    if (!simbolo)             return UI.mostrarToast('El símbolo es obligatorio', 'error');
    if (isNaN(tasa) || tasa <= 0) return UI.mostrarToast('La tasa debe ser mayor a 0', 'error');

    const payload = {
      nombre,
      simbolo,
      tasa_cambio: tasa,
      es_base:  document.getElementById('moneda-es-base').checked,
      activa:   document.getElementById('moneda-activa').checked,
    };

    const spinner = document.getElementById('btn-guardar-moneda-spinner');
    const label   = document.getElementById('btn-guardar-moneda-label');
    spinner.classList.remove('d-none');
    label.textContent = 'Guardando...';

    try {
      if (id) {
        await updateMoneda(id, payload);
        UI.mostrarToast('Moneda actualizada', 'success');
      } else {
        await insertMoneda(payload);
        UI.mostrarToast('Moneda creada', 'success');
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

  async _eliminar(moneda) {
    const ok = await UI.confirmarEliminacion(moneda.nombre);
    if (!ok) return;
    try {
      await deleteMoneda(moneda.id);
      UI.mostrarToast('Moneda eliminada', 'success');
      await this.cargar();
    } catch (err) {
      UI.mostrarToast('Error: ' + err.message, 'error');
    }
  },

  get lista() { return this._lista; },
};
