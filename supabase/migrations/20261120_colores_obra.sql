-- Colores elegidos en la app para lo que se ve en 3D (estantes, columnas, casetas, techos…): { clave: "#rrggbb" }
alter table public.obras add column if not exists colores jsonb not null default '{}'::jsonb;
-- Pedido: estantería de repuestos y columnas/vigas del taller en gris perla
update public.obras set colores = colores || '{"estructura-taller": "#cfd0cc", "estanteria-repuestos": "#cfd0cc"}'::jsonb where activa;
