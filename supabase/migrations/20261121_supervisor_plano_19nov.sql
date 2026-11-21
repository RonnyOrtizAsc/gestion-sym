-- Oficina del supervisor según plano 19-nov: lo de la cara oeste se quita (rojo), puerta nueva en la cara este y divisiones nuevas (transparente)
update elementos set huecos = (select jsonb_agg(hh.v || '{"e":"quitar"}'::jsonb) from jsonb_array_elements(huecos) hh(v)) where id='90091071-2741-4981-b6f3-5a4092feec6b';
update elementos set huecos = huecos || '[{"t":"puerta","c":[931,189],"w":0.9,"d":0,"h":2.1,"e":"falta"}]'::jsonb where id='d2b0cc5b-df84-4c5c-98e6-86e225dc58c6';
-- (+ 2 divisiones "Oficina supervisor · división" y piezas del plano 69,199-205,414,415,784-791,1364,1365 como quitado)
