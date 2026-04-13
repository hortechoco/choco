// app.js — punto de entrada: tema (cookie), auth y navegación
// Depende de: auth.js, ui.js, productos.js, ventas.js, historial.js, clientes.js

(async function init() {
  // ── Tema (cookie, sin localStorage) ───────────────
  function _leerTemaCookie() {
    return document.cookie.split(';').map(c => c.trim())
      .find(c => c.startsWith('horte-tema='))?.split('=')[1] ?? 'dark';
  }
  function _guardarTemaCookie(tema) {
    document.cookie = `horte-tema=${tema}; path=/; max-age=${365 * 86400}; SameSite=Strict`;
  }

  const temaGuardado = _leerTemaCookie();
  document.documentElement.setAttribute('data-bs-theme', temaGuardado);
  _sincronizarIconoTema(temaGuardado);

  function _toggleTema() {
    const actual = document.documentElement.getAttribute('data-bs-theme');
    const nuevo  = actual === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-bs-theme', nuevo);
    _guardarTemaCookie(nuevo);
    _sincronizarIconoTema(nuevo);
  }

  function _sincronizarIconoTema(tema) {
    const icono = tema === 'dark' ? 'bi-sun' : 'bi-moon';
    document.querySelectorAll('.btn-toggle-tema i').forEach(el => {
      el.className = `bi ${icono}`;
    });
  }

  document.querySelectorAll('.btn-toggle-tema').forEach(btn => {
    btn.addEventListener('click', _toggleTema);
  });

  // ── Login ──────────────────────────────────────────
  document.getElementById('btn-login').addEventListener('click', async () => {
    const tel     = document.getElementById('login-tel').value.trim();
    const pin     = document.getElementById('login-pin').value;
    const errEl   = document.getElementById('auth-error');
    const spinner = document.getElementById('login-spinner');
    const label   = document.getElementById('login-label');

    errEl.classList.add('d-none');
    spinner.classList.remove('d-none');
    label.textContent = 'Ingresando...';

    try {
      await Auth.signIn(tel, pin);
      Auth.redirigirSegunRol();               // ← Redirige a tienda o panel según rol
      if (!Auth.esCliente) await _iniciarApp(); // Solo inicializa panel si es vendedor/admin
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('d-none');
    } finally {
      spinner.classList.add('d-none');
      label.textContent = 'Ingresar';
    }
  });

  ['login-tel', 'login-pin'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btn-login').click();
    });
  });

  // ── Register ───────────────────────────────────────
  document.getElementById('btn-register').addEventListener('click', async () => {
    const errEl   = document.getElementById('auth-error');
    const spinner = document.getElementById('register-spinner');
    const label   = document.getElementById('register-label');

    errEl.classList.add('d-none');
    spinner.classList.remove('d-none');
    label.textContent = 'Creando cuenta...';

    try {
      await Auth.register({
        ci:        document.getElementById('reg-ci').value.trim(),
        nombre:    document.getElementById('reg-nombre').value.trim(),
        tel:       document.getElementById('reg-tel').value.trim(),
        direccion: document.getElementById('reg-direccion').value.trim(),
        pin:       document.getElementById('reg-pin').value,
      });
      Auth.redirigirSegunRol();               // ← Redirige a tienda (el rol por defecto es 'cliente')
      // No se llama a _iniciarApp() porque el nuevo usuario es cliente
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('d-none');
    } finally {
      spinner.classList.add('d-none');
      label.textContent = 'Crear cuenta';
    }
  });

  ['reg-ci', 'reg-nombre', 'reg-tel', 'reg-direccion', 'reg-pin'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btn-register').click();
    });
  });

  // ── Logout (Panel) ─────────────────────────────────
  document.getElementById('btn-logout').addEventListener('click', () => {
    Auth.signOut();
    document.getElementById('app-shell').classList.add('d-none');
    document.getElementById('login-screen').classList.remove('d-none');
  });

  // ── Logout (Storefront) ────────────────────────────
  document.getElementById('btn-storefront-logout')?.addEventListener('click', () => {
    Auth.signOut();
    document.getElementById('storefront-view').classList.add('d-none');
    document.getElementById('login-screen').classList.remove('d-none');
  });

  // ── Modales (Panel) ────────────────────────────────
  document.getElementById('btn-guardar-producto').addEventListener('click', () => Productos.guardar());
  document.getElementById('btn-nuevo-producto').addEventListener('click',   () => Productos.abrirModal());
  document.getElementById('btn-guardar-cliente').addEventListener('click',  () => Clientes.guardar());
  document.getElementById('btn-nuevo-cliente').addEventListener('click',    () => Clientes.abrirModal());

  document.getElementById('buscar-cliente')?.addEventListener('input', e => {
    Clientes.cargar(e.target.value);
  });

  // ── Sesión existente ───────────────────────────────
  const sesionActiva = await Auth.iniciar();
  if (sesionActiva) {
    Auth.redirigirSegunRol();
    if (!Auth.esCliente) await _iniciarApp();
  }
})();

// ─────────────────────────────────────────────────────
// FUNCIONES AUXILIARES (fuera del IIFE)
// ─────────────────────────────────────────────────────

async function _iniciarApp() {
  document.getElementById('login-screen').classList.add('d-none');
  document.getElementById('app-shell').classList.remove('d-none');

  Auth.aplicarUI();
  await Productos.cargar();

  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      _navegarA(item.dataset.module);
    });
  });

  Ventas.iniciar();
  Historial.iniciarFiltros();
  _navegarA('dashboard');
}

async function _navegarA(modulo) {
  document.querySelectorAll('.view-section').forEach(v => v.classList.add('d-none'));
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(i => {
    i.classList.toggle('active', i.dataset.module === modulo);
  });

  const nombres = {
    dashboard: 'Dashboard', ventas: 'Nueva Venta',
    historial: 'Historial', productos: 'Productos', clientes: 'Clientes',
  };
  document.getElementById('nav-current-module').textContent = nombres[modulo] ?? modulo;

  const seccion = document.getElementById(`view-${modulo}`);
  if (seccion) seccion.classList.remove('d-none');

  if (modulo === 'dashboard')                 await _cargarDashboard();
  if (modulo === 'historial')                 await Historial.cargar(
    document.getElementById('filtro-desde').value,
    document.getElementById('filtro-hasta').value,
  );
  if (modulo === 'productos' && Auth.esAdmin) await Productos.cargar();
  if (modulo === 'clientes')                  await Clientes.cargar();
}

async function _cargarDashboard() {
  try {
    const [ventasHoy, todosProductos] = await Promise.all([fetchVentasHoy(), fetchProductos()]);

    const totalHoy   = ventasHoy.reduce((s, v) => s + Number(v.total), 0);
    const domicilios = ventasHoy.filter(v => v.tipo_entrega === 'domicilio').length;

    document.getElementById('stat-ventas-hoy').textContent  = ventasHoy.length;
    document.getElementById('stat-total-hoy').textContent   = `$${totalHoy.toFixed(2)}`;
    document.getElementById('stat-productos').textContent   = todosProductos.length;
    document.getElementById('stat-domicilios').textContent  = domicilios;

    const ulBox = document.getElementById('dashboard-ultimas-ventas');
    if (!ventasHoy.length) {
      ulBox.innerHTML = `<div class="empty-state">Sin ventas registradas hoy</div>`;
    } else {
      ulBox.innerHTML = ventasHoy.slice(0, 5).map(v => `
        <div class="d-flex justify-content-between align-items-center py-2" style="border-bottom:1px solid rgba(181,113,42,.08)">
          <div>
            <span style="font-family:'Lora',serif;color:var(--bronze)">#${v.id}</span>
            <span style="font-size:.78rem;color:var(--text-dim);margin-left:.5rem">${new Date(v.fecha).toLocaleTimeString('es',{timeStyle:'short'})}</span>
          </div>
          <div class="d-flex align-items-center gap-2">
            <span class="badge-tipo ${v.tipo_entrega === 'domicilio' ? 'badge-domicilio' : 'badge-recogida'}">${v.tipo_entrega}</span>
            <span class="text-gold" style="font-weight:500">$${Number(v.total).toFixed(2)}</span>
          </div>
        </div>`).join('');
    }

    document.getElementById('dashboard-top-productos').innerHTML =
      todosProductos.slice(0, 5).map((p, i) => `
        <div class="d-flex justify-content-between align-items-center py-2" style="border-bottom:1px solid rgba(181,113,42,.08)">
          <div class="d-flex align-items-center gap-2">
            <span style="font-size:.65rem;color:var(--bronze);font-family:'Lora',serif;min-width:16px">${i+1}</span>
            <span style="font-size:.85rem">${p.nombre}</span>
          </div>
          <span class="text-gold" style="font-size:.82rem">$${Number(p.precio).toFixed(2)}</span>
        </div>`).join('');

  } catch (err) {
    UI.mostrarToast('Error cargando dashboard: ' + err.message, 'error');
  }
}
