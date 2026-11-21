insert into piezas (obra_id, idx, estado, actualizado_en) select (select id from obras limit 1), i, 'quitado', now() from unnest(array[154,155,156,157,158,284,285,286,287,288,289,290,291,292,293,294,295,298,299,300,301,302,303,304,305,306,307,308,309,310,311,312,314,315,316,317,318,319,320,355,356,357,358,359,360,361,362,370,433,455,456,457,458,459,460,461,462,463,464,465,501,502,503,504,507,509,510,511,512,518,519,520,521,522,523,524,525,526,527,528,645,646,647,648,650,652,653,654,655,656,657,658,659,660,661,662,663,664,820,1244,1245,1246,1247,1248,1249,1250,1278,1279,1280,1281,1282,1284,1285,1286,1287,1288,1290,1293,1294,1295,1296,1300,1301,1302,1311,1340,1341,1342,1345,1347,1398]) i on conflict (obra_id, idx) do update set estado='quitado', actualizado_en=now();

insert into elementos (obra_id,tipo,nombre,estado,material,grueso,alto,x,y,w,h,trazo,huecos) values
((select id from obras limit 1),'muro','Oficinas Marca 3 · fachada norte','falta','ventanal',0.1,3.4,33.00,18.09,19.16,0.79,'M464 281L718 281','[]'::jsonb),
((select id from obras limit 1),'muro','Oficinas Marca 3 · fachada oeste','falta','ventanal',0.1,3.4,33.00,18.09,0.86,13.29,'M464 281L464 471','[{"t": "puerta", "c": [464, 351.5], "w": 0.95, "d": 0, "h": 2.1}]'::jsonb),
((select id from obras limit 1),'muro','Oficinas Marca 3 · fachada sur','falta','ventanal',0.1,3.4,33.00,30.59,19.16,0.79,'M464 471L718 471','[]'::jsonb),
((select id from obras limit 1),'muro','Oficinas Marca 3 · pared este','falta','block',0.15,3.4,51.30,18.09,0.86,13.29,'M718 281L718 471','[]'::jsonb),
((select id from obras limit 1),'muro','Oficinas Marca 3 · división oficinas','falta','block',0.1,2.8,33.00,27.63,15.96,0.79,'M464 426L673.5 426','[{"t": "puerta", "c": [504, 426], "w": 0.9, "d": 0, "h": 2.1}, {"t": "puerta", "c": [554, 426], "w": 0.9, "d": 0, "h": 2.1}, {"t": "puerta", "c": [613.5, 426], "w": 0.9, "d": 0, "h": 2.1}, {"t": "puerta", "c": [664, 426], "w": 0.9, "d": 0, "h": 2.1}]'::jsonb),
((select id from obras limit 1),'muro','Oficinas Marca 3 · división','falta','block',0.1,2.8,36.60,27.63,0.86,3.75,'M514 426L514 471','[]'::jsonb),
((select id from obras limit 1),'muro','Oficinas Marca 3 · división','falta','block',0.1,2.8,40.20,27.63,0.86,3.75,'M564 426L564 471','[]'::jsonb),
((select id from obras limit 1),'muro','Oficinas Marca 3 · división','falta','block',0.1,2.8,44.49,27.63,0.86,3.75,'M623.5 426L623.5 471','[]'::jsonb),
((select id from obras limit 1),'muro','Oficinas Marca 3 · gerente de marca','falta','block',0.1,2.8,48.09,26.38,0.86,5.00,'M673.5 407L673.5 471','[{"t": "puerta", "c": [673.5, 416.5], "w": 0.9, "d": 0, "h": 2.1}]'::jsonb),
((select id from obras limit 1),'muro','Oficinas Marca 3 · baños abajo','falta','block',0.1,2.8,46.54,26.38,5.62,0.79,'M652 407L718 407','[]'::jsonb),
((select id from obras limit 1),'muro','Oficinas Marca 3 · baños oeste','falta','block',0.1,2.8,47.66,22.24,0.86,4.93,'M667.5 344L667.5 407','[]'::jsonb),
((select id from obras limit 1),'muro','Oficinas Marca 3 · mostrador','falta','block',0.1,1.1,46.54,22.24,1.98,0.79,'M652 344L667.5 344','[]'::jsonb),
((select id from obras limit 1),'muro','Oficinas Marca 3 · baños arriba','falta','block',0.1,2.8,47.66,23.36,4.50,0.79,'M667.5 361L718 361','[{"t": "puerta", "c": [676, 361], "w": 0.8, "d": 0, "h": 2.1}, {"t": "puerta", "c": [710.4, 361], "w": 0.75, "d": 0, "h": 2.1}]'::jsonb),
((select id from obras limit 1),'muro','Oficinas Marca 3 · entre baños','falta','block',0.1,2.8,49.33,23.36,0.86,3.82,'M690.7 361L690.7 407','[]'::jsonb),
((select id from obras limit 1),'muro','Oficinas Marca 3 · cocineta','falta','block',0.1,2.8,48.99,18.09,0.86,4.93,'M686 281L686 344','[]'::jsonb),
((select id from obras limit 1),'muro','Oficinas Marca 3 · cocineta abajo','falta','block',0.1,2.8,48.99,22.24,3.17,0.79,'M686 344L718 344','[{"t": "puerta", "c": [694, 344], "w": 0.85, "d": 0, "h": 2.1}]'::jsonb);
delete from areas where id='fa0cca08-4fb7-4445-82a8-b9d204be0d49' and nombre='Oficinas Marca 4';
insert into areas (obra_id,nombre,x,y,w,h,orden,tipo,estado) select obra_id,'Oficinas Marca 3',33.43,18.49,18.30,12.50,20,'oficinas','falta' from areas where id='c7bafceb-b269-4d49-b51d-edeaecb03d36';
