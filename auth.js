// auth.js — login y registro directo contra tabla perfiles
// Sin Supabase Auth. Sesión en cookie. Sin localStorage.
// Depende de: supabase.js

const Auth = {
  _perfil: null,

  get perfil() { return this._perfil; },
  get rol()    { return this._perfil?.rol ?? null; },
  get esAdmin(){ return this.rol === 'admin'; },

  _setCookie(id) {
    document.cookie = `horte_uid=${id}; path=/; max-age=${7 * 86400}; SameSite=Strict`;
  },
  _getCookie() {
    return document.cookie.split(';').map(c => c.trim())
      .find(c => c.startsWith('horte_uid='))?.split('=')[1] ?? null;
  },
  _clearCookie() {
    document.cookie = 'horte_uid=; path=/; max-age=0; SameSite=Strict';
  },

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
      rol: 'vendedor',
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
};
