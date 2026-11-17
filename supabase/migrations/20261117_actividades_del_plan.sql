-- Dashboard: actividades del plan de obra.
-- Guarda lo programado (fechas, cantidad) y lo real (avance, estado, motivo si se detuvo).
-- Solo agrega cosas nuevas: no cambia ni borra datos existentes.
-- Cómo aplicarla: Supabase → SQL Editor → pegar todo esto → Run (una sola vez).

create table public.actividades (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid references public.obras(id) on delete cascade,
  nombre text not null check (length(trim(nombre)) > 0),
  fase text,
  area_id uuid references public.areas(id) on delete set null,
  inicio date not null,
  fin date not null,
  cantidad numeric check (cantidad is null or cantidad > 0),   -- null = el avance se mide en %
  unidad text,
  hecho numeric not null default 0 check (hecho >= 0),        -- cantidad hecha (o % si no hay cantidad)
  estado text not null default 'pendiente' check (estado in ('pendiente','en_proceso','detenida','terminada')),
  motivo text,                                                 -- por qué está detenida y qué se necesita
  encargado text,
  origen text,                                                 -- ID_PLAN del Planificador (Google Sheets), para no duplicar al importar
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid default auth.uid() references auth.users(id),
  check (fin >= inicio),
  unique (obra_id, origen)
);
comment on table public.actividades is 'Plan de obra: actividades con fechas programadas y avance real.';
create index actividades_obra_fechas on public.actividades (obra_id, inicio, fin);
create index actividades_area on public.actividades (area_id);
create index actividades_actualizado_por on public.actividades (actualizado_por);

alter table public.actividades enable row level security;
create policy "miembros ven" on public.actividades for select to authenticated using ((select public.es_miembro()));
create policy "miembros agregan" on public.actividades for insert to authenticated with check ((select public.es_miembro()));
create policy "miembros editan" on public.actividades for update to authenticated using ((select public.es_miembro())) with check ((select public.es_miembro()));
create policy "miembros borran" on public.actividades for delete to authenticated using ((select public.es_miembro()));
alter publication supabase_realtime add table public.actividades;

-- Qué actividad del plan está haciendo cada trabajador (el texto "actividad" se sigue usando en el plano)
alter table public.trabajadores add column actividad_id uuid references public.actividades(id) on delete set null;
create index trabajadores_actividad on public.trabajadores (actividad_id);
