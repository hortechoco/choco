// supabase.js — cliente Supabase + funciones de BD
// Sin Supabase Auth. Sin RLS. Acceso directo.
// Depende de: settings.js

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── PERFILES ───────────────────────────────────────
async function fetchPerfilById(id) {
  const { data, error } = await db.from('perfiles').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

async function fetchPerfilByTelPin(tel, pin) {
  const { data, error } = await db.from('perfiles').select('*')
    .eq('telefono', tel).eq('pin', pin).maybeSingle();
  if (error) throw error;
  return data;
}

async function insertPerfil(payload) {
  const { data, error } = await db.from('perfiles').insert([payload]).select().single();
  if (error) throw error;
  return data;
}

async function updatePerfil(id, payload) {
  const { data, error } = await db.from('perfiles').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

async function deletePerfil(id) {
  const { error } = await db.from('perfiles').delete().eq('id', id);
  if (error) throw error;
}

async function fetchPerfiles(filtro = '') {
  let q = db.from('perfiles').select('*').order('nombre_completo');
  if (filtro) q = q.ilike('nombre_completo', `%${filtro}%`);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

// ── MONEDAS ────────────────────────────────────────
async function fetchMonedas(soloActivas = false) {
  let q = db.from('monedas').select('*').order('es_base', { ascending: false }).order('nombre');
  if (soloActivas) q = q.eq('activa', true);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

async function insertMoneda(payload) {
  const { data, error } = await db.from('monedas').insert([payload]).select().single();
  if (error) throw error;
  return data;
}

async function updateMoneda(id, payload) {
  const { data, error } = await db.from('monedas').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

async function deleteMoneda(id) {
  const { error } = await db.from('monedas').delete().eq('id', id);
  if (error) throw error;
}

// ── PRODUCTOS ──────────────────────────────────────
async function fetchProductos() {
  const { data, error } = await db.from('productos').select('*').order('nombre');
  if (error) throw error;
  return data;
}

async function insertProducto(payload) {
  const { data, error } = await db.from('productos').insert([payload]).select().single();
  if (error) throw error;
  return data;
}

async function updateProducto(id, payload) {
  const { data, error } = await db.from('productos').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

async function deleteProducto(id) {
  const { error } = await db.from('productos').delete().eq('id', id);
  if (error) throw error;
}

// ── VENTAS ─────────────────────────────────────────
async function insertVenta(ventaPayload, detalles) {
  const { data: venta, error: errVenta } = await db
    .from('ventas').insert([ventaPayload]).select().single();
  if (errVenta) throw errVenta;

  const lineas = detalles.map(d => ({ ...d, venta_id: venta.id }));
  const { error: errDetalle } = await db.from('detalle_ventas').insert(lineas);
  if (errDetalle) throw errDetalle;

  return venta;
}

async function fetchVentas({ desde, hasta } = {}) {
  let q = db.from('ventas').select('*').order('fecha', { ascending: false });
  if (desde) q = q.gte('fecha', desde);
  if (hasta) q = q.lte('fecha', hasta + 'T23:59:59');
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

async function fetchDetalleVenta(ventaId) {
  const { data, error } = await db
    .from('detalle_ventas').select('*, productos(nombre)').eq('venta_id', ventaId);
  if (error) throw error;
  return data;
}

async function fetchVentasHoy() {
  const hoy = new Date().toISOString().split('T')[0];
  return fetchVentas({ desde: hoy, hasta: hoy });
}

// ── CLIENTES (perfiles con rol = 'cliente') ────────
async function fetchClientes(filtro = '') {
  let q = db.from('perfiles').select('*')
    .eq('rol', 'cliente').order('nombre_completo');
  if (filtro) q = q.ilike('nombre_completo', `%${filtro}%`);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

async function insertCliente(payload) {
  const full = {
    ...payload,
    rol: 'cliente',
    pin: payload.pin || _generarPin(),
    telefono: payload.telefono || `tmp_${Date.now()}`,
  };
  const { data, error } = await db.from('perfiles').insert([full]).select().single();
  if (error) throw error;
  return data;
}

async function updateCliente(id, payload) {
  const { pin: _pin, rol: _rol, ...safe } = payload;
  return updatePerfil(id, safe);
}

async function deleteCliente(id) {
  return deletePerfil(id);
}

async function fetchVentasDeCliente(clienteId) {
  const { data, error } = await db
    .from('ventas').select('*').eq('cliente_id', clienteId)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return data;
}

// ── HELPERS ────────────────────────────────────────
function _generarPin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}
