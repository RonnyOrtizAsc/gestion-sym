// Utilidades compartidas
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const iniciales = (n) => String(n || "?").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
export const primerNombre = (n) => String(n || "").trim().split(/\s+/)[0];
export const pad = (n) => String(n).padStart(2, "0");
export const ms = (t) => new Date(t).getTime();

export function dur(m) {
  m = Math.max(0, m);
  const s = Math.floor(m / 1000), h = Math.floor(s / 3600), mi = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(mi)}:${pad(s % 60)}` : `${mi}:${pad(s % 60)}`;
}
export function minutos(m) {
  const t = Math.round(m / 60000);
  return t < 60 ? `${t} min` : `${Math.floor(t / 60)} h ${pad(t % 60)} min`;
}
export const hhmm = (t) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const fecha = (t) => new Date(t).toLocaleDateString("es-SV", { day: "numeric", month: "short" });
export const esHoy = (t) => new Date(t).toDateString() === new Date().toDateString();
export function inicioDelDia() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }

let tId;
export function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(tId); tId = setTimeout(() => (t.hidden = true), 2400);
}
