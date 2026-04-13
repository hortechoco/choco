// auth.js — login y registro por teléfono + PIN
// Usa Supabase Auth con email sintético: {tel}@horte.internal
// Contraseña = PIN + sufijo fijo (Supabase exige mínimo 6 chars)
// Depende de: supabase.js

const Auth = {
  _perfil: null,

  get perfil() { return this._perfil; },
  get rol()    { return this._perfil?.rol ?? null; },
  get esAdmin(){ return this.rol === 'admin'; },

  _emailDeTel: tel => `${tel.replace(/\D/g,'')}@horte.internal`,
  _passDePin:  pin => `${pin}@@horte`,  // PIN 4 dígitos → 10 chars válidos

  async iniciar() {
    const { data: { session } } = await db.auth.getSession();
    if (session) {
      await this._cargarPerfil(session.user.id);
      return true;
    }
    return false;
  },

  async signIn(tel, pin) {
    if (!tel || pin?.length !== 4) throw new Error('Ingresa tu teléfono y PIN de 4 dígitos');
    const { data, error } = await db.auth.signInWithPassword({
      email:    this._emailDeTel(tel),
      password: this._passDePin(pin),
    });
    if (error) throw new Error('Teléfono o PIN incorrecto');
    await this._cargarPerfil(data.user.id);
    return data;
  },

  async register({ ci, nombre, tel, direccion, pin }) {
    if (!ci || !nombre || !tel || !direccion || pin?.length !== 4)
      throw new Error('Completa todos los campos y usa un PIN de exactamente 4 dígitos');

    const { data, error } = await db.auth.signUp({
      email:    this._emailDeTel(tel),
      password: this._passDePin(pin),
    });
    if (error) throw new Error(error.message);

    const userId = data.user?.id;
    if (!userId) throw new Error('No se pudo crear el usuario');

    const { error: errPerfil } = await db.from('perfiles').upsert({
      id:              userId,
      email:           this._emailDeTel(tel),
      nombre_completo: nombre,
      carnet:          ci,
      telefono:        tel,
      direccion:       direccion,
      rol:             'vendedor',
    });
    if (errPerfil) throw new Error('Perfil no guardado: ' + errPerfil.message);

    await this._cargarPerfil(userId);
    return data;
  },

  async signOut() {
    await db.auth.signOut();
    this._perfil = null;
  },

  async _cargarPerfil(userId) {
    this._perfil = await fetchPerfil(userId);
  },

  aplicarUI() {
    const badge = document.getElementById('nav-user-badge');
    if (badge) {
      const nombre = this._perfil?.nombre_completo ?? this._perfil?.telefono ?? 'Usuario';
      badge.textContent = `${nombre} · ${this.rol}`;
    }
    document.querySelectorAll('.admin-only').forEach(el => {
      el.classList.toggle('d-none', !this.esAdmin);
    });
  },
};
