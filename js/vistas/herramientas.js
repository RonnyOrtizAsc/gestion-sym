// Vista "Herramientas": prestar, ver quién tiene qué, inventario de bodega.
import { S, prestamosActivos, disponibles, prestadas, perdidas, herramienta, trabajador,
  prestar, cerrarPrestamo, agregarHerramienta, cambiarCantidad, borrarHerramienta,
  CATEGORIAS, categoriaDe, nombreCategoria, cambiarCategoria, textoBusqueda } from "../datos.js";
import { esc, hhmm, fecha, esHoy, primerNombre } from "../util.js";
import { miniatura, tarjeta, tomarFoto, avatares } from "./fotos.js";

const ui = { vista: "prestar", w: null, h: null, q: 1, confirmar: null, borrar: null, buscar: "", cat: null, catDe: null };

// Buscador + filtros por categoría: escribir filtra al instante (sin tildes, por cualquier parte del nombre)
function filtradas() {
  const q = textoBusqueda(ui.buscar).trim();
  return S.herramientas.filter((h) => (!ui.cat || categoriaDe(h) === ui.cat) && (!q || q.split(/\s+/).every((p) => textoBusqueda(h.nombre).includes(p))));
}
function buscador() {
  // Solo un desplegable de categoría (sin buscador)
  const hay = new Map(); for (const h of S.herramientas) { const c = categoriaDe(h); hay.set(c, (hay.get(c) || 0) + 1); }
  const op = CATEGORIAS.filter(([k]) => hay.has(k)).map(([k, l]) => `<option value="${k}" ${ui.cat === k ? "selected" : ""}>${l} (${hay.get(k)})</option>`).join("");
  return `<div class="buscador"><select id="catH" aria-label="Categoría"><option value="">Todas (${S.herramientas.length})</option>${op}</select></div>`;
}
// Agrupa por categoría (en el orden de CATEGORIAS); si hay un filtro o búsqueda, sin encabezados de más
function porCategoria(lista, pinta) {
  const g = new Map(); for (const h of lista) { const c = categoriaDe(h); if (!g.has(c)) g.set(c, []); g.get(c).push(h); }
  return CATEGORIAS.filter(([k]) => g.has(k)).map(([k, l]) => `${ui.cat ? "" : `<p class="eyebrow cat-h">${l}</p>`}${pinta(g.get(k))}`).join("");
}
const nadaEncontrado = () => `<p class="note">No encontré “${esc(ui.buscar)}”${ui.cat ? ` en ${nombreCategoria(ui.cat)}` : ""}. <button class="linkbtn" data-limpiar>Ver todas</button></p>`;

export function render(V, ctx) {
  const { hacer, redibujar } = ctx;
  const segs = [["prestar", "Prestar"], ["prestadas", `Prestadas (${prestamosActivos().length})`], ["inventario", "Inventario"]];
  let cuerpo = "";

  if (ui.vista === "prestar") {
    const h = S.herramientas.find((x) => x.id === ui.h), max = h ? disponibles(h) : 1;
    if (ui.q > max) ui.q = Math.max(1, max);
    cuerpo = `<div class="prestar-grid"><div class="step"><h3>1 · ¿A quién?</h3>${avatares(S.trabajadores, { attr: "data-pw", seleccionado: ui.w })}</div>
    <div class="step"><div class="step-h"><h3>2 · ¿Qué herramienta?</h3>${S.herramientas.length ? buscador() : ""}</div>${S.herramientas.length
      ? (filtradas().length ? porCategoria(filtradas(), (hs) => `<div class="tarjetas">${hs.map((x) => tarjeta(x, { attr: "data-ph", seleccionada: ui.h === x.id, disponibles: disponibles(x) })).join("")}</div>`) : nadaEncontrado())
      : `<p class="note">Todavía no hay herramientas. Agrégalas en <button class="linkbtn" data-seg="inventario">Inventario</button>.</p>`}</div></div>
    <div class="step"><h3>3 · ¿Cuántas?</h3><div class="qty"><button id="qm" aria-label="Menos">−</button><output>${ui.q}</output><button id="qp" aria-label="Más">+</button><span class="note" style="margin:0">${h ? `disponibles: ${max}` : ""}</span></div></div>
    <button class="btn primary big" id="prestar" ${ui.w && h && max > 0 ? "" : "disabled"}>${ui.w && h ? `Prestar ${ui.q} × ${esc(h.nombre)} a ${esc(primerNombre(trabajador(ui.w).nombre))}` : "Elige persona y herramienta"}</button>`;
  } else if (ui.vista === "prestadas") {
    const por = {};
    prestamosActivos().forEach((p) => (por[p.trabajador_id] = por[p.trabajador_id] || []).push(p));
    const perd = S.prestamos.filter((p) => p.estado === "perdido");
    cuerpo = `<div class="list">${Object.keys(por).length ? Object.entries(por).map(([wid, ps]) => `
      <div class="person-h">${esc(trabajador(wid).nombre)}<span class="pill out">${ps.reduce((a, p) => a + p.cantidad, 0)} en uso</span></div>
      ${ps.map((p) => `<div class="li">${miniatura(herramienta(p.herramienta_id), "foto chica")}<div class="grow"><b>${p.cantidad} × ${esc(herramienta(p.herramienta_id).nombre)}</b><small>Prestada ${esHoy(p.prestado_en) ? "hoy" : "el " + fecha(p.prestado_en)} a las ${hhmm(p.prestado_en)}</small></div>
        ${ui.confirmar === p.id
          ? `<span class="confirm"><button class="btn small danger" data-perdida="${p.id}">Sí, se perdió</button><button class="btn small" data-cancelar>No</button></span>`
          : `<span class="acts"><button class="btn small" data-devolvio="${p.id}">Devolvió</button><button class="btn small danger" data-preguntar="${p.id}">Perdida</button></span>`}</div>`).join("")}`).join("")
      : `<div class="empty">Nadie tiene herramientas ahora. Cuando prestes algo aparecerá aquí, agrupado por persona.</div>`}</div>
      ${perd.length ? `<div class="section"><p class="eyebrow">Perdidas</p><div class="list">${perd.map((p) => `<div class="li">${miniatura(herramienta(p.herramienta_id), "foto chica")}<div class="grow"><b>${p.cantidad} × ${esc(herramienta(p.herramienta_id).nombre)}</b><small>La tenía ${esc(trabajador(p.trabajador_id).nombre)} · ${fecha(p.cerrado_en)}</small></div><span class="pill lost">Perdida</span></div>`).join("")}</div></div>` : ""}`;
  } else {
    const fila = (h) => { const o = prestadas(h.id), lo = perdidas(h.id), a = disponibles(h);
      return `<div class="li"><button class="foto-btn" data-foto="${h.id}" aria-label="${h.foto ? "Cambiar foto" : "Tomar foto"} de ${esc(h.nombre)}">${miniatura(h, "foto chica")}<span class="cam">${h.foto ? "Cambiar" : "+ Foto"}</span></button><div class="grow"><b>${esc(h.nombre)}</b><small>${h.cantidad} en total${lo ? ` · ${lo} perdida${lo > 1 ? "s" : ""}` : ""} · <button class="linkbtn" data-catde="${h.id}">${nombreCategoria(categoriaDe(h))} ▾</button></small>
        ${ui.catDe === h.id ? `<div class="chips mover">${CATEGORIAS.map(([k, l]) => `<button class="chip ${categoriaDe(h) === k ? "on" : ""}" data-ponercat="${k}" data-h="${h.id}">${l}</button>`).join("")}</div>` : ""}</div>
        ${o ? `<span class="pill out">${o} prestada${o > 1 ? "s" : ""}</span>` : ""}<span class="pill ${a > 0 ? "ok" : "lost"}">${a} en bodega</span>
        ${ui.borrar === h.id
          ? `<span class="confirm"><button class="btn small danger" data-borrar-si="${h.id}">Sí, borrar</button><button class="btn small" data-borrar-no>No</button></span>`
          : `<span class="acts"><button class="btn small" data-menos="${h.id}" aria-label="Quitar una">−1</button><button class="btn small" data-mas="${h.id}" aria-label="Agregar una">+1</button><button class="btn small danger" data-borrar="${h.id}" aria-label="Borrar ${esc(h.nombre)}">Borrar</button></span>`}</div>`; };
    cuerpo = `${S.herramientas.length ? buscador() : ""}<div class="list">${S.herramientas.length ? (filtradas().length ? porCategoria(filtradas(), (hs) => hs.map(fila).join("")) : nadaEncontrado())
      : `<div class="empty">La bodega está vacía. Agrega abajo tus herramientas con la cantidad que tienes.</div>`}</div>
    <div class="step section"><h3>Agregar herramienta</h3><form class="addrow" id="addH">
      <input id="hn" placeholder="Ej. Pulidora" aria-label="Nombre de la herramienta" required>
      <input id="hq" type="number" min="1" value="1" aria-label="Cantidad">
      <button class="btn primary">Agregar</button></form></div>`;
  }

  V.innerHTML = `<p class="eyebrow">Préstamos de bodega</p><h2>Herramientas</h2>
  <p class="lead">Anota qué prestas, a quién y cuánto. Así sabes quién tiene qué y quién la perdió.</p>
  <div class="seg">${segs.map(([k, l]) => `<button data-seg="${k}" aria-pressed="${ui.vista === k}">${l}</button>`).join("")}</div>${cuerpo}`;

  const $$ = (s) => V.querySelectorAll(s);
  $$("[data-seg]").forEach((b) => (b.onclick = () => { ui.vista = b.dataset.seg; ui.confirmar = null; redibujar(); }));
  const sc = V.querySelector("#catH"); if (sc) sc.onchange = () => { ui.cat = sc.value || null; redibujar(); };
  $$("[data-limpiar]").forEach((b) => (b.onclick = () => { ui.buscar = ""; ui.cat = null; redibujar(); }));
  $$("[data-catde]").forEach((b) => (b.onclick = () => { ui.catDe = ui.catDe === b.dataset.catde ? null : b.dataset.catde; redibujar(); }));
  $$("[data-ponercat]").forEach((b) => (b.onclick = () => { ui.catDe = null; hacer(async () => { await cambiarCategoria(b.dataset.h, b.dataset.ponercat); return `Movida a ${nombreCategoria(b.dataset.ponercat)}`; }); }));
  $$("[data-pw]").forEach((b) => (b.onclick = () => { ui.w = b.dataset.pw; redibujar(); }));
  $$("[data-ph]").forEach((b) => (b.onclick = () => { ui.h = b.dataset.ph; ui.q = 1; redibujar(); }));
  const qm = V.querySelector("#qm");
  if (qm) {
    qm.onclick = () => { ui.q = Math.max(1, ui.q - 1); redibujar(); };
    V.querySelector("#qp").onclick = () => { const h = S.herramientas.find((x) => x.id === ui.h); ui.q = Math.min(h ? disponibles(h) : 1, ui.q + 1); redibujar(); };
  }
  const pb = V.querySelector("#prestar");
  if (pb) pb.onclick = () => hacer(async () => {
    const msg = `${ui.q} × ${herramienta(ui.h).nombre} → ${trabajador(ui.w).nombre}`;
    await prestar(ui.h, ui.w, ui.q); ui.w = null; ui.h = null; ui.q = 1; ui.vista = "prestadas"; return msg;
  });
  $$("[data-devolvio]").forEach((b) => (b.onclick = () => hacer(async () => { await cerrarPrestamo(b.dataset.devolvio, "devuelto"); return "Devuelta a bodega"; })));
  $$("[data-preguntar]").forEach((b) => (b.onclick = () => { ui.confirmar = b.dataset.preguntar; redibujar(); }));
  $$("[data-cancelar]").forEach((b) => (b.onclick = () => { ui.confirmar = null; redibujar(); }));
  $$("[data-perdida]").forEach((b) => (b.onclick = () => hacer(async () => { await cerrarPrestamo(b.dataset.perdida, "perdido"); ui.confirmar = null; return "Marcada como perdida"; })));
  $$("[data-mas]").forEach((b) => (b.onclick = () => hacer(async () => { const h = herramienta(b.dataset.mas); await cambiarCantidad(h.id, h.cantidad + 1); return `${h.nombre}: ${h.cantidad + 1} en total`; })));
  $$("[data-borrar]").forEach((b) => (b.onclick = () => { ui.borrar = b.dataset.borrar; redibujar(); }));
  $$("[data-borrar-no]").forEach((b) => (b.onclick = () => { ui.borrar = null; redibujar(); }));
  $$("[data-borrar-si]").forEach((b) => (b.onclick = () => { const h = herramienta(b.dataset.borrarSi); ui.borrar = null;
    hacer(async () => { await borrarHerramienta(h.id); return `${h.nombre} borrada del inventario`; }); }));
  $$("[data-foto]").forEach((b) => (b.onclick = () => tomarFoto(b.dataset.foto, hacer)));
  $$("[data-menos]").forEach((b) => (b.onclick = () => hacer(async () => {
    const h = herramienta(b.dataset.menos);
    if (h.cantidad - 1 < prestadas(h.id) + perdidas(h.id)) throw new Error("No puedes bajar de lo que está prestado o perdido.");
    await cambiarCantidad(h.id, h.cantidad - 1); return `${h.nombre}: ${h.cantidad - 1} en total`;
  })));
  const f = V.querySelector("#addH");
  if (f) f.onsubmit = (e) => { e.preventDefault();
    const n = V.querySelector("#hn").value.trim(), q = Math.max(1, parseInt(V.querySelector("#hq").value) || 1);
    if (n) hacer(async () => { await agregarHerramienta(n, q); return `${n} agregada`; });
  };
}
