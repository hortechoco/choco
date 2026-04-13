-- ═══════════════════════════════════════════════
--  Horte · Sistema de Gestión — database.sql
--  Ejecutar en el Editor SQL de Supabase
-- ═══════════════════════════════════════════════

-- ── EXTENSIONES ───────────────────────────────
create extension if not exists "uuid-ossp";

-- ── TABLA: productos ──────────────────────────
create table if not exists productos (
  id          bigint primary key generated always as identity,
  nombre      text        not null,
  descripcion text,
  precio      numeric(10,2) not null check (precio >= 0),
  imagen_url  text,
  created_at  timestamptz not null default now()
);

-- ── TABLA: ventas ─────────────────────────────
create table if not exists ventas (
  id               bigint primary key generated always as identity,
  fecha            timestamptz not null default now(),
  tipo_entrega     text        not null check (tipo_entrega in ('recogida','domicilio')),
  cargo_domicilio  numeric(10,2) not null default 0,
  metodo_pago      text        not null check (metodo_pago in ('efectivo','transferencia','tarjeta')),
  notas            text,
  total            numeric(10,2) not null check (total >= 0),
  created_at       timestamptz not null default now()
);

-- ── TABLA: detalle_ventas ─────────────────────
create table if not exists detalle_ventas (
  id               bigint primary key generated always as identity,
  venta_id         bigint references ventas(id) on delete cascade,
  producto_id      bigint references productos(id) on delete set null,
  cantidad         int          not null check (cantidad > 0),
  precio_unitario  numeric(10,2) not null,
  subtotal         numeric(10,2) not null,
  created_at       timestamptz  not null default now()
);

-- ── TABLA: perfiles ───────────────────────────
create table if not exists perfiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  email            text,
  nombre_completo  text,
  carnet           text,
  telefono         text,
  direccion        text,
  rol              text not null default 'vendedor' check (rol in ('admin','vendedor')),
  created_at       timestamptz not null default now()
);

-- ── TRIGGER: crear perfil automático ──────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.perfiles (id, email, rol)
  values (new.id, new.email, 'vendedor')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── RLS: habilitar ────────────────────────────
alter table productos       enable row level security;
alter table ventas          enable row level security;
alter table detalle_ventas  enable row level security;
alter table perfiles        enable row level security;

-- ── POLÍTICAS: admin (acceso total) ──────────
create policy "admin_all_productos"      on productos      for all using (
  (select rol from perfiles where id = auth.uid()) = 'admin'
);
create policy "admin_all_ventas"         on ventas         for all using (
  (select rol from perfiles where id = auth.uid()) = 'admin'
);
create policy "admin_all_detalle"        on detalle_ventas for all using (
  (select rol from perfiles where id = auth.uid()) = 'admin'
);
create policy "admin_all_perfiles"       on perfiles       for all using (
  (select rol from perfiles where id = auth.uid()) = 'admin'
);

-- ── POLÍTICAS: vendedor ───────────────────────
-- Leer productos
create policy "vendedor_read_productos" on productos for select using (
  auth.role() = 'authenticated'
);

-- Insertar ventas
create policy "vendedor_insert_ventas" on ventas for insert with check (
  auth.role() = 'authenticated'
);

-- Leer ventas propias (o todas si admin — cubierto arriba)
create policy "vendedor_read_ventas" on ventas for select using (
  auth.role() = 'authenticated'
);

-- Insertar detalle
create policy "vendedor_insert_detalle" on detalle_ventas for insert with check (
  auth.role() = 'authenticated'
);

-- Leer detalle
create policy "vendedor_read_detalle" on detalle_ventas for select using (
  auth.role() = 'authenticated'
);

-- Ver su propio perfil
create policy "vendedor_read_own_perfil" on perfiles for select using (
  id = auth.uid()
);

-- ── DATOS DE PRUEBA (opcional, comentar en prod) ──
/*
insert into productos (nombre, descripcion, precio, imagen_url) values
  ('Chocolate Oscuro 72%',    'Intenso, con notas de frutos rojos y un tanino suave.',       8.50,  null),
  ('Chocolate con Leche',     'Cremoso y equilibrado. Cacao peruano con leche de montaña.', 7.00,  null),
  ('Bombón Praliné',          'Cobertura oscura, relleno de avellana tostada.',              3.50,  null),
  ('Tableta Flor de Sal',     'Dark 65% con escamas de sal atlántica.',                       9.00,  null),
  ('Trufa de Amaretto',       'Ganache de amaretto en cobertura de chocolate blanco.',        4.00,  null);
*/
