// Vista "Herramientas": prestar, ver quién tiene qué, inventario de bodega.
import { S, prestamosActivos, disponibles, prestadas, perdidas, herramienta, trabajador,
  prestar, cerrarPrestamo, agregarHerramienta, cambiarCantidad } from "../datos.js";
import { esc, hhmm, fecha, esHoy, primerNombre } from "../util.js";

const ui = { vista: "prestar", w: null, h: null, q: 1, confirmar: null };

export function render(V, ctx) {
  const { hacer, redibujar } = ctx;
  const segs = [["prestar", "Prestar"], ["prestadas", `Prestadas (${prestamosActivos().length})`], ["inventario", "Inventario"]];
  let cuerpo = "";

  if (ui.vista === "prestar") {
    const h = S.herramientas.find((x) => x.id === ui.h), max = h ? disponibles(h) : 1;
    if (ui.q > max) ui.q = Math.max(1, max);
    cuerpo = `<div class="step"><h3>1 · ¿A quién?</h3><div class="chips">${S.trabajadores.map((w) => `<button class="chip" data-pw="${w.id}" aria-pressed="${ui.w === w.id}">${esc(w.nombre)}</button>`).join("")}</div></div>
    <div class="step"><h3>2 · ¿Qué herramienta?</h3>${S.herramientas.length
      ? `<div class="chips">${S.herramientas.map((x) => { const a = disponibles(x); return `<button class="chip" data-ph="${x.id}" aria-pressed="${ui.h === x.id}" ${a < 1 ? "disabled" : ""}>${esc(x.nombre)}<span class="n">${a}/${x.cantidad}</span></button>`; }).join("")}</div><p class="note">El número indica cuántas quedan en bodega.</p>`
      : `<p class="note">Todavía no hay herramientas. Agrégalas en <button class="linkbtn" data-seg="inventario">Inventario</button>.</p>`}</div>
    <div class="step"><h3>3 · ¿Cuántas?</h3><div class="qty"><button id="qm" aria-label="Menos">−</button><output>${ui.q}</output><button id="qp" aria-label="Más">+</button><span class="note" style="margin:0">${h ? `disponibles: ${max}` : ""}</span></div></div>
    <button class="btn primary big" id="prestar" ${ui.w && h && max > 0 ? "" : "disabled"}>${ui.w && h ? `Prestar ${ui.q} × ${esc(h.nombre)} a ${esc(primerNombre(trabajador(ui.w).nombre))}` : "Elige persona y herramienta"}</button>`;
  } else if (ui.vista === "prestadas") {
    const por = {};
    prestamosActivos().forEach((p) => (por[p.trabajador_id] = por[p.trabajador_id] || []).push(p));
    const perd = S.prestamos.filter((p) => p.estado === "perdido");
    cuerpo = `<div class="list">${Object.keys(por).length ? Object.entries(por).map(([wid, ps]) => `
      <div class="person-h">${esc(trabajador(wid).nombre)}<span class="pill out">${ps.reduce((a, p) => a + p.cantidad, 0)} en uso</span></div>
      ${ps.map((p) => `<div class="li"><div class="grow"><b>${p.cantidad} × ${esc(herramienta(p.herramienta_id).nombre)}</b><small>Prestada ${esHoy(p.prestado_en) ? "hoy" : "el " + fecha(p.prestado_en)} a las ${hhmm(p.prestado_en)}</small></div>
        ${ui.confirmar === p.id
          ? `<span class="confirm"><button class="btn small danger" data-perdida="${p.id}">Sí, se perdió</button><button class="btn small" data-cancelar>No</button></span>`
          : `<span class="acts"><button class="btn small" data-devolvio="${p.id}">Devolvió</button><button class="btn small danger" data-preguntar="${p.id}">Perdida</button></span>`}</div>`).join("")}`).join("")
      : `<div class="empty">Nadie tiene herramientas ahora. Cuando prestes algo aparecerá aquí, agrupado por persona.</div>`}</div>
      ${perd.length ? `<div class="section"><p class="eyebrow">Perdidas</p><div class="list">${perd.map((p) => `<div class="li"><div class="grow"><b>${p.cantidad} × ${esc(herramienta(p.herramienta_id).nombre)}</b><small>La tenía ${esc(trabajador(p.trabajador_id).nombre)} · ${fecha(p.cerrado_en)}</small></div><span class="pill lost">Perdida</span></div>`).join("")}</div></div>` : ""}`;
  } else {
    cuerpo = `<div class="list">${S.herramientas.length ? S.herramientas.map((h) => { const o = prestadas(h.id), lo = perdidas(h.id), a = disponibles(h);
      return `<div class="li"><div class="grow"><b>${esc(h.nombre)}</b><small>${h.cantidad} en total${lo ? ` · ${lo} perdida${lo > 1 ? "s" : ""}` : ""}</small></div>
        ${o ? `<span class="pill out">${o} prestada${o > 1 ? "s" : ""}</span>` : ""}<span class="pill ${a > 0 ? "ok" : "lost"}">${a} en bodega</span>
        <span class="acts"><button class="btn small" data-menos="${h.id}" aria-label="Quitar una">−1</button><button class="btn small" data-mas="${h.id}" aria-label="Agregar una">+1</button></span></div>`; }).join("")
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
