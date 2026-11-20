// Figuras del plano que se deforman "como en un juego": cada cosa agregada (hoyo, columna, bloque,
// gradas, montículo…) es un cuadrilátero con 4 esquinas que se arrastran libremente.
// Agarraderas: 0-3 esquinas (deformar), 4-7 lados (estirar o aplanar ese lado), 8 centro (mover todo).
// Unidades: las del plano (1388 × 1520); 1 unidad = 0.056 m.
import { ANCHO, ALTO, puntas } from "./mapa-svg.js";

export const MxU = 0.056;                 // metros por unidad del plano
export const U = (m) => m / MxU;          // metros → unidades

// Lo que se puede agregar con un botón: nombre, dibujito, tamaño inicial (m) y alto inicial (m)
export const FICHAS = [
  { tipo: "muro", nombre: "Pared", icono: "▮", w: 3, h: 0.15 },
  { tipo: "hoyo", nombre: "Hoyo / zanja", icono: "⛏", w: 3, h: 0.6, alto: 1 },
  { tipo: "columna", nombre: "Columna", icono: "▥", w: 0.4, h: 0.4 },
  { tipo: "losa", nombre: "Bloque / losa", icono: "▬", w: 2, h: 2, alto: 0.3 },
  { tipo: "grada", nombre: "Gradas", icono: "☰", w: 1.2, h: 2.4 },
  { tipo: "jardinera", nombre: "Jardinera", icono: "✿", w: 2.5, h: 0.6 },
  { tipo: "monticulo", nombre: "Montón de tierra", icono: "▲", w: 2, h: 2, alto: 1 },
  { tipo: "techo", nombre: "Techo", icono: "⌂", w: 4, h: 4 },
  { tipo: "inodoro", nombre: "Inodoro", icono: "🚽", w: 0.45, h: 0.7 },
  { tipo: "lavamanos", nombre: "Lavamanos", icono: "🚰", w: 1.2, h: 0.5 },
  { tipo: "mueble", nombre: "Mueble / mesa", icono: "▭", w: 1.5, h: 0.6 },
  { tipo: "area", nombre: "Área / zona", icono: "⬚", w: 6, h: 6 },
];
// Áreas: siempre rectángulos derechos. Esquina = la opuesta queda fija; lado = se corre ese lado; centro = mover.
export function moverRect(pts, idx, x, y) {
  x = Math.max(0, Math.min(ANCHO, x)); y = Math.max(0, Math.min(ALTO, y));
  if (idx >= 4) return moverFigura(pts, idx, x, y);
  const o = pts[(idx + 2) % 4], x0 = Math.min(x, o[0]), x1 = Math.max(x, o[0], Math.min(x, o[0]) + MIN), y0 = Math.min(y, o[1]), y1 = Math.max(y, o[1], Math.min(y, o[1]) + MIN);
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
}
// Rectángulo (unidades) → x, y, w, h en %
export function rectPct(pts) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), x0 = Math.min(...xs), y0 = Math.min(...ys);
  return { x: +((x0 / ANCHO) * 100).toFixed(2), y: +((y0 / ALTO) * 100).toFixed(2), w: +Math.max(0.3, ((Math.max(...xs) - x0) / ANCHO) * 100).toFixed(2), h: +Math.max(0.3, ((Math.max(...ys) - y0) / ALTO) * 100).toFixed(2) };
}
// Alto (m) cuando no se ha cambiado. Hoyo: profundidad. Los demás: desde el piso.
export const ALTO_DEF = { grada: 1.2, jardinera: 0.7, bano: 1.7, puerta: 1.7, columna: 3.4, bodega: 2.2, otro: 1.1, losa: 0.3, hoyo: 1, monticulo: 1, techo: 3.5, inodoro: 0.78, lavamanos: 0.85, mueble: 0.9 };
export const altoDe = (e) => (+e.alto > 0 ? +e.alto : ALTO_DEF[e.tipo] ?? 1.1);
export const NOMBRE_TIPO = { grada: "Gradas", jardinera: "Jardinera", bano: "Baño", muro: "Pared", puerta: "Puerta", columna: "Columna", bodega: "Bodega",
  techo: "Techo", otro: "Otro", hoyo: "Hoyo / zanja", monticulo: "Montón de tierra", losa: "Bloque / losa",
  inodoro: "Inodoro", lavamanos: "Lavamanos", mueble: "Mueble / mesa" };

// Esquinas de un elemento (en unidades): las guardadas, o las del rectángulo de siempre
export function esquinas(e) {
  if (Array.isArray(e.forma) && e.forma.length >= 3) return e.forma.map(([x, y]) => [+x, +y]);
  const X = (e.x / 100) * ANCHO, Y = (e.y / 100) * ALTO, W = (e.w / 100) * ANCHO, H = (e.h / 100) * ALTO;
  return [[X, Y], [X + W, Y], [X + W, Y + H], [X, Y + H]];
}
export const centro = (pts) => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
const r1 = (v) => Math.round(v * 10) / 10;

// Lo que se guarda: la forma y también el rectángulo que la encierra (en %), para lo que todavía usa x, y, w, h
export function guardable(pts) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), x0 = Math.min(...xs), y0 = Math.min(...ys);
  return { forma: pts.map(([x, y]) => [r1(x), r1(y)]), x: +((x0 / ANCHO) * 100).toFixed(3), y: +((y0 / ALTO) * 100).toFixed(3),
    w: +Math.max(0.05, ((Math.max(...xs) - x0) / ANCHO) * 100).toFixed(3), h: +Math.max(0.05, ((Math.max(...ys) - y0) / ALTO) * 100).toFixed(3) };
}

// Figura nueva centrada en (cx, cy), del tamaño de su ficha
export function figuraNueva(ficha, cx, cy) {
  const w = U(ficha.w) / 2, h = U(ficha.h) / 2;
  return [[cx - w, cy - h], [cx + w, cy - h], [cx + w, cy + h], [cx - w, cy + h]];
}

// Dónde va cada agarradera: 4 esquinas, 4 mitades de lado, centro
export function agarraderas(pts) {
  const n = pts.length, lados = pts.map((p, i) => { const q = pts[(i + 1) % n]; return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; });
  return { puntos: [...pts, ...lados, centro(pts)], tipos: [...pts.map(() => "esquina"), ...lados.map(() => "lado"), "centro"] };
}

const MIN = U(0.1);   // nada más chico que 10 cm
// Arrastrar la agarradera "idx" hasta (x, y): devuelve las esquinas nuevas
export function moverFigura(pts, idx, x, y) {
  const n = pts.length, nuevo = pts.map((p) => [...p]);
  x = Math.max(0, Math.min(ANCHO, x)); y = Math.max(0, Math.min(ALTO, y));
  if (idx < n) nuevo[idx] = [x, y];                                    // esquina: libre
  else if (idx < 2 * n) {                                              // lado: se mueve hacia afuera o hacia adentro, derecho
    const i = idx - n, j = (i + 1) % n, a = pts[i], b = pts[j], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L, mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    let d = (x - mx) * nx + (y - my) * ny;
    // que no se voltee: el lado no puede pasar al otro lado de la figura
    const c = centro(pts), dc = (c[0] - mx) * nx + (c[1] - my) * ny;
    if (Math.sign(dc) !== 0 && Math.sign(dc) === Math.sign(d) && Math.abs(d) > Math.abs(dc) * 2 - MIN) d = Math.sign(d) * Math.max(0, Math.abs(dc) * 2 - MIN);
    nuevo[i] = [a[0] + nx * d, a[1] + ny * d]; nuevo[j] = [b[0] + nx * d, b[1] + ny * d];
  } else { const c = centro(pts); return pts.map(([px, py]) => [px + x - c[0], py + y - c[1]]); }   // centro: mover todo
  return nuevo;
}
export function girar(pts, grados) {
  const c = centro(pts), r = (grados * Math.PI) / 180, co = Math.cos(r), si = Math.sin(r);
  return pts.map(([x, y]) => [c[0] + (x - c[0]) * co - (y - c[1]) * si, c[1] + (x - c[0]) * si + (y - c[1]) * co]);
}
export const correr = (pts, dx, dy) => pts.map(([x, y]) => [x + dx, y + dy]);

// Medidas en palabras: los dos lados más largos (largo × ancho) y el alto o la profundidad
const fm = (m) => (m >= 10 ? m.toFixed(1) : m.toFixed(2)).replace(/\.?0+$/, "") + " m";
export function medidasFigura(e, pts = esquinas(e)) {
  const n = pts.length, lados = pts.map((p, i) => Math.hypot(pts[(i + 1) % n][0] - p[0], pts[(i + 1) % n][1] - p[1]) * MxU);
  const largo = Math.max((lados[0] + lados[2]) / 2, (lados[1] + lados[3]) / 2), ancho = Math.min((lados[0] + lados[2]) / 2, (lados[1] + lados[3]) / 2);
  let area = 0; for (let i = 0; i < n; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % n]; area += x0 * y1 - x1 * y0; }
  area = Math.abs(area / 2) * MxU * MxU;
  const alto = altoDe(e), extra = e.tipo === "hoyo" ? ` · ${fm(alto)} de hondo` : e.tipo === "techo" ? "" : ` · ${fm(alto)} de alto`;
  return `${fm(largo)} × ${fm(ancho)}${extra}${e.tipo === "hoyo" ? ` · ${(Math.round(area * alto * 10) / 10).toLocaleString("es-SV")} m³` : ""}`;
}
// Texto corto mientras se arrastra
export function medidaCorta(pts) {
  const n = pts.length, l = pts.map((p, i) => Math.hypot(pts[(i + 1) % n][0] - p[0], pts[(i + 1) % n][1] - p[1]) * MxU);
  return `${fm((l[0] + l[2]) / 2)} × ${fm((l[1] + l[3]) / 2)}`;
}
// ¿El punto (x, y) está dentro de la figura?
export function dentroDe(pts, x, y) {
  let dentro = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

// Zonas agregadas desde la app (herramienta Zona o Dividir): sirven para ubicar gente; no cambian el piso
// ni la altura de las paredes en 3D. Se marcan con orden = 50 (las del plano original usan otros números).
export const ORDEN_ZONA = 50;
export const esZona = (a) => +a.orden === ORDEN_ZONA;
// Alto de las paredes según el tipo de área (metros) — lo usa también la maqueta 3D
export const ALTO_MURO = { sala: 6.45, taller: 6, oficinas: 3.72, servicio: 3.72, lavado: 4.51, receso: 4.74 };
// Alto que tiene ahora una pared dibujada: el que se le puso, o el automático según el área donde está
export function altoPared(e, areas = []) {
  if (+e.alto > 0) return +e.alto;
  if (e.material === "lamina") return 6;
  const [a, b] = puntas(e.trazo), x = ((a[0] + b[0]) / 2 / ANCHO) * 100, y = ((a[1] + b[1]) / 2 / ALTO) * 100;
  const ar = areas.filter((q) => !esZona(q) && x >= q.x && x <= +q.x + +q.w && y >= q.y && y <= +q.y + +q.h).sort((p, q) => p.w * p.h - q.w * q.h)[0];
  return ALTO_MURO[ar ? (ar.es_receso ? "receso" : ar.tipo) : ""] || 3;
}

// ¿El punto está dentro de la figura o a menos de "tol" unidades de su orilla? (para tocar cosas chiquitas)
export function cercaDe(pts, x, y, tol) {
  if (dentroDe(pts, x, y)) return true;
  return pts.some((a, i) => { const b = pts[(i + 1) % pts.length], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L)); return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy) < tol; });
}
