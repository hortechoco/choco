// productos.js — renderizar tabla de productos, modal CRUD
// Depende de: supabase.js, ui.js

const Productos = {
  _lista: [],
  _modal: null,

  async cargar() {
    try {
      this._lista = await fetchProductos();
      this._renderTabla();
    } catch (err) {
      UI.mostrarToast('Error cargando productos: ' + err.message, 'error');
    }
  },

  _renderTabla() {
    const tbody = document.getElementById('productos-tbody');
    if (!tbody) return;

    if (!this._lista.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state text-center py-4">No hay productos registrados</td></tr>`;
      return;
    }

    tbody.innerHTML = this._lista.map(p => `
      <tr>
        <td>
          <div class="d-flex align-items-center gap-2">
            ${p.imagen_url ? `<img src="${p.imagen_url}" width="36" height="36" style="border-radius:6px;object-fit:cover;opacity:.85">` : '<div style="width:36px;height:36px;border-radius:6px;background:rgba(181,113,42,.12);display:flex;align-items:center;justify-content:center"><i class="bi bi-box-seam" style="font-size:.9rem;color:var(--bronze)"></i></div>'}
            <span style="font-weight:400">${p.nombre}</span>
          </div>
        </td>
        <td style="color:var(--text-body);font-size:.82rem">${p.descripcion ?? '—'}</td>
        <td class="text-gold" style="font-weight:500">$${Number(p.precio).toFixed(2)}</td>
        <td style="color:var(--text-subtle);font-size:.78rem">${new Date(p.created_at).toLocaleDateString('es')}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-luxury-outline me-1" data-action="editar" data-id="${p.id}"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-luxury-outline" data-action="eliminar" data-id="${p.id}" style="border-color:rgba(224,112,112,.25);color:#e07070"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`).join('');

    // Eventos de la tabla
    tbody.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const { action, id } = btn.dataset;
        const prod = this._lista.find(p => String(p.id) === String(id));
        if (action === 'editar')   this.abrirModal(prod);
        if (action === 'eliminar') this._eliminar(prod);
      });
    });
  },

  abrirModal(producto = null) {
    document.getElementById('modal-producto-titulo').textContent = producto ? 'Editar Producto' : 'Nuevo Producto';
    document.getElementById('producto-id').value          = producto?.id ?? '';
    document.getElementById('producto-nombre').value      = producto?.nombre ?? '';
    document.getElementById('producto-descripcion').value = producto?.descripcion ?? '';
    document.getElementById('producto-precio').value      = producto?.precio ?? '';
    document.getElementById('producto-imagen').value      = producto?.imagen_url ?? '';

    if (!this._modal) this._modal = new bootstrap.Modal(document.getElementById('modal-producto'));
    this._modal.show();
  },

  async guardar() {
    const id     = document.getElementById('producto-id').value;
    const nombre = document.getElementById('producto-nombre').value.trim();
    const precio = parseFloat(document.getElementById('producto-precio').value);

    if (!nombre) return UI.mostrarToast('El nombre es obligatorio', 'error');
    if (isNaN(precio) || precio < 0) return UI.mostrarToast('El precio no es válido', 'error');

    const payload = {
      nombre,
      descripcion: document.getElementById('producto-descripcion').value.trim() || null,
      precio,
      imagen_url: document.getElementById('producto-imagen').value.trim() || null,
    };

    const spinner = document.getElementById('btn-guardar-spinner');
    const label   = document.getElementById('btn-guardar-label');
    spinner.classList.remove('d-none');
    label.textContent = 'Guardando...';

    try {
      if (id) {
        await updateProducto(id, payload);
        UI.mostrarToast('Producto actualizado', 'success');
      } else {
        await insertProducto(payload);
        UI.mostrarToast('Producto creado', 'success');
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

  async _eliminar(producto) {
    const ok = await UI.confirmarEliminacion(producto.nombre);
    if (!ok) return;
    try {
      await deleteProducto(producto.id);
      UI.mostrarToast('Producto eliminado', 'success');
      await this.cargar();
    } catch (err) {
      UI.mostrarToast('Error: ' + err.message, 'error');
    }
  },

  get lista() { return this._lista; },
};
