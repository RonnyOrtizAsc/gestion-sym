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
  existe:     { muro: 'stroke="#1f2327" stroke-width="3.4"', fino: 'stroke="#6b7178" stroke-width="1"', borde: 'stroke="#454a50" stroke-width="2"', columna: 'stroke="#1d2125" stroke-width="2.2" fill="#1d2125"', jardin: 'stroke="#3f7d32" stroke-width="1.3"' },
  en_proceso: { muro: 'stroke="#b26b00" stroke-width="2.6"', fino: 'stroke="#c48a2c" stroke-width="1.2"', borde: 'stroke="#b26b00" stroke-width="2.6"', columna: 'stroke="#b26b00" stroke-width="2.2" fill="#b26b00"', jardin: 'stroke="#8aa64a" stroke-width="1.3"' },
  // lo que falta se ve transparente: es el proyecto final "en espera"
  falta:      { muro: 'stroke="#8ea3b8" stroke-opacity=".5" stroke-width="2.4"', fino: 'stroke="#9fb0c2" stroke-opacity=".45" stroke-width="1"', borde: 'stroke="#8ea3b8" stroke-opacity=".5" stroke-width="1.8"', columna: 'stroke="#8ea3b8" stroke-opacity=".5" stroke-width="1.6" fill="#8ea3b8" fill-opacity=".2"', jardin: 'stroke="#7fae6c" stroke-opacity=".35" stroke-width="1"' },
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

function elemento(e) {
  const { X, Y, W, H } = px(e), col = ELEM[e.tipo] || ELEM.otro;
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

// Capa tocable para Editar plano: cada pieza con un trazo ancho invisible para poder tocarla
export function capaPiezas(piezas = {}) {
  return `<svg class="capa-piezas" viewBox="0 0 ${ANCHO} ${ALTO}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${TRAZO.map(([c, , , d], i) =>
    c === "jardin" ? "" : `<path class="pz ${estadoPieza(i, piezas)}" data-pz="${i}" d="${d}"/>`).join("")}</svg>`;
}

export function dibujarObra(areas, elementos = [], piezas = {}) {
  const zonas = areas.map((a) => ({ a, ...px(a) }));
  const grupos = {};
  TRAZO.forEach(([clase, , , d], i) => { (grupos[estadoPieza(i, piezas) + "|" + clase] ||= []).push(d); });
  const trazo = ["falta", "en_proceso", "existe"].flatMap((e) => ["jardin", "fino", "borde", "muro", "columna"].map((c) => {
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
