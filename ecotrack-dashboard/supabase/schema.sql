-- EcoTrack · Tabla de emisiones
-- Ejecutar en Supabase → SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists public.emissions (
  id          uuid primary key default gen_random_uuid(),
  source_name text        not null check (char_length(trim(source_name)) between 1 and 80),
  category    text        not null check (category in ('Transporte', 'Energía', 'Residuos')),
  co2_kg      numeric(12, 2) not null check (co2_kg > 0 and co2_kg <= 1000000),
  created_at  timestamptz not null default now()
);

create index if not exists emissions_created_at_idx on public.emissions (created_at desc);

-- Row Level Security (demo: lectura e inserción pública con la anon key).
-- En producción restringir a usuarios autenticados / por empresa.
alter table public.emissions enable row level security;

drop policy if exists "emissions_select_public" on public.emissions;
create policy "emissions_select_public" on public.emissions
  for select using (true);

drop policy if exists "emissions_insert_public" on public.emissions;
create policy "emissions_insert_public" on public.emissions
  for insert with check (true);

-- Habilitar Realtime para la tabla
alter publication supabase_realtime add table public.emissions;

-- Datos de ejemplo
insert into public.emissions (source_name, category, co2_kg) values
  ('Flota de camiones de reparto', 'Transporte', 1840.50),
  ('Planta de producción – Línea A', 'Energía', 3210.00),
  ('Vuelos corporativos Q4', 'Transporte', 2675.20),
  ('Data center (servidores)', 'Energía', 980.75),
  ('Residuos orgánicos cafetería', 'Residuos', 142.30),
  ('Relleno sanitario – embalajes', 'Residuos', 418.00);
