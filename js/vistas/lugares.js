// Dónde está una persona, en palabras: el área (si hay) y lo que hay en ese punto del plano
// (gradas, jardinera, rampa, una caseta o basurero dibujado, una zanja…). Así se puede poner
// a alguien en cualquier lugar, no solo dentro de una zona.
import { S, TIPOS_ELEMENTO } from "../datos.js";
import { ANCHO, ALTO, piezaEn, grupoDe, queEs, CHICAS, distPared, puntas } from "./mapa-svg.js";
import { esquinas, dentroDe } from "./figuras.js";

export const nombreArea = (a) => (a ? (a.es_receso ? a.uso_actual || "Bodega (receso)" : (a.nombre || "").trim() || "Zona sin nombre") : "");

// Área más chica que contiene el punto (en %), sin contar la bodega de receso
export const areaEn = (px, py) => S.areas.filter((a) => !a.es_receso && px >= a.x && px <= +a.x + +a.w && py >= a.y && py <= +a.y + +a.h).sort((p, q) => p.w * p.h - q.w * q.h)[0];

// Lo que hay en el punto (unidades del plano): primero lo agregado con nombre, luego las piezas del plano
function queHay(X, Y) {
  // paredes agregadas con el mismo nombre forman un cuarto (caseta, basurero…): adentro cuenta como ese lugar
  const grupos = new Map();
  for (const e of S.elementos) if (e.trazo && e.nombre) (grupos.get(e.nombre) || grupos.set(e.nombre, []).get(e.nombre)).push(...puntas(e.trazo));
  for (const [nombre, pts] of grupos) {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), m = 4;
    if (pts.length >= 6 && X >= Math.min(...xs) - m && X <= Math.max(...xs) + m && Y >= Math.min(...ys) - m && Y <= Math.max(...ys) + m) return nombre;
  }
  const fig = S.elementos.find((e) => !e.trazo && e.tipo !== "techo" && dentroDe(esquinas(e), X, Y));
  if (fig) return fig.nombre || TIPOS_ELEMENTO[fig.tipo] || "";
  const muro = S.elementos.find((e) => e.trazo && distPared(X, Y, e) < 6);
  if (muro) return (muro.nombre || "Pared").split(" · ")[0];   // "Oficina supervisor · cara sur" → "Oficina supervisor"
  const i = piezaEn(X, Y, 6);
  if (i >= 0 && !CHICAS.has(i)) { const q = queEs(grupoDe(i)); if (q && !/^(línea|linea|detalle)/i.test(q)) return q; }
  return "";
}

// Punto en % → { area, detalle, texto }
export function lugarEn(px, py) {
  const area = areaEn(px, py), detalle = queHay((px / 100) * ANCHO, (py / 100) * ALTO);
  const texto = [detalle, area && nombreArea(area)].filter(Boolean).join(" · ") || "Fuera de las áreas";
  return { area, detalle, texto };
}
// Dónde está un trabajador ahora (texto corto), o "" si no tiene lugar
export function lugarDe(w) {
  if (w.pos_x != null && w.pos_y != null) return lugarEn(+w.pos_x, +w.pos_y).texto;
  const a = S.areas.find((q) => q.id === w.area_id);
  return a ? nombreArea(a) : "";
}
