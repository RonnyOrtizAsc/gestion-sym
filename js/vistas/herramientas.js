// Vista "Herramientas": prestar, ver quién tiene qué, inventario de bodega.
import { S, prestamosActivos, disponibles, prestadas, perdidas, herramienta, trabajador,
  prestar, cerrarPrestamo, agregarHerramienta, cambiarCantidad, borrarHerramienta,
  CATEGORIAS, categoriaDe, nombreCategoria, cambiarCategoria, textoBusqueda } from "../datos.js";
import { esc, hhmm, fecha, esHoy, primerNombre } from "../util.js";
import { miniatura, tarjeta, tomarFoto, avatares } from "./fotos.js";
import * as perro from "./perrito.js";

// hs: herramientas elegidas (varias a la vez, una de cada una); guia: paso del perrito (0 = apagado)
const ui = { vista: "prestar", w: null, hs: [], guia: 0, confirmar: null, borrar: null, buscar: "", cat: null, catDe: null };

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

function textoBoton() {
  if (!ui.w || !ui.hs.length) return "Elige persona y herramientas";
  const n = ui.hs.length, a = primerNombre(trabajador(ui.w).nombre);
  return n === 1 ? `Prestar ${herramienta(ui.hs[0]).nombre} a ${a}` : `Prestar ${n} herramientas a ${a}`;
}
export function render(V, ctx) {
  const { hacer, redibujar } = ctx;
  const segs = [["prestar", "Prestar"], ["prestadas", `Prestadas (${prestamosActivos().length})`], ["inventario", "Inventario"]];
  let cuerpo = "";

  if (ui.vista === "prestar") {
    ui.hs = ui.hs.filter((id) => { const h = herramienta(id); return h && disponibles(h) > 0; });
    cuerpo = `<div class="prestar-grid"><div class="step" id="pasoQuien"><div class="step-h"><h3>1 · ¿A quién?</h3><button class="ayuda" id="ayudaPrestar" aria-label="Ayuda: cómo prestar">?</button></div>${avatares(S.trabajadores, { attr: "data-pw", seleccionado: ui.w })}</div>
    <div class="step" id="pasoQue"><div class="step-h"><h3>2 · ¿Qué herramientas? <small class="note">puedes elegir varias</small></h3>${S.herramientas.length ? buscador() : ""}</div>${S.herramientas.length
      ? (filtradas().length ? porCategoria(filtradas(), (hs) => `<div class="tarjetas">${hs.map((x) => tarjeta(x, { attr: "data-ph", seleccionada: ui.hs.includes(x.id), disponibles: disponibles(x) })).join("")}</div>`) : nadaEncontrado())
      : `<p class="note">Todavía no hay herramientas. Agrégalas en <button class="linkbtn" data-seg="inventario">Inventario</button>.</p>`}</div></div>
    <button class="btn primary big" id="prestar" ${ui.w && ui.hs.length ? "" : "disabled"}>${esc(textoBoton())}</button>`;
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
  <p class="lead">Anota qué prestas, a quién y cuánto.</p>
  <div class="seg">${segs.map(([k, l]) => `<button data-seg="${k}" aria-pressed="${ui.vista === k}">${l}</button>`).join("")}</div>${cuerpo}`;

  const $$ = (s) => V.querySelectorAll(s);
  $$("[data-seg]").forEach((b) => (b.onclick = () => { ui.vista = b.dataset.seg; ui.confirmar = null; redibujar(); }));
  const sc = V.querySelector("#catH"); if (sc) sc.onchange = () => { ui.cat = sc.value || null; redibujar(); };
  $$("[data-limpiar]").forEach((b) => (b.onclick = () => { ui.buscar = ""; ui.cat = null; redibujar(); }));
  $$("[data-catde]").forEach((b) => (b.onclick = () => { ui.catDe = ui.catDe === b.dataset.catde ? null : b.dataset.catde; redibujar(); }));
  $$("[data-ponercat]").forEach((b) => (b.onclick = () => { ui.catDe = null; hacer(async () => { await cambiarCategoria(b.dataset.h, b.dataset.ponercat); return `Movida a ${nombreCategoria(b.dataset.ponercat)}`; }); }));
  // Elegir persona, herramienta y cantidad: se actualiza solo lo que cambia (sin redibujar), así la pantalla no brinca hacia arriba
  const actualizar = () => {
    $$("[data-pw]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.pw === ui.w)));
    $$("[data-ph]").forEach((b) => b.setAttribute("aria-pressed", String(ui.hs.includes(b.dataset.ph))));
    const pb = V.querySelector("#prestar"); if (!pb) return;
    pb.disabled = !(ui.w && ui.hs.length); pb.textContent = textoBoton();
    const ok = document.querySelector("[data-perro-ok]"); if (ok && ui.guia === 3) ok.disabled = !ui.hs.length;
  };
  $$("[data-pw]").forEach((b) => (b.onclick = () => { ui.w = b.dataset.pw; actualizar(); if (ui.guia === 2) paso(3); }));
  $$("[data-ph]").forEach((b) => (b.onclick = () => { const id = b.dataset.ph; ui.hs = ui.hs.includes(id) ? ui.hs.filter((x) => x !== id) : [...ui.hs, id]; actualizar(); }));
  const pb = V.querySelector("#prestar");
  if (pb) pb.onclick = () => { const conGuia = ui.guia === 4; hacer(async () => {
    const w = trabajador(ui.w), lista = ui.hs.map(herramienta);
    for (const h of lista) await prestar(h.id, ui.w, 1);   // una de cada una, todas a la misma persona
    ui.w = null; ui.hs = []; ui.vista = "prestadas";
    if (conGuia) { ui.guia = 0; setTimeout(() => { perro.mostrar("¡Listo! Ahora ya sabes. 🐾"); setTimeout(perro.ocultar, 2600); }, 300); }
    return `${lista.length === 1 ? lista[0].nombre : lista.length + " herramientas"} → ${w.nombre}`;
  }); };
  // Perrito guía: ? → saluda → persona → herramientas → Prestar → listo
  const paso = (n) => {
    ui.guia = n; const fin = () => { ui.guia = 0; };
    if (n === 1) perro.mostrar("¡Te ayudo a prestar herramienta!", { tocarParaSeguir: () => paso(2), cerrar: fin });
    else if (n === 2) perro.mostrar("Toca el trabajador que prestará la herramienta", { objetivo: V.querySelector("#pasoQuien .avatares") || V.querySelector("#pasoQuien"), cerrar: fin });
    else if (n === 3) { perro.mostrar("Selecciona las herramientas que quieres prestar", { objetivo: V.querySelector("#pasoQue"), boton: { texto: "Ya las elegí ›", alTocar: () => paso(4) }, cerrar: fin }); actualizar(); }
    else if (n === 4) perro.mostrar("Si estás seguro, presiona en <b>Prestar</b>", { objetivo: V.querySelector("#prestar"), cerrar: fin });
  };
  const ay = V.querySelector("#ayudaPrestar"); if (ay) ay.onclick = (e) => { e.stopPropagation(); ui.vista = "prestar"; paso(1); };
  if (ui.vista !== "prestar" && ui.guia) { ui.guia = 0; perro.ocultar(); }
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
