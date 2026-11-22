// Sol y luna de verdad para la obra (Automall Santa Elena, Antiguo Cuscatlán, El Salvador).
// Posiciones con las fórmulas de SunCalc (V. Agafonkin, basadas en Astronomy Answers): bastan para luz y sombras.
export const LUGAR = { lat: 13.673, lon: -89.24 };
// Según la rosa de los vientos del plano (AR 19-nov), el norte está girado 17° a la derecha de "arriba" del plano.
export const NORTE_PLANO = 17;

const rad = Math.PI / 180, dia = 86400000, J1970 = 2440588, J2000 = 2451545, e = rad * 23.4397;
const toDays = (d) => d.valueOf() / dia - 0.5 + J1970 - J2000;
const ascension = (l, b) => Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
const declinacion = (l, b) => Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
const azimut = (H, phi, dec) => Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
const altura = (H, phi, dec) => Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
const sidereo = (d, lw) => rad * (280.16 + 360.9856235 * d) - lw;
const anomaliaSol = (d) => rad * (357.5291 + 0.98560028 * d);
function longitudSol(M) { const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)); return M + C + rad * 102.9372 + Math.PI; }

// Devuelven { alt, az } en radianes; az medido desde el NORTE hacia el este (como una brújula)
export function sol(fecha = new Date(), { lat, lon } = LUGAR) {
  const lw = rad * -lon, phi = rad * lat, d = toDays(fecha), L = longitudSol(anomaliaSol(d));
  const dec = declinacion(L, 0), ra = ascension(L, 0), H = sidereo(d, lw) - ra;
  return { alt: altura(H, phi, dec), az: azimut(H, phi, dec) + Math.PI };
}
export function luna(fecha = new Date(), { lat, lon } = LUGAR) {
  const lw = rad * -lon, phi = rad * lat, d = toDays(fecha);
  const L = rad * (218.316 + 13.176396 * d), M = rad * (134.963 + 13.064993 * d), F = rad * (93.272 + 13.22935 * d);
  const l = L + rad * 6.289 * Math.sin(M), b = rad * 5.128 * Math.sin(F);
  const dec = declinacion(l, b), ra = ascension(l, b), H = sidereo(d, lw) - ra;
  // fase: 0 = nueva, 0.5 = llena
  const s = sol(fecha, { lat, lon }), dS = toDays(fecha), Ls = longitudSol(anomaliaSol(dS));
  const fase = (((l - Ls) / (2 * Math.PI)) % 1 + 1) % 1;
  return { alt: altura(H, phi, dec), az: azimut(H, phi, dec) + Math.PI, fase, solAlt: s.alt };
}
// Dirección en la escena (x = derecha del plano, z = abajo del plano, y = arriba) para alt/az de brújula
export function direccion(alt, az) {
  const th = az + NORTE_PLANO * rad;   // ángulo desde "arriba del plano", a favor del reloj
  return [Math.cos(alt) * Math.sin(th), Math.sin(alt), -Math.cos(alt) * Math.cos(th)];
}
const mezcla = (a, b, t) => { t = Math.max(0, Math.min(1, t)); const ca = [(a >> 16) & 255, (a >> 8) & 255, a & 255], cb = [(b >> 16) & 255, (b >> 8) & 255, b & 255];
  return (Math.round(ca[0] + (cb[0] - ca[0]) * t) << 16) | (Math.round(ca[1] + (cb[1] - ca[1]) * t) << 8) | Math.round(ca[2] + (cb[2] - ca[2]) * t); };
// Cómo se ve el cielo según la altura del sol (en grados)
export function ambiente(altGrados) {
  const dia = Math.max(0, Math.min(1, (altGrados + 4) / 14));            // 0 de noche … 1 de día (amanecer suave)
  const dorado = Math.max(0, 1 - Math.abs(altGrados - 3) / 9);           // luz naranja cerca del horizonte
  const cieloDia = 0xcfe3ef, cieloNoche = 0x2a3a52, atardecer = 0xf2b98a;
  const cielo = mezcla(mezcla(cieloNoche, cieloDia, dia), atardecer, dorado * 0.55);
  return { dia, dorado, cielo, luzSol: mezcla(0xffffff, 0xffb46b, dorado), hemi: 0.7 + 0.45 * dia, fuerzaSol: 1.6 * Math.max(0, Math.sin(Math.max(0, altGrados) * rad) * 1.6) };
}
