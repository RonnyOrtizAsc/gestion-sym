alter table public.elementos add column if not exists escalones integer check (escalones between 1 and 40);
