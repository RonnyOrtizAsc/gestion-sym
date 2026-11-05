// Fotos de herramientas: miniatura y botón para tomar la foto con la cámara del cel
import { esc, iniciales } from "../util.js";
import { subirFotoHerramienta } from "../datos.js";

export const miniatura = (h, clase = "foto") => h?.foto
  ? `<img class="${clase}" src="${esc(h.foto)}" alt="" loading="lazy">`
  : `<span class="${clase} sin-foto" aria-hidden="true">${esc(iniciales(h?.nombre || "?"))}</span>`;

// Tarjeta tocable con foto, nombre y cuántas quedan
export const tarjeta = (h, { attr, seleccionada, disponibles }) => `
  <button class="tarjeta-h" ${attr}="${h.id}" aria-pressed="${!!seleccionada}" ${disponibles < 1 ? "disabled" : ""}>
    ${miniatura(h)}<span class="th-nombre">${esc(h.nombre)}</span>
    <span class="th-quedan ${disponibles < 1 ? "agotada" : ""}">${disponibles < 1 ? "Ninguna en bodega" : `${disponibles} de ${h.cantidad} en bodega`}</span>
  </button>`;

// Abre la cámara (o la galería) y sube la foto
export function tomarFoto(hid, hacer) {
  const input = document.createElement("input");
  input.type = "file"; input.accept = "image/*"; input.setAttribute("capture", "environment");
  input.onchange = () => { const f = input.files?.[0]; if (f) hacer(async () => { await subirFotoHerramienta(hid, f); return "Foto guardada"; }); };
  input.click();
}
