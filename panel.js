// panel.js — dashboard y navegación compartidos entre admin.html y vendedor.html
// Depende de: supabase.js, ui.js

async function _cargarDashboard() {
  try {
    const [ventasHoy, todosProductos] = await Promise.all([fetchVentasHoy(), fetchProductos()]);

    const totalHoy   = ventasHoy.reduce((s, v) => s + Number(v.total), 0);
    const domicilios = ventasHoy.filter(v => v.tipo_entrega === 'domicilio').length;
    const pendientes = ventasHoy.filter(v => v.estado === 'pendiente').length;

    document.getElementById('stat-ventas-hoy').textContent  = ventasHoy.length;
    document.getElementById('stat-total-hoy').textContent   = `$${totalHoy.toFixed(2)}`;
    document.getElementById('stat-productos').textContent   = todosProductos.length;
    document.getElementById('stat-domicilios').textContent  = domicilios;
    const sp = document.getElementById('stat-pendientes');
    if (sp) sp.textContent = pendientes;

    const ulBox = document.getElementById('dashboard-ultimas-ventas');
    if (!ventasHoy.length) {
      ulBox.innerHTML = `<div class="empty-state">Sin ventas registradas hoy</div>`;
    } else {
      ulBox.innerHTML = ventasHoy.slice(0, 5).map(v => `
        <div class="d-flex justify-content-between align-items-center py-2" style="border-bottom:1px solid rgba(181,113,42,.08)">
          <div>
            <span style="font-family:'Lora',serif;color:var(--bronze)">#${v.id}</span>
            <span style="font-size:.78rem;color:var(--text-dim);margin-left:.5rem">
              ${new Date(v.fecha).toLocaleTimeString('es', { timeStyle: 'short' })}
            </span>
          </div>
          <div class="d-flex align-items-center gap-2 flex-wrap justify-content-end">
            <span class="badge-estado badge-estado-${v.estado}">${v.estado}</span>
            <span class="badge-tipo ${v.tipo_entrega === 'domicilio' ? 'badge-domicilio' : 'badge-recogida'}">${v.tipo_entrega}</span>
            <span class="text-gold" style="font-weight:500">$${Number(v.total).toFixed(2)}</span>
          </div>
        </div>`).join('');
    }

    document.getElementById('dashboard-top-productos').innerHTML =
      todosProductos.slice(0, 5).map((p, i) => `
        <div class="d-flex justify-content-between align-items-center py-2" style="border-bottom:1px solid rgba(181,113,42,.08)">
          <div class="d-flex align-items-center gap-2">
            <span style="font-size:.65rem;color:var(--bronze);font-family:'Lora',serif;min-width:16px">${i + 1}</span>
            <span style="font-size:.85rem">${p.nombre}</span>
          </div>
          <span class="text-gold" style="font-size:.82rem">$${Number(p.precio).toFixed(2)}</span>
        </div>`).join('');

  } catch (err) {
    UI.mostrarToast('Error cargando dashboard: ' + err.message, 'error');
  }
}

function _navegarA(modulo) {
  document.querySelectorAll('.view-section').forEach(v => v.classList.add('d-none'));
  // Soporte para nav-pill (navbar) y nav-item (sidebar legacy)
  document.querySelectorAll('.nav-pill[data-module], .sidebar-nav .nav-item[data-module]').forEach(i => {
    i.classList.toggle('active', i.dataset.module === modulo);
  });

  const nombres = {
    dashboard: 'Dashboard', ventas: 'Nueva Venta',
    historial: 'Historial', productos: 'Productos',
    clientes: 'Clientes',  usuarios: 'Usuarios',
    monedas: 'Monedas',
  };
  const moduleEl = document.getElementById('nav-current-module');
  if (moduleEl) moduleEl.textContent = nombres[modulo] ?? modulo;

  const seccion = document.getElementById(`view-${modulo}`);
  if (seccion) seccion.classList.remove('d-none');

  if (modulo === 'dashboard') _cargarDashboard();
  if (modulo === 'historial') Historial.cargar(
    document.getElementById('filtro-desde').value,
    document.getElementById('filtro-hasta').value,
  );
  if (modulo === 'clientes')                             Clientes.cargar();
  if (modulo === 'productos' && typeof Productos !== 'undefined') Productos.cargar();
  if (modulo === 'usuarios'  && typeof Usuarios  !== 'undefined') Usuarios.cargar();
  if (modulo === 'monedas'   && typeof Monedas   !== 'undefined') Monedas.cargar();
}
