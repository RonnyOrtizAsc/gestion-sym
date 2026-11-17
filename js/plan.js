// Plan de obra: cálculos con fechas y avance (sin tocar la base de datos).
// Se trabaja de lunes a sábado; el domingo no cuenta como día de trabajo.

export const ESTADO_ACT = { pendiente: "Pendiente", en_proceso: "En proceso", detenida: "Detenida", terminada: "Terminada" };
export const MOTIVOS = ["Falta material", "Falta instrucción", "Falta herramienta o equipo", "Esperando otra cuadrilla", "Clima", "Otro"];

const p2 = (n) => String(n).padStart(2, "0");
export const iso = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const deISO = (s) => { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
export const hoyISO = () => iso(new Date());
export const sumarDias = (s, n) => { const d = deISO(s); d.setDate(d.getDate() + n); return iso(d); };
export const esDomingo = (s) => deISO(s).getDay() === 0;

// Siguiente día de trabajo (si hoy es sábado, el lunes)
export function siguienteDia(s) { let d = sumarDias(s, 1); while (esDomingo(d)) d = sumarDias(d, 1); return d; }

// Días de trabajo entre dos fechas, contando las dos
export function diasTrabajo(a, b) {
  let n = 0;
  for (let d = a; d <= b; d = sumarDias(d, 1)) if (!esDomingo(d)) n++;
  return n;
}

// Fecha de fin a partir del inicio y los días de trabajo que dura
export function finPorDias(inicio, dias) {
  let d = inicio, n = esDomingo(d) ? 0 : 1;
  while (n < Math.max(1, dias)) { d = sumarDias(d, 1); if (!esDomingo(d)) n++; }
  return d;
}

// Avance real en %: si tiene cantidad, hecho/cantidad; si no, "hecho" ya es el %
export function avance(a) {
  if (a.estado === "terminada") return 100;
  const v = a.cantidad ? (+a.hecho / +a.cantidad) * 100 : +a.hecho;
  return Math.max(0, Math.min(100, Math.round(v || 0)));
}

// Cuánto debería llevar al terminar el día "dia", según sus fechas (reparte parejo por día de trabajo)
export function esperado(a, dia = hoyISO()) {
  if (dia < a.inicio) return 0;
  if (dia >= a.fin) return 100;
  const total = diasTrabajo(a.inicio, a.fin) || 1;
  return Math.round((diasTrabajo(a.inicio, dia) / total) * 100);
}

export const abierta = (a) => a.estado !== "terminada";
export const vencida = (a, dia = hoyISO()) => abierta(a) && a.fin < dia;
// Va atrasada: venció, o lleva 10 puntos menos de lo que debería
export const atrasada = (a, dia = hoyISO()) => abierta(a) && dia >= a.inicio && (vencida(a, dia) || avance(a) < esperado(a, dia) - 10);

// Lo que toca hoy: las que están dentro de sus fechas, las vencidas sin terminar
// y las que ya se empezaron antes de tiempo
export const tocaHoy = (a, dia = hoyISO()) => abierta(a) && ((a.inicio <= dia && a.fin >= dia) || vencida(a, dia) || a.estado === "en_proceso" || a.estado === "detenida");
export const tocaEl = (a, dia) => abierta(a) && a.inicio <= dia && a.fin >= dia;

// Orden para el supervisor: primero lo que necesita atención
export function prioridad(a, dia = hoyISO()) {
  if (a.estado === "detenida") return 0;
  if (vencida(a, dia)) return 1;
  if (atrasada(a, dia)) return 2;
  if (a.estado === "pendiente") return 3;
  return 4;
}

export const fechaCorta = (s) => deISO(s).toLocaleDateString("es-SV", { weekday: "short", day: "numeric", month: "short" });
export const fechaLarga = (s) => deISO(s).toLocaleDateString("es-SV", { weekday: "long", day: "numeric", month: "long" });
const fmt = (n) => (+n).toLocaleString("es-SV", { maximumFractionDigits: 2 });
// "45 de 120 m²" o "40 %"
export const textoAvance = (a) => a.cantidad ? `${fmt(a.estado === "terminada" ? a.cantidad : a.hecho)} de ${fmt(a.cantidad)} ${a.unidad || ""}`.trim() : `${avance(a)} %`;

// Fechas del Planificador (Google Sheets): "2026-11-17", "2026-11-17T06:00:00.000Z" o "17/11/2026"
export function fechaPlanificador(v) {
  if (!v) return null;
  const t = String(v).trim();
  let m = t.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${p2(m[2])}-${p2(m[3])}`;
  m = t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) return `${m[3]}-${p2(m[2])}-${p2(m[1])}`;
  const d = new Date(t);
  return isNaN(d) ? null : iso(d);
}
