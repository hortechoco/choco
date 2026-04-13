// supabase.js — cliente Supabase + funciones genéricas de BD
// Depende de: settings.js

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── PRODUCTOS ──────────────────────────────────────
async function fetchProductos() {
  const { data, error } = await db
    .from('productos')
    .select('*')
    .order('nombre');
  if (error) throw error;
  return data;
}

async function insertProducto(payload) {
  const { data, error } = await db
    .from('productos')
    .insert([payload])
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateProducto(id, payload) {
  const { data, error } = await db
    .from('productos')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
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
    .from('ventas')
    .insert([ventaPayload])
    .select()
    .single();
  if (errVenta) throw errVenta;

  const lineas = detalles.map(d => ({ ...d, venta_id: venta.id }));
  const { error: errDetalle } = await db.from('detalle_ventas').insert(lineas);
  if (errDetalle) throw errDetalle;

  return venta;
}

async function fetchVentas({ desde, hasta } = {}) {
  let query = db
    .from('ventas')
    .select('*')
    .order('fecha', { ascending: false });

  if (desde) query = query.gte('fecha', desde);
  if (hasta) query = query.lte('fecha', hasta + 'T23:59:59');

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function fetchDetalleVenta(ventaId) {
  const { data, error } = await db
    .from('detalle_ventas')
    .select('*, productos(nombre)')
    .eq('venta_id', ventaId);
  if (error) throw error;
  return data;
}

async function fetchVentasHoy() {
  const hoy = new Date().toISOString().split('T')[0];
  return fetchVentas({ desde: hoy, hasta: hoy });
}

// ── PERFILES ───────────────────────────────────────
async function fetchPerfil(userId) {
  const { data, error } = await db
    .from('perfiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

// ── CLIENTES ───────────────────────────────────────
async function fetchClientes(filtro = '') {
  let q = db.from('clientes').select('*').order('nombre_completo');
  if (filtro) q = q.ilike('nombre_completo', `%${filtro}%`);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

async function insertCliente(payload) {
  const { data, error } = await db
    .from('clientes')
    .insert([payload])
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateCliente(id, payload) {
  const { data, error } = await db
    .from('clientes')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteCliente(id) {
  const { error } = await db.from('clientes').delete().eq('id', id);
  if (error) throw error;
}

async function fetchVentasDeCliente(clienteId) {
  const { data, error } = await db
    .from('ventas')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return data;
}
