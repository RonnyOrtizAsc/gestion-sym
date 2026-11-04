// Dibuja la obra como un mapa propio (estilo juego) a partir de las áreas guardadas.
// Unidades: el mapa mide 1388 × 1520 (desde la línea M1 hasta la calle); cada área viene en % (x, y, w, h).
import { esc } from "../util.js";

export const ANCHO = 1388, ALTO = 1520;
const LOTE = { x: 85, y: 5, w: 1250, h: 1440 };

// Colores del "mundo" (el mapa es un tablero y se ve igual en modo claro y oscuro)
const C = {
  calle: "#3b4046", acera: "#d9dccf", zacate: "#a9c47f", lote: "#e7e3da", linea: "#ffffff", amarillo: "#f2c230",
  sala: "#f7f4ec", salaJunta: "#e7e0d0", vidrio: "#5aa1d6",
  exhibicion: "#eceae4", adoquin: "#dcd8ce",
  oficinas: "#efe0c7", tabique: "#a88d63", escritorio: "#c9b089",
  parqueo: "#575c63", taller: "#9aa3ab", rampa: "#cfcbc1", patio: "#6c7279", lavado: "#9ccbe6", agua: "#4f9fd0",
  servicio: "#d6d1c6", entrega: "#e4e8eb", muro: "#2f3337", texto: "#1d2125",
};
const COCHES = ["#f4f4f2", "#c7ccd1", "#c8453b", "#3a6ea5", "#24272b", "#e3e0d6", "#7d8a96"];
const INTERIOR = new Set(["sala", "oficinas", "taller", "servicio"]);

// Números pseudoaleatorios fijos por área (el mapa no cambia entre recargas)
function rng(semilla) { let h = 2166136261; for (const c of String(semilla)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296; }

// La obra está libre de carros: no se dibujan (se deja la función por si se usan después)
const MOSTRAR_COCHES = false;
function coche(x, y, ang, color) {
  if (!MOSTRAR_COCHES) return "";
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${ang})"><rect x="-15" y="-29" width="30" height="58" rx="9" fill="${color}" stroke="#00000033" stroke-width="1.5"/>
    <rect x="-11" y="-17" width="22" height="13" rx="3" fill="#2a3a48" opacity=".8"/><rect x="-11" y="12" width="22" height="9" rx="3" fill="#2a3a48" opacity=".65"/></g>`;
}

function parqueo(X, Y, W, H, r) {
  let s = ""; const plaza = 34, fondo = 66;
  const horizontal = W >= H, largo = horizontal ? W : H, ancho = horizontal ? H : W;
  const filas = ancho >= fondo * 2 + 50 ? 2 : 1, n = Math.floor((largo - 12) / plaza), ini = (largo - n * plaza) / 2;
  for (let f = 0; f < filas; f++) {
    for (let i = 0; i <= n; i++) {
      const p = ini + i * plaza;
      if (horizontal) { const y0 = f === 0 ? Y + 6 : Y + H - 6 - fondo; s += `<line x1="${X + p}" y1="${y0}" x2="${X + p}" y2="${y0 + fondo}" stroke="${C.linea}" stroke-width="2.5"/>`; }
      else { const x0 = f === 0 ? X + 6 : X + W - 6 - fondo; s += `<line x1="${x0}" y1="${Y + p}" x2="${x0 + fondo}" y2="${Y + p}" stroke="${C.linea}" stroke-width="2.5"/>`; }
    }
    for (let i = 0; i < n; i++) {
      if (r() > 0.55) continue;
      const c = ini + i * plaza + plaza / 2, col = COCHES[Math.floor(r() * COCHES.length)];
      s += horizontal ? coche(X + c, f === 0 ? Y + 6 + fondo / 2 : Y + H - 6 - fondo / 2, 0, col)
                      : coche(f === 0 ? X + 6 + fondo / 2 : X + W - 6 - fondo / 2, Y + c, 90, col);
    }
  }
  return s;
}

function cochesEnRejilla(X, Y, W, H, r, ang, paso = 95) {
  let s = ""; const cols = Math.max(1, Math.floor(W / paso)), filas = Math.max(1, Math.floor(H / (paso * 1.15)));
  for (let i = 0; i < cols; i++) for (let j = 0; j < filas; j++) {
    if (r() > 0.85) continue;
    s += coche(X + (W * (i + 0.5)) / cols, Y + (H * (j + 0.55)) / filas, ang + (r() - 0.5) * 6, COCHES[Math.floor(r() * COCHES.length)]);
  }
  return s;
}

function flechas(X, Y, W, H, color = "#ffffffcc") {
  let s = ""; const vertical = H > W, n = Math.max(1, Math.floor((vertical ? H : W) / 140));
  for (let i = 0; i < n; i++) {
    const cx = vertical ? X + W / 2 : X + (W * (i + 0.5)) / n, cy = vertical ? Y + (H * (i + 0.5)) / n : Y + H / 2;
    s += `<path d="M -16 8 L 0 -10 L 16 8" transform="translate(${cx} ${cy}) rotate(${vertical ? 0 : 90})" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  return s;
}

function relleno(a, X, Y, W, H) {
  const r = rng(a.id); let s = "";
  switch (a.tipo) {
    case "sala":
      s += `<rect x="${X}" y="${Y}" width="${W}" height="${H}" fill="url(#baldosa)"/>`;
      s += cochesEnRejilla(X + 20, Y + 24, W - 40, H - 40, r, 35, 78);
      s += `<rect x="${X + 3}" y="${Y + 3}" width="${W - 6}" height="${H - 6}" fill="none" stroke="${C.vidrio}" stroke-width="6" stroke-dasharray="40 8"/>`;
      break;
    case "exhibicion":
      s += `<rect x="${X}" y="${Y}" width="${W}" height="${H}" fill="url(#adoquin)"/>` + cochesEnRejilla(X + 10, Y + 16, W - 20, H - 24, r, 30, 72); break;
    case "entrega":
      s += `<rect x="${X + 12}" y="${Y + 12}" width="${W - 24}" height="${H - 24}" fill="none" stroke="${C.amarillo}" stroke-width="4" stroke-dasharray="14 10"/>` + cochesEnRejilla(X + 20, Y + 20, W - 40, H - 40, r, 0, 90); break;
    case "oficinas": {
      const cols = Math.max(1, Math.round(W / 85)), filas = Math.max(1, Math.round(H / 80));
      for (let i = 1; i < cols; i++) s += `<line x1="${X + (W * i) / cols}" y1="${Y}" x2="${X + (W * i) / cols}" y2="${Y + H}" stroke="${C.tabique}" stroke-width="3"/>`;
      for (let j = 1; j < filas; j++) s += `<line x1="${X}" y1="${Y + (H * j) / filas}" x2="${X + W}" y2="${Y + (H * j) / filas}" stroke="${C.tabique}" stroke-width="3"/>`;
      for (let i = 0; i < cols; i++) for (let j = 0; j < filas; j++) if (r() < 0.75) {
        const cx = X + (W * (i + 0.5)) / cols, cy = Y + (H * (j + 0.5)) / filas;
        s += `<rect x="${cx - 16}" y="${cy - 9}" width="32" height="18" rx="3" fill="${C.escritorio}"/><circle cx="${cx}" cy="${cy + 17}" r="6" fill="${C.tabique}"/>`;
      }
      break;
    }
    case "parqueo": s += parqueo(X, Y, W, H, r); break;
    case "taller": {
      const cols = Math.max(1, Math.floor(W / 120)), filas = Math.max(1, Math.floor(H / 200));
      for (let i = 0; i < cols; i++) for (let j = 0; j < filas; j++) {
        const bx = X + (W * i) / cols + 14, by = Y + (H * j) / filas + 18, bw = W / cols - 28, bh = H / filas - 36;
        s += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="none" stroke="${C.amarillo}" stroke-width="4"/>
          <rect x="${bx + bw * 0.2}" y="${by + 14}" width="8" height="${bh - 28}" fill="#596068"/><rect x="${bx + bw * 0.8 - 8}" y="${by + 14}" width="8" height="${bh - 28}" fill="#596068"/>`;
        if (r() < 0.6) s += coche(bx + bw / 2, by + bh / 2, 0, COCHES[Math.floor(r() * COCHES.length)]);
      }
      break;
    }
    case "rampa": s += `<rect x="${X}" y="${Y}" width="${W}" height="${H}" fill="url(#rayas)"/>` + flechas(X, Y, W, H, "#7a776f"); break;
    case "patio": s += flechas(X, Y, W, H); break;
    case "lavado": {
      const n = Math.max(1, Math.floor(W / 80));
      for (let i = 0; i < n; i++) { const cx = X + (W * (i + 0.5)) / n;
        s += `<rect x="${cx - 32}" y="${Y + 10}" width="64" height="${H - 20}" fill="none" stroke="#ffffffaa" stroke-width="3"/>
          <path d="M ${cx - 20} ${Y + H / 2} q 10 -12 20 0 t 20 0" fill="none" stroke="${C.agua}" stroke-width="4"/>`; }
      break;
    }
    case "servicio": {
      const n = Math.max(1, Math.floor(W / 110));
      for (let i = 0; i < n; i++) s += `<rect x="${X + (W * i) / n + 14}" y="${Y + H * 0.42}" width="${W / n - 28}" height="${H * 0.5}" fill="none" stroke="${C.amarillo}" stroke-width="4" stroke-dasharray="12 8"/>`;
      s += cochesEnRejilla(X + 20, Y + H * 0.45, W - 40, H * 0.45, r, 0, 130);
      break;
    }
  }
  return s;
}

function etiqueta(a, X, Y, W, H, nombre) {
  const larga = Math.max(...nombre.split(" ").map((p) => p.length));
  const fs = Math.max(12, Math.min(46, Math.min(W, H) * 0.2, (W * 0.92) / (larga * 0.6)));
  const porLinea = Math.max(6, Math.floor(W / (fs * 0.56)));
  const lineas = []; let actual = "";
  for (const p of nombre.split(" ")) { if ((actual + " " + p).trim().length > porLinea && actual) { lineas.push(actual); actual = p; } else actual = (actual + " " + p).trim(); }
  if (actual) lineas.push(actual);
  const y0 = Y + H / 2 - ((lineas.length - 1) * fs * 1.1) / 2;
  return `<text class="et" x="${X + W / 2}" y="${y0}" font-size="${fs.toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${lineas.map((l, i) => `<tspan x="${X + W / 2}" dy="${i ? fs * 1.1 : 0}">${esc(l)}</tspan>`).join("")}</text>`;
}

export function dibujarObra(areas) {
  const bloques = areas.map((a) => {
    const X = (a.x / 100) * ANCHO, Y = (a.y / 100) * ALTO, W = (a.w / 100) * ANCHO, H = (a.h / 100) * ALTO;
    const g = 3, fondo = a.es_receso ? "#f6dcc0" : C[a.tipo] || C.lote, interior = INTERIOR.has(a.tipo) || a.es_receso;
    const nombre = a.es_receso ? a.uso_actual || "Bodega (receso)" : a.nombre;
    return { a, X, Y, W, H, nombre, svg: `<g${interior ? ' filter="url(#sombra)"' : ""}>
      <rect x="${X + g}" y="${Y + g}" width="${W - 2 * g}" height="${H - 2 * g}" fill="${fondo}" ${interior ? `stroke="${C.muro}" stroke-width="5"` : ""} rx="${interior ? 2 : 6}"/>
      ${a.es_receso ? "" : relleno(a, X + g, Y + g, W - 2 * g, H - 2 * g)}</g>` };
  });
  const arboles = Array.from({ length: 12 }, (_, i) => `<circle cx="${42 + (i % 2) * 10}" cy="${120 + i * 112}" r="${17 + (i % 3) * 3}" fill="#6f9a4c"/><circle cx="${38 + (i % 2) * 10}" cy="${115 + i * 112}" r="${8}" fill="#89b263"/>`).join("");
  return `<svg class="mundo" viewBox="0 0 ${ANCHO} ${ALTO}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <style>.mundo .et{font-family:Manrope,Arial,sans-serif;font-weight:800;fill:#1d2125;paint-order:stroke;stroke:#ffffffe6;stroke-width:6px;stroke-linejoin:round}.mundo .et.calle{fill:#ffffffcc;stroke:none;font-weight:500;letter-spacing:.2em}</style>
    <filter id="sombra" x="-5%" y="-5%" width="110%" height="110%"><feDropShadow dx="5" dy="7" stdDeviation="4" flood-color="#000" flood-opacity=".28"/></filter>
    <pattern id="baldosa" width="28" height="28" patternUnits="userSpaceOnUse"><rect width="28" height="28" fill="${C.sala}"/><path d="M28 0H0V28" fill="none" stroke="${C.salaJunta}" stroke-width="1.5"/></pattern>
    <pattern id="adoquin" width="24" height="12" patternUnits="userSpaceOnUse"><rect width="24" height="12" fill="${C.exhibicion}"/><path d="M0 12H24M12 0V6M0 6H24M24 6V12" fill="none" stroke="${C.adoquin}" stroke-width="1.2"/></pattern>
    <pattern id="rayas" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="22" height="22" fill="${C.rampa}"/><rect width="8" height="22" fill="#c2bdb1"/></pattern>
  </defs>
  <rect width="${ANCHO}" height="${ALTO}" fill="${C.acera}"/>
  <rect x="0" y="0" width="80" height="${ALTO}" fill="${C.zacate}"/>${arboles}
  <rect x="0" y="1455" width="${ANCHO}" height="65" fill="${C.calle}"/>
  <line x1="0" y1="1487" x2="${ANCHO}" y2="1487" stroke="${C.amarillo}" stroke-width="3" stroke-dasharray="26 18"/>
  <text class="et calle" x="${ANCHO / 2}" y="1488" font-size="20" text-anchor="middle" dominant-baseline="middle">CALLE DE ACCESO</text>
  <text class="et calle" x="22" y="${ALTO / 2}" font-size="20" text-anchor="middle" dominant-baseline="middle" transform="rotate(-90 22 ${ALTO / 2})">BOULEVARD SANTA ELENA</text>
  <rect x="${LOTE.x}" y="${LOTE.y}" width="${LOTE.w}" height="${LOTE.h}" fill="${C.lote}" stroke="#b9b4a8" stroke-width="3" rx="4"/>
  ${bloques.map((b) => b.svg).join("")}
  ${bloques.map((b) => etiqueta(b.a, b.X, b.Y, b.W, b.H, b.nombre)).join("")}
</svg>`;
}
