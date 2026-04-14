// usuarios.js — gestión completa de perfiles (admin)
// Depende de: supabase.js, ui.js

const Usuarios = {
  _lista: [],
  _modal: null,

  async cargar(filtro = '') {
    const tbody = document.getElementById('usuarios-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="empty-state text-center py-4">Cargando...</td></tr>`;
    try {
      this._lista = await fetchPerfiles(filtro);
      this._renderTabla();
    } catch (err) {
      UI.mostrarToast('Error cargando usuarios: ' + err.message, 'error');
    }
  },

  _renderTabla() {
    const tbody = document.getElementById('usuarios-tbody');
    if (!tbody) return;

    if (!this._lista.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state text-center py-4">No hay usuarios registrados</td></tr>`;
      return;
    }

    const _rolBadge = rol => {
      const map = {
        admin:    'background:rgba(212,166,85,0.15);color:var(--gold)',
        vendedor: 'background:rgba(90,130,220,0.15);color:#90b4f0',
        cliente:  'background:rgba(45,140,100,0.15);color:#5ec990',
      };
      return `<span class="badge-estado" style="${map[rol] ?? ''}">${rol}</span>`;
    };

    tbody.innerHTML = this._lista.map(u => `
      <tr>
        <td style="font-family:'Lora',serif;color:var(--bronze)">#${u.id}</td>
        <td style="font-weight:400">${u.nombre_completo}</td>
        <td style="font-size:.82rem;color:var(--text-body)">${u.telefono ?? '—'}</td>
        <td style="font-size:.82rem;color:var(--text-body)">${u.carnet ?? '—'}</td>
        <td>${_rolBadge(u.rol)}</td>
        <td style="font-size:.78rem;color:var(--text-dim)">${new Date(u.created_at).toLocaleDateString('es')}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-luxury-outline me-1" data-action="editar"   data-id="${u.id}"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-luxury-outline"       data-action="eliminar" data-id="${u.id}"
                  style="border-color:rgba(224,112,112,.25);color:#e07070"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`).join('');

    tbody.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const { action, id } = btn.dataset;
        const u = this._lista.find(x => String(x.id) === String(id));
        if (action === 'editar')   this.abrirModal(u);
        if (action === 'eliminar') this._eliminar(u);
      });
    });
  },

  abrirModal(usuario = null) {
    document.getElementById('modal-usuario-titulo').textContent = usuario ? 'Editar Usuario' : 'Nuevo Usuario';
    document.getElementById('usuario-id').value         = usuario?.id ?? '';
    document.getElementById('usuario-nombre').value     = usuario?.nombre_completo ?? '';
    document.getElementById('usuario-tel').value        = usuario?.telefono ?? '';
    document.getElementById('usuario-ci').value         = usuario?.carnet ?? '';
    document.getElementById('usuario-direccion').value  = usuario?.direccion ?? '';
    document.getElementById('usuario-rol').value        = usuario?.rol ?? 'cliente';
    document.getElementById('usuario-pin').value        = '';   // nunca pre-rellenar el PIN
    document.getElementById('usuario-notas').value      = usuario?.notas ?? '';

    const pinHint = document.getElementById('usuario-pin-hint');
    if (pinHint) pinHint.textContent = usuario
      ? 'Dejar vacío para no modificar el PIN actual'
      : 'Obligatorio al crear';

    if (!this._modal) this._modal = new bootstrap.Modal(document.getElementById('modal-usuario'));
    this._modal.show();
  },

  async guardar() {
    const id     = document.getElementById('usuario-id').value;
    const nombre = document.getElementById('usuario-nombre').value.trim();
    const tel    = document.getElementById('usuario-tel').value.trim();
    const pin    = document.getElementById('usuario-pin').value.trim();
    const rol    = document.getElementById('usuario-rol').value;

    if (!nombre) return UI.mostrarToast('El nombre es obligatorio', 'error');
    if (!tel)    return UI.mostrarToast('El teléfono es obligatorio', 'error');
    if (pin && pin.length !== 4) return UI.mostrarToast('El PIN debe tener exactamente 4 dígitos', 'error');
    if (!id && !pin) return UI.mostrarToast('El PIN es obligatorio para crear un usuario', 'error');

    const payload = {
      nombre_completo: nombre,
      telefono:  tel,
      carnet:    document.getElementById('usuario-ci').value.trim()        || null,
      direccion: document.getElementById('usuario-direccion').value.trim() || null,
      notas:     document.getElementById('usuario-notas').value.trim()     || null,
      rol,
      ...(pin ? { pin } : {}),
    };

    const spinner = document.getElementById('btn-guardar-usuario-spinner');
    const label   = document.getElementById('btn-guardar-usuario-label');
    spinner.classList.remove('d-none');
    label.textContent = 'Guardando...';

    try {
      if (id) {
        await updatePerfil(Number(id), payload);
        UI.mostrarToast('Usuario actualizado', 'success');
      } else {
        await insertPerfil(payload);
        UI.mostrarToast('Usuario creado', 'success');
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

  async _eliminar(usuario) {
    const ok = await UI.confirmarEliminacion(usuario.nombre_completo);
    if (!ok) return;
    try {
      await deletePerfil(usuario.id);
      UI.mostrarToast('Usuario eliminado', 'success');
      await this.cargar();
    } catch (err) {
      UI.mostrarToast('Error: ' + err.message, 'error');
    }
  },

  get lista() { return this._lista; },
};
