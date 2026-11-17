-- Editor tipo juego: figuras que se deforman (4 esquinas) y cosas nuevas que se pueden agregar.
-- Solo agrega: no cambia ni borra datos existentes.
-- Cómo aplicarla: Supabase → SQL Editor → pegar todo esto → Run (una sola vez).

-- Esquinas de la figura en unidades del plano: [[x, y], [x, y], [x, y], [x, y]]. Null = rectángulo de x, y, w, h (como antes).
alter table public.elementos add column if not exists forma jsonb;

-- Tipos nuevos: hoyo / zanja, montón de tierra y bloque / losa
alter table public.elementos drop constraint if exists elementos_tipo_check;
alter table public.elementos add constraint elementos_tipo_check check (tipo = any (array[
  'grada','jardinera','bano','muro','puerta','columna','bodega','otro','techo','hoyo','monticulo','losa']));
