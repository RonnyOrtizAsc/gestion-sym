-- Plano 19-nov: la fila norte se separa en áreas (comedor, eléctrico, compresor, bodega de repuestos, desvestideros/lockers, baños)
-- y se agregan los lockers y la banca del desvestidero (por instalar). Nuevo tipo de elemento: locker.
alter table public.elementos drop constraint if exists elementos_tipo_check;
alter table public.elementos add constraint elementos_tipo_check check (tipo = any (array[
  'grada','jardinera','bano','muro','puerta','columna','bodega','otro','techo','hoyo','monticulo','losa','inodoro','lavamanos','mueble','locker']));
delete from areas where id = 'e3866d03-94d6-44a4-9214-2752310aeb98';
insert into areas (obra_id, nombre, x, y, w, h, orden, tipo, estado)
select o.id, v.nombre, round(v.x0/13.88, 2), round(v.y0/15.2, 2), round((v.x1-v.x0)/13.88, 2), round((v.y1-v.y0)/15.2, 2), v.orden, v.tipo, v.estado
from obras o, (values
  ('Comedor empleados', 711, 3, 848, 100, 30, 'oficinas', 'falta'),
  ('Eléctrico', 853, 5, 925, 62, 31, 'servicio', 'existe'),
  ('Tableros eléctricos', 926, 5, 957, 62, 32, 'servicio', 'existe'),
  ('Compresor', 957, 5, 1027, 62, 33, 'servicio', 'existe'),
  ('Bodega de repuestos', 1028, 5, 1143, 62, 34, 'servicio', 'existe'),
  ('Desvestideros y lockers', 1144, 5, 1250, 62, 35, 'oficinas', 'existe'),
  ('Baños', 1251, 5, 1336, 62, 36, 'oficinas', 'existe')
) v(nombre, x0, y0, x1, y1, orden, tipo, estado);
insert into elementos (obra_id, tipo, nombre, estado, x, y, w, h, alto, forma, huecos)
select o.id, v.tipo, v.nombre, 'falta', v.x, v.y, v.w, v.h, v.alto, v.forma::jsonb, '[]'::jsonb from obras o, (values
  ('locker', 'Lockers (pared norte)', 82.85, 0.49, 6.48, 0.53, 1.8, '[[1150,7.5],[1240,7.5],[1240,15.5],[1150,15.5]]'),
  ('locker', 'Lockers (pared sur)', 82.85, 3.36, 6.48, 0.53, 1.8, '[[1240,59],[1150,59],[1150,51],[1240,51]]'),
  ('mueble', 'Banca del desvestidero', 83.93, 2.04, 4.32, 0.39, 0.45, '[[1165,31],[1225,31],[1225,37],[1165,37]]')
) v(tipo, nombre, x, y, w, h, alto, forma);
