// Dibuja la obra como plano propio: trazo real del AR-01 (muros, divisiones, puertas, columnas,
// jardineras, gradas) + áreas de trabajo + elementos agregados, cada cosa según su estado:
//   existe → sólido · en construcción → ocre con rayado · falta → punteado claro ("fantasma")
// Unidades: el mapa mide 1388 × 1520 (desde la línea M1 hasta la calle); áreas y elementos vienen en %.
import { esc } from "../util.js";
import TRAZO from "../planos/automall-ar01.js";

export const ANCHO = 1388, ALTO = 1520;
const LOTE = { x: 85, y: 5, w: 1250, h: 1440 };

const C = {
  calle: "#3b4046", acera: "#dfe1d6", zacate: "#a9c47f", lote: "#f4f2ec", amarillo: "#f2c230",
  tinte: { sala: "#eaf3fa", exhibicion: "#f1efe9", oficinas: "#f6ecdc", parqueo: "#e6e8ea", taller: "#e4e8ec",
           rampa: "#ebe8e0", patio: "#eceeef", lavado: "#e2f0f8", servicio: "#efede7", entrega: "#eef1f3" },
};
// Cómo se ve cada clase de trazo según el estado del área donde está
const ESTILO = {
  existe:     { lamina: 'stroke="#4d565e" stroke-width="3.4"', grada: 'stroke="#1f2327" stroke-width="1.6"', muro: 'stroke="#1f2327" stroke-width="3.4"', fino: 'stroke="#6b7178" stroke-width="1"', borde: 'stroke="#454a50" stroke-width="2"', columna: 'stroke="#1d2125" stroke-width="2.2" fill="#1d2125"', jardin: 'stroke="#3f7d32" stroke-width="1.3"' },
  en_proceso: { lamina: 'stroke="#b26b00" stroke-width="2.6"', grada: 'stroke="#b26b00" stroke-width="1.6"', muro: 'stroke="#b26b00" stroke-width="2.6"', fino: 'stroke="#c48a2c" stroke-width="1.2"', borde: 'stroke="#b26b00" stroke-width="2.6"', columna: 'stroke="#b26b00" stroke-width="2.2" fill="#b26b00"', jardin: 'stroke="#8aa64a" stroke-width="1.3"' },
  // lo que falta se ve transparente: es el proyecto final "en espera"
  falta:      { lamina: 'stroke="#8ea3b8" stroke-opacity=".5" stroke-width="2.4"', grada: 'stroke="#8ea3b8" stroke-opacity=".6" stroke-width="1.4"', muro: 'stroke="#8ea3b8" stroke-opacity=".5" stroke-width="2.4"', fino: 'stroke="#9fb0c2" stroke-opacity=".45" stroke-width="1"', borde: 'stroke="#8ea3b8" stroke-opacity=".5" stroke-width="1.8"', columna: 'stroke="#8ea3b8" stroke-opacity=".5" stroke-width="1.6" fill="#8ea3b8" fill-opacity=".2"', jardin: 'stroke="#7fae6c" stroke-opacity=".35" stroke-width="1"' },
};
const ELEM = { grada: "#8a8f96", jardinera: "#5f9a45", bano: "#4f9fd0", muro: "#1d2125", puerta: "#6c5a3d", columna: "#1d2125", bodega: "#ee8420", otro: "#7d6bb3" };

const px = (a) => ({ X: (a.x / 100) * ANCHO, Y: (a.y / 100) * ALTO, W: (a.w / 100) * ANCHO, H: (a.h / 100) * ALTO });
const dentro = (x, y, r) => x >= r.X && x <= r.X + r.W && y >= r.Y && y <= r.Y + r.H;

function etiqueta(nombre, X, Y, W, H, apagada) {
  const texto = nombre.toUpperCase(), larga = Math.max(...texto.split(" ").map((p) => p.length));
  const fs = Math.max(10, Math.min(24, Math.min(W, H) * 0.12, (W * 0.9) / (larga * 0.68)));
  const porLinea = Math.max(6, Math.floor((W * 0.9) / (fs * 0.66)));
  const lineas = []; let actual = "";
  for (const p of texto.split(" ")) { if ((actual + " " + p).trim().length > porLinea && actual) { lineas.push(actual); actual = p; } else actual = (actual + " " + p).trim(); }
  if (actual) lineas.push(actual);
  const m2 = Math.round(W * M * H * M), lh = fs * 1.18;
  const y0 = Y + H / 2 - (lineas.length * lh) / 2 + lh / 2 - fs * 0.35;
  return `<text class="et${apagada ? " apagada" : ""}" x="${X + W / 2}" y="${y0}" font-size="${fs.toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${lineas.map((l, i) => `<tspan x="${X + W / 2}" dy="${i ? lh : 0}">${esc(l)}</tspan>`).join("")}<tspan class="m2" x="${X + W / 2}" dy="${lh * 0.95}" font-size="${(fs * 0.72).toFixed(1)}">${m2} m²</tspan></text>`;
}

// ---------- Paredes dibujadas a mano (elementos con trazo) ----------
export const MATERIALES = { block: "Block", lamina: "Lámina", ventanal: "Ventanal" };
const COLOR_MAT = { block: "#1f2327", lamina: "#4d565e", ventanal: "#3d8fd1" };
export const puntas = (trazo) => { const v = (trazo.match(/-?\d+\.?\d*/g) || []).map(Number); return [[v[0], v[1]], [v[2], v[3]]]; };
const r1 = (v) => +v.toFixed(1), pct = (v, t) => +((v / t) * 100).toFixed(2);
// Trazo y caja (en % del plano, con margen para poder tocarla) de una pared de a → b
export const pared = (a, b) => ({ trazo: `M${r1(a[0])} ${r1(a[1])}L${r1(b[0])} ${r1(b[1])}`,
  x: pct(Math.min(a[0], b[0]) - 6, ANCHO), y: pct(Math.min(a[1], b[1]) - 6, ALTO), w: pct(Math.abs(b[0] - a[0]) + 12, ANCHO), h: pct(Math.abs(b[1] - a[1]) + 12, ALTO) });
export const largoPared = (e) => { const [a, b] = puntas(e.trazo); return Math.hypot(b[0] - a[0], b[1] - a[1]) * M; };   // metros
export const gruesoPared = (e) => +e.grueso || (e.material === "ventanal" ? 0.1 : 0.15);   // metros
// Endereza b respecto a a si está casi horizontal o vertical
export const enderezar = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1];
  return Math.abs(dy) < Math.abs(dx) * 0.1 ? [b[0], a[1]] : Math.abs(dx) < Math.abs(dy) * 0.1 ? [a[0], b[1]] : b; };
// Distancia de un punto a una pared dibujada
export const distPared = (x, y, e) => distSeg(x, y, puntas(e.trazo));

// Huecos (puertas y ventanas) de una pared: { t: "puerta" | "ventana", c: [x, y] centro, w: metros }.
// Se guardan por su centro en el plano, así no se mueven si la pared se alarga.
export const ANCHO_HUECO = { puerta: 0.9, ventana: 1.5 };
// Tramos de la pared a lo largo (en unidades del mapa desde la punta a): sólidos y huecos
export function tramosPared(e) {
  const [a, b] = puntas(e.trazo), L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  const huecos = (e.huecos || []).map((h) => { const s = (h.c[0] - a[0]) * u[0] + (h.c[1] - a[1]) * u[1], m = h.w / M / 2;
    return { t: h.t, s0: Math.max(0, s - m), s1: Math.min(L, s + m) }; }).filter((h) => h.s1 - h.s0 > 1).sort((p, q) => p.s0 - q.s0);
  const solidos = []; let ini = 0;
  for (const h of huecos) { if (h.s0 > ini) solidos.push([ini, h.s0]); ini = Math.max(ini, h.s1); }
  if (ini < L) solidos.push([ini, L]);
  return { a, b, L, u, solidos, huecos };
}
// Punto de la pared más cercano a (x, y) y su distancia
export function sobrePared(e, x, y) {
  const { a, L, u } = tramosPared(e), s = Math.max(0, Math.min(L, (x - a[0]) * u[0] + (y - a[1]) * u[1])), p = [a[0] + u[0] * s, a[1] + u[1] * s];
  return { p, s, d: Math.hypot(x - p[0], y - p[1]) };
}
// Paredes en la misma línea que a→b que la tocan o se enciman: se juntan en una sola
export function enLinea(a, b, paredes) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1) return { a, b, juntas: [] };
  const u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], juntas = []; let s0 = 0, s1 = L;
  for (const e of paredes) {
    const [p, q] = puntas(e.trazo), Lq = Math.hypot(q[0] - p[0], q[1] - p[1]); if (Lq < 1) continue;
    const cruz = Math.abs(u[0] * (q[1] - p[1]) - u[1] * (q[0] - p[0])) / Lq;
    const dl = (r) => Math.abs((r[0] - a[0]) * u[1] - (r[1] - a[1]) * u[0]);
    if (cruz > 0.06 || dl(p) > 4 || dl(q) > 4) continue;
    const sp = (p[0] - a[0]) * u[0] + (p[1] - a[1]) * u[1], sq = (q[0] - a[0]) * u[0] + (q[1] - a[1]) * u[1];
    if (Math.max(sp, sq) < s0 - 4 || Math.min(sp, sq) > s1 + 4) continue;   // ni se tocan
    juntas.push(e); s0 = Math.min(s0, sp, sq); s1 = Math.max(s1, sp, sq);
  }
  return { a: [a[0] + u[0] * s0, a[1] + u[1] * s0], b: [a[0] + u[0] * s1, a[1] + u[1] * s1], juntas };
}

function elemento(e) {
  if (e.trazo) {   // pared dibujada a mano: grosor real, color de su material y sus huecos
    const w = Math.max(2.5, gruesoPared(e) / M), col = e.estado === "existe" ? COLOR_MAT[e.material] || COLOR_MAT.block : e.estado === "en_proceso" ? "#b26b00" : "#8ea3b8";
    const op = e.estado === "falta" ? ' stroke-opacity=".55"' : "", { a, u, solidos, huecos } = tramosPared(e);
    const P = (s) => `${(a[0] + u[0] * s).toFixed(1)} ${(a[1] + u[1] * s).toFixed(1)}`, d = solidos.map(([s0, s1]) => `M${P(s0)}L${P(s1)}`).join("");
    const vid = huecos.filter((h) => h.t === "ventana").map((h) => `M${P(h.s0)}L${P(h.s1)}`).join("");
    const pue = huecos.filter((h) => h.t === "puerta").map((h) => { const r = h.s1 - h.s0, q = [a[0] + u[0] * h.s0 - u[1] * r, a[1] + u[1] * h.s0 + u[0] * r];
      return `M${P(h.s0)}L${q[0].toFixed(1)} ${q[1].toFixed(1)}A${r.toFixed(1)} ${r.toFixed(1)} 0 0 0 ${P(h.s1)}`; }).join("");
    return `<g class="elem">${d ? `<path stroke="${col}"${op} stroke-width="${w}" fill="none" d="${d}"/>` : ""}${e.material === "ventanal" && d ? `<path stroke="#fff" stroke-width="${w * 0.4}" fill="none" d="${d}"/>` : ""}
      ${vid ? `<path stroke="#3d8fd1" stroke-width="${Math.max(1.5, w * 0.35)}" fill="none" d="${vid}"/>` : ""}${pue ? `<path stroke="#6c5a3d" stroke-width="1.2" fill="none" d="${pue}"/>` : ""}</g>`;
  }
  const { X, Y, W, H } = px(e), col = ELEM[e.tipo] || ELEM.otro;
  if (e.tipo === "techo") {   // techo: solo su contorno punteado con la cruz de proyección
    const c = e.estado === "existe" ? "#4d565e" : e.estado === "en_proceso" ? "#b26b00" : "#8ea3b8";
    return `<g class="elem" stroke="${c}" stroke-width="2" stroke-dasharray="10 7" fill="none"><rect x="${X}" y="${Y}" width="${W}" height="${H}"/><path d="M${X} ${Y}L${X + W} ${Y + H}M${X + W} ${Y}L${X} ${Y + H}" stroke-opacity=".5"/></g>`;
  }
  const falta = e.estado === "falta", proceso = e.estado === "en_proceso";
  const trazo = falta ? `stroke="${col}" stroke-width="2.5" stroke-dasharray="8 6" fill="${col}" fill-opacity=".08"`
    : proceso ? `stroke="${col}" stroke-width="3" fill="url(#rayado)"` : `stroke="${col}" stroke-width="3" fill="${col}" fill-opacity=".28"`;
  let detalle = "";
  if (e.tipo === "grada") { // escalones
    const vertical = H > W, n = Math.max(3, Math.round((vertical ? H : W) / 14));
    for (let i = 1; i < n; i++) detalle += vertical ? `<line x1="${X}" y1="${Y + (H * i) / n}" x2="${X + W}" y2="${Y + (H * i) / n}"/>` : `<line x1="${X + (W * i) / n}" y1="${Y}" x2="${X + (W * i) / n}" y2="${Y + H}"/>`;
    detalle = `<g stroke="${col}" stroke-width="1.6" ${falta ? 'stroke-dasharray="4 4"' : ""}>${detalle}</g>`;
  } else if (e.tipo === "bano") detalle = `<text class="et chico" x="${X + W / 2}" y="${Y + H / 2}" font-size="${Math.max(12, Math.min(26, Math.min(W, H) * 0.4))}" text-anchor="middle" dominant-baseline="middle">WC</text>`;
  else if (e.tipo === "jardinera") { const n = Math.max(1, Math.round(W / 26));
    detalle = `<g fill="${col}" opacity="${falta ? 0.35 : 0.85}">${Array.from({ length: n }, (_, i) => `<circle cx="${X + (W * (i + 0.5)) / n}" cy="${Y + H / 2}" r="${Math.min(10, H * 0.35)}"/>`).join("")}</g>`; }
  return `<g class="elem"><rect x="${X}" y="${Y}" width="${W}" height="${H}" rx="2" ${trazo}/>${detalle}</g>`;
}

const M = 0.056;   // metros por unidad del mapa
// Rampa dibujada como rampa: piso de concreto ranurado, sentido de subida y rótulo
function rampa(X, Y, W, H) {
  const vertical = H >= W, paso = 11; let s = `<rect x="${X}" y="${Y}" width="${W}" height="${H}" fill="#e3ded2"/>`;
  if (vertical) for (let y = Y + paso; y < Y + H; y += paso) s += `<line x1="${X + 4}" y1="${y}" x2="${X + W - 4}" y2="${y}" stroke="#c9c2b2" stroke-width="1.4"/>`;
  else for (let x = X + paso; x < X + W; x += paso) s += `<line x1="${x}" y1="${Y + 4}" x2="${x}" y2="${Y + H - 4}" stroke="#c9c2b2" stroke-width="1.4"/>`;
  const cx = X + W / 2, cy = Y + H / 2, L = (vertical ? H : W) * 0.55, rot = vertical ? 0 : 90;
  s += `<g transform="translate(${cx} ${cy}) rotate(${rot})" fill="none" stroke="#6b7178" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <line x1="0" y1="${L / 2}" x2="0" y2="${-L / 2}"/><path d="M -14 ${-L / 2 + 16} L 0 ${-L / 2} L 14 ${-L / 2 + 16}"/></g>`;
  s += `<rect x="${X + 1}" y="${Y + 1}" width="${W - 2}" height="${H - 2}" fill="none" stroke="#8a8f96" stroke-width="2"/>`;
  return s;
}

// Estado de una pieza: lo marcado a mano manda; si no, lo que dice el plano (existe hoy o falta)
export const estadoPieza = (i, piezas = {}) => piezas[i] || (TRAZO[i][4] ? "existe" : "falta");
export const PIEZAS = TRAZO;

// Caja (límites) y largo de cada pieza, para saber qué piezas forman un mismo objeto
const NUM = /-?\d+\.?\d*/g;
export const CAJAS = TRAZO.map(([, , , d]) => {
  const v = (d.match(NUM) || []).map(Number); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i + 1 < v.length; i += 2) { x0 = Math.min(x0, v[i]); x1 = Math.max(x1, v[i]); y0 = Math.min(y0, v[i + 1]); y1 = Math.max(y1, v[i + 1]); }
  return { x0, y0, x1, y1, largo: Math.max(x1 - x0, y1 - y0) };
});
// Objeto completo a partir de una pieza tocada: piezas pegadas (a menos de 8 unidades ≈ 45 cm)
// que no sean mucho más largas que la tocada. Así una grada toma todos sus escalones,
// pero tocar un escalón no arrastra la pared de al lado.
// Rayas de rampa: líneas finas sueltas, rectas, paralelas y del mismo largo, cada vez más juntas (así se dibuja una rampa).
// Todas las rayas de una rampa son un solo objeto: se marcan juntas y se llama "Rampa", no "Gradas".
export const RAMPAS = (() => {
  const L = [];
  TRAZO.forEach(([c, , , d], i) => {
    const m = c === "fino" && d.match(/^M(-?[\d.]+) (-?[\d.]+)L(-?[\d.]+) (-?[\d.]+)$/); if (!m) return;
    const [a, b, e, f] = m.slice(1).map(Number), v = Math.abs(a - e) < 0.6, h = Math.abs(b - f) < 0.6; if (!v && !h) return;
    if ((v ? Math.abs(b - f) : Math.abs(a - e)) < 20) return;
    L.push({ i, v, pos: v ? (a + e) / 2 : (b + f) / 2, lo: v ? Math.min(b, f) : Math.min(a, e), hi: v ? Math.max(b, f) : Math.max(a, e) });
  });
  const usadas = new Set(), out = [];
  for (const s of L) {
    if (usadas.has(s.i)) continue;
    const g = [s]; let otra = true;
    while (otra) { otra = false; for (const t of L) if (!usadas.has(t.i) && !g.includes(t) && t.v === s.v && Math.abs(t.lo - s.lo) < 2 && Math.abs(t.hi - s.hi) < 2 && g.some((u) => Math.abs(u.pos - t.pos) < 35)) { g.push(t); otra = true; } }
    const ps = g.map((u) => u.pos).sort((a, b) => a - b), gaps = ps.slice(1).map((p, k) => p - ps[k]);
    if (g.length < 6 || Math.min(...gaps) < 0.5) continue;
    g.forEach((u) => usadas.add(u.i));
    const lo = Math.min(...g.map((u) => u.lo)), hi = Math.max(...g.map((u) => u.hi));
    out.push({ piezas: g.map((u) => u.i), eje: s.v ? "x" : "y", c: s.v ? { x0: ps[0], x1: ps.at(-1), y0: lo, y1: hi } : { x0: lo, x1: hi, y0: ps[0], y1: ps.at(-1) } });
  }
  return out;
})();
export const rampaDe = (i) => RAMPAS.find((r) => r.piezas.includes(i));
// Cuadritos sueltos marcados como pared en el plano (bases, postes, detalles) y puntitos marcados como columna: no son ni paredes ni columnas.
// Una pieza de pared es "chica" si todo lo que va pegado a ella (paredes, sin límite) cabe en 1.7 m.
export const CHICAS = (() => {
  const ms = TRAZO.map(([c], i) => (c === "muro" ? i : -1)).filter((i) => i >= 0), padre = new Map(ms.map((i) => [i, i]));
  const raiz = (i) => { while (padre.get(i) !== i) i = padre.get(i); return i; };
  for (let a = 0; a < ms.length; a++) for (let b = a + 1; b < ms.length; b++) {
    const p = CAJAS[ms[a]], q = CAJAS[ms[b]];
    if (p.x0 <= q.x1 + 3 && p.x1 >= q.x0 - 3 && p.y0 <= q.y1 + 3 && p.y1 >= q.y0 - 3) padre.set(raiz(ms[a]), raiz(ms[b]));
  }
  const caja = new Map();
  for (const i of ms) { const r = raiz(i), c = CAJAS[i], k = caja.get(r) || { x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1 }; caja.set(r, { x0: Math.min(k.x0, c.x0), y0: Math.min(k.y0, c.y0), x1: Math.max(k.x1, c.x1), y1: Math.max(k.y1, c.y1) }); }
  const chicas = new Set(ms.filter((i) => { const k = caja.get(raiz(i)); return Math.max(k.x1 - k.x0, k.y1 - k.y0) < 30; }));
  TRAZO.forEach(([c], i) => { if (c === "columna" && CAJAS[i].largo < 4.5) chicas.add(i); });   // puntitos y marcas de menos de 25 cm: no son columnas
  return chicas;
})();
const GRUPOS = new Map();
export function grupoDe(i) {
  if (!GRUPOS.has(i)) GRUPOS.set(i, rampaDe(i)?.piezas || calcularGrupo(i));
  return GRUPOS.get(i);
}
function calcularGrupo(i) {
  const base = CAJAS[i], esMuro = TRAZO[i][0] === "muro", esLamina = TRAZO[i][0] === "lamina", tope = Math.max(base.largo * 4, 30), M = 5;
  const R = Math.max(25, base.largo * 1.2);   // el objeto no se sale de alrededor de lo tocado
  const lim = { x0: base.x0 - R, y0: base.y0 - R, x1: base.x1 + R, y1: base.y1 + R };
  const grupo = new Set([i]), cola = [i];
  while (cola.length && grupo.size < 30) {
    const c = CAJAS[cola.shift()];
    CAJAS.forEach((o, j) => {
      const clase = TRAZO[j][0];
      if (grupo.has(j) || clase === "jardin" || o.largo > tope) return;
      if ((clase === "muro") !== esMuro || (clase === "lamina") !== esLamina) return;   // paredes con paredes; puertas y gradas aparte
      if (o.x0 < lim.x0 || o.x1 > lim.x1 || o.y0 < lim.y0 || o.y1 > lim.y1) return;
      if (o.x0 <= c.x1 + M && o.x1 >= c.x0 - M && o.y0 <= c.y1 + M && o.y1 >= c.y0 - M) { grupo.add(j); cola.push(j); }
    });
  }
  return [...grupo];
}
// Pieza más cercana a un punto del plano (unidades del mapa), a menos de "radio". Sirve para tocar en 3D.
const SEGS = [];
const segmentos = (i) => SEGS[i] ||= (() => {
  const t = TRAZO[i][3].match(/[MLCZ]|-?\d+\.?\d*/g) || [], out = []; let ini = null, cur = null, k = 0;
  while (k < t.length) {
    const c = t[k++];
    if (c === "M") { ini = cur = [+t[k], +t[k + 1]]; k += 2; }
    else if (c === "L") { const n = [+t[k], +t[k + 1]]; out.push([cur, n]); cur = n; k += 2; }
    else if (c === "C") { const n = [+t[k + 4], +t[k + 5]]; out.push([cur, n]); cur = n; k += 6; }
    else if (c === "Z") { if (ini && cur) out.push([cur, ini]); cur = ini; }
    else if (cur) { const n = [+c, +t[k]]; out.push([cur, n]); cur = n; k += 1; }
  }
  return out;
})();
const distSeg = (x, y, [a, b]) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L)) : 0;
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
};
export function piezaEn(x, y, radio = 12) {
  let mejor = -1, d = radio;
  CAJAS.forEach((c, i) => {
    if (TRAZO[i][0] === "jardin" || x < c.x0 - d || x > c.x1 + d || y < c.y0 - d || y > c.y1 + d) return;
    for (const s of segmentos(i)) { const e = distSeg(x, y, s); if (e < d) { d = e; mejor = i; } }
  });
  return mejor;
}
export { segmentos };
// Puntas de todas las piezas (para que una pared nueva se pegue a lo que ya está dibujado)
let PUNTAS = null;
export function pegar(x, y, radio = 9, extra = []) {
  PUNTAS ||= TRAZO.flatMap(([c], i) => c === "jardin" ? [] : segmentos(i).flat());
  let mejor = null, d = radio;
  for (const p of PUNTAS.concat(extra)) { const e = Math.hypot(p[0] - x, p[1] - y); if (e < d) { d = e; mejor = p; } }
  return mejor ? [mejor[0], mejor[1]] : [x, y];
}

// Qué es (para el título de la hoja)
export function queEs(grupo) {
  const clases = grupo.map((i) => TRAZO[i][0]);
  if (rampaDe(grupo[0])) return "Rampa";
  if (grupo.some((i) => CHICAS.has(i)) && grupo.every((i) => CHICAS.has(i) || !["muro", "columna"].includes(TRAZO[i][0]))) return "Detalle del plano";
  if (TRAZO[grupo[0]][0] === "grada" || clases.includes("grada")) return "Gradas";
  if (TRAZO[grupo[0]][0] === "lamina") return "Pared de murito y lámina";
  if (TRAZO[grupo[0]][0] === "muro") return "Pared";
  const cortasParalelas = grupo.filter((i) => TRAZO[i][0] === "borde" && CAJAS[i].largo < 40).length;
  if (cortasParalelas >= 3) return "Gradas";
  if (grupo.some((i) => TRAZO[i][0] === "fino" && /C/.test(TRAZO[i][3]))) return "Puerta";
  if (clases.includes("columna")) return "Columna";
  if (clases.includes("muro")) return "Pared";
  return "Detalle del plano";
}

// Capa tocable para Editar plano: cada pieza con un trazo ancho invisible para poder tocarla
export function capaPiezas(piezas = {}, seleccion = []) {
  const sel = new Set(seleccion);
  return `<svg class="capa-piezas" viewBox="0 0 ${ANCHO} ${ALTO}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${TRAZO.map(([c, , , d], i) =>
    c === "jardin" ? "" : `<path class="pz ${estadoPieza(i, piezas)}${sel.has(i) ? " sel" : ""}" data-pz="${i}" d="${d}"/>`).join("")}</svg>`;
}

export function dibujarObra(areas, elementos = [], piezas = {}) {
  const zonas = areas.map((a) => ({ a, ...px(a) }));
  const grupos = {};
  TRAZO.forEach(([clase, , , d], i) => { (grupos[estadoPieza(i, piezas) + "|" + clase] ||= []).push(d); });
  const trazo = ["falta", "en_proceso", "existe"].flatMap((e) => ["jardin", "fino", "grada", "borde", "lamina", "muro", "columna"].map((c) => {
    const ds = grupos[e + "|" + c]; return ds ? `<path ${ESTILO[e][c]} ${c === "columna" ? "" : 'fill="none"'} stroke-linecap="round" d="${ds.join("")}"/>` : "";
  })).join("");
  const arboles = Array.from({ length: 12 }, (_, i) => `<circle cx="${42 + (i % 2) * 10}" cy="${120 + i * 112}" r="${17 + (i % 3) * 3}" fill="#6f9a4c"/><circle cx="${38 + (i % 2) * 10}" cy="${115 + i * 112}" r="8" fill="#89b263"/>`).join("");

  return `<svg class="mundo" viewBox="0 0 ${ANCHO} ${ALTO}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <style>.mundo .et{font-family:Manrope,Arial,sans-serif;font-weight:700;letter-spacing:.06em;fill:#1d2125;paint-order:stroke;stroke:#f7f6f2f0;stroke-width:5px;stroke-linejoin:round}.mundo .et .m2{font-family:'DM Mono',monospace;font-weight:500;letter-spacing:0;fill:#6b7178}.mundo .et.apagada{fill:#6d859c}.mundo .et.chico{stroke-width:4px}.mundo .et.calle{fill:#ffffffcc;stroke:none;font-weight:500;letter-spacing:.2em}</style>
    <pattern id="rayado" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="14" height="14" fill="#f2c23022"/><rect width="5" height="14" fill="#f2c23088"/></pattern>
  </defs>
  <rect width="${ANCHO}" height="${ALTO}" fill="${C.acera}"/>
  <rect x="0" y="0" width="80" height="${ALTO}" fill="${C.zacate}"/>${arboles}
  <rect x="0" y="1455" width="${ANCHO}" height="65" fill="${C.calle}"/>
  <line x1="0" y1="1487" x2="${ANCHO}" y2="1487" stroke="${C.amarillo}" stroke-width="3" stroke-dasharray="26 18"/>
  <text class="et calle" x="${ANCHO / 2}" y="1488" font-size="20" text-anchor="middle" dominant-baseline="middle">CALLE DE ACCESO</text>
  <text class="et calle" x="22" y="${ALTO / 2}" font-size="20" text-anchor="middle" dominant-baseline="middle" transform="rotate(-90 22 ${ALTO / 2})">BOULEVARD SANTA ELENA</text>
  <rect x="${LOTE.x}" y="${LOTE.y}" width="${LOTE.w}" height="${LOTE.h}" fill="${C.lote}"/>
  ${zonas.map((z) => z.a.tipo === "rampa" && !z.a.es_receso ? rampa(z.X + 2, z.Y + 2, z.W - 4, z.H - 4) : `<rect x="${z.X + 2}" y="${z.Y + 2}" width="${z.W - 4}" height="${z.H - 4}" fill="${z.a.es_receso ? "#fbe3c8" : C.tinte[z.a.tipo] || C.lote}"/>
`).join("")}
  ${trazo}
  ${(elementos || []).map(elemento).join("")}
  ${zonas.map((z) => etiqueta(z.a.es_receso ? z.a.uso_actual || "Bodega (receso)" : z.a.nombre, z.X, z.Y, z.W, z.H, false)).join("")}
</svg>`;
}

// ---------- Medidas (para el globito al pasar el mouse) ----------
const fm = (m) => (m >= 10 ? m.toFixed(1) : m.toFixed(2)).replace(/\.?0+$/, "") + " m";
// Pieza o grupo del plano: largo (y grueso si es pared); si es un recuadro, ancho × largo y m²
export function medidasPieza(grupo) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const i of grupo) { const c = CAJAS[i]; x0 = Math.min(x0, c.x0); y0 = Math.min(y0, c.y0); x1 = Math.max(x1, c.x1); y1 = Math.max(y1, c.y1); }
  const a = (x1 - x0) * M, b = (y1 - y0) * M, L = Math.max(a, b), G = Math.min(a, b), pared = grupo.some((i) => ["muro", "lamina", "fino", "borde"].includes(TRAZO[i][0]));
  if (pared && G < 0.6) return `Largo ${fm(L)}${G > 0.05 ? ` · grueso ${Math.round(G * 100)} cm` : ""}`;
  return `${fm(a)} × ${fm(b)} · ${Math.round(a * b * 10) / 10} m²`;
}
// Área (en %) o elemento: ancho × largo y m²; pared dibujada: largo, alto y grueso
export function medidasArea(a) { const w = a.w / 100 * ANCHO * M, h = a.h / 100 * ALTO * M; return `${fm(w)} × ${fm(h)} · ${Math.round(w * h)} m²`; }
export function medidasElemento(e) {
  if (e.trazo) return `Largo ${fm(largoPared(e))}${e.alto ? ` · alto ${fm(+e.alto)}` : ""}${e.grueso ? ` · grueso ${Math.round(e.grueso * 100)} cm` : ""}`;
  return medidasArea(e) + (e.alto ? ` · alto ${fm(+e.alto)}` : "");
}
