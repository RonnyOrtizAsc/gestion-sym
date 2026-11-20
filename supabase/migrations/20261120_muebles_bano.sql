-- Muebles básicos que se pueden poner en el plano (2D y 3D): inodoro, lavamanos y mueble/mesón
alter table public.elementos drop constraint if exists elementos_tipo_check;
alter table public.elementos add constraint elementos_tipo_check check (tipo = any (array[
  'grada','jardinera','bano','muro','puerta','columna','bodega','otro','techo','hoyo','monticulo','losa','inodoro','lavamanos','mueble']));
