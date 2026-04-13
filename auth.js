// auth.js — login y registro con roles (cliente por defecto)
// Sin Supabase Auth. Sesión en cookie. Sin localStorage.

const Auth = {
  _perfil: null,

  get perfil() { return this._perfil; },
  get rol()    { return this._perfil?.rol ?? null; },
  get esAdmin(){ return this.rol === 'admin'; },
  get esVendedor(){ return this.rol === 'vendedor' || this.rol === 'admin'; },
  get esCliente(){ return this.rol === 'cliente'; },

  // ... métodos _setCookie, _getCookie, _clearCookie sin cambios ...

  async iniciar() {
    const uid = this._getCookie();
    if (!uid) return false;
    try {
      this._perfil = await fetchPerfilById(Number(uid));
      return !!this._perfil;
    } catch {
      this._clearCookie();
      return false;
    }
  },

  async signIn(tel, pin) {
    if (!tel || pin?.length !== 4)
      throw new Error('Ingresa tu teléfono y PIN de 4 dígitos');
    const perfil = await fetchPerfilByTelPin(tel.replace(/\D/g, ''), pin);
    if (!perfil) throw new Error('Teléfono o PIN incorrecto');
    this._perfil = perfil;
    this._setCookie(perfil.id);
  },

  async register({ ci, nombre, tel, direccion, pin }) {
    if (!ci || !nombre || !tel || !direccion || pin?.length !== 4)
      throw new Error('Completa todos los campos y usa un PIN de exactamente 4 dígitos');

    const perfil = await insertPerfil({
      nombre_completo: nombre,
      carnet:    ci,
      telefono:  tel.replace(/\D/g, ''),
      direccion,
      pin,
      rol: 'cliente',   // ← Todos los nuevos registros son clientes
    });
    this._perfil = perfil;
    this._setCookie(perfil.id);
  },

  signOut() {
    this._clearCookie();
    this._perfil = null;
  },

  aplicarUI() {
    const badge = document.getElementById('nav-user-badge');
    if (badge) {
      const nombre = this._perfil?.nombre_completo ?? 'Usuario';
      badge.textContent = `${nombre} · ${this.rol}`;
    }
    document.querySelectorAll('.admin-only').forEach(el => {
      el.classList.toggle('d-none', !this.esAdmin);
    });
  },

  // NUEVO: Redirige a la vista correspondiente según el rol
  redirigirSegunRol() {
    if (this.esCliente) {
      // Mostrar storefront, ocultar panel
      document.getElementById('storefront-view')?.classList.remove('d-none');
      document.getElementById('app-shell')?.classList.add('d-none');
      document.getElementById('login-screen')?.classList.add('d-none');
      // Inicializar módulo de tienda (se definirá en storefront.js)
      if (typeof Storefront !== 'undefined') Storefront.iniciar();
    } else {
      // Panel de vendedor/admin
      document.getElementById('storefront-view')?.classList.add('d-none');
      document.getElementById('app-shell')?.classList.remove('d-none');
      // La inicialización del panel se hace en _iniciarApp() desde app.js
    }
  },
};
