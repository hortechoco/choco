// ui.js — componentes de UI reutilizables (toasts, loader, confirmaciones)
// Sin dependencias externas (solo Bootstrap JS ya cargado)

const UI = {
  mostrarToast(mensaje, tipo = 'info') {
    const iconos = { success: 'bi-check-circle-fill', error: 'bi-x-circle-fill', info: 'bi-info-circle-fill' };
    const icono  = iconos[tipo] ?? iconos.info;

    const toastEl = document.createElement('div');
    toastEl.className = `toast toast-luxury toast-${tipo} show`;
    toastEl.setAttribute('role', 'alert');
    toastEl.innerHTML = `
      <div class="toast-body">
        <i class="bi ${icono}"></i>
        <span>${mensaje}</span>
      </div>`;

    document.getElementById('toast-container').appendChild(toastEl);

    setTimeout(() => {
      toastEl.classList.remove('show');
      setTimeout(() => toastEl.remove(), 400);
    }, 3500);
  },

  toggleLoader(visible) {
    document.getElementById('global-loader').classList.toggle('d-none', !visible);
  },

  async confirmarEliminacion(nombre) {
    return new Promise(resolve => {
      // Bootstrap no tiene un confirm nativo async, usamos window.confirm con estilos naturales
      const ok = window.confirm(`¿Eliminar "${nombre}"?\nEsta acción no se puede deshacer.`);
      resolve(ok);
    });
  },

  renderizarTablaGenerica(tbodyId, columnas, filas, acciones = []) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    if (!filas || filas.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${columnas.length + (acciones.length ? 1 : 0)}" class="empty-state text-center py-4">Sin registros</td></tr>`;
      return;
    }

    tbody.innerHTML = filas.map(fila => {
      const celdas = columnas.map(col => {
        const val = typeof col.render === 'function' ? col.render(fila) : (fila[col.key] ?? '—');
        return `<td>${val}</td>`;
      }).join('');

      const accionCeldas = acciones.length
        ? `<td class="text-end">${acciones.map(a => `<button class="btn btn-sm btn-luxury-outline me-1 ${a.class ?? ''}" data-id="${fila.id}" data-action="${a.action}">${a.label}</button>`).join('')}</td>`
        : '';

      return `<tr>${celdas}${accionCeldas}</tr>`;
    }).join('');
  },
};
