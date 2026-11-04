// Vista "Obra": el plano real con cada trabajador en el área donde está asignado.
// - Normal: tocas a alguien para ver qué hace y moverlo de área; tocas un área para ver o traer gente.
// - Receso: con "Iniciar receso", cada toque manda a la persona a la bodega (naranja) o la regresa a su área.
import { S, recesoAbierto, enReceso, prestamosActivos, cambiarReceso, iniciarReceso, terminarReceso,
  trabajador, herramienta, area, enArea, moverTrabajador } from "../datos.js";
import { esc, iniciales, primerNombre, ms, hhmm } from "../util.js";

const ZOOMS = [1, 1.6, 2.4, 3.4];
const ui = { plano: "actual", zoom: 1, sel: null, areaSel: null, moviendo: false };
let ultimas = {};   // última posición de cada persona, para que "caminen" al cambiar

export function resumen() {
  const nb = enReceso().length, nl = prestamosActivos().reduce((a, p) => a + p.cantidad, 0);
  const sinArea = S.trabajadores.filter((w) => !w.area_id && !recesoAbierto(w.id)).length;
  return `<div class="stats">
    <div class="stat w"><b>${S.trabajadores.length - nb - sinArea}</b><span>en su área</span></div>
    <div class="stat b"><b>${nb}</b><span>en receso</span></div>
    <div class="stat"><b>${nl}</b><span>herramientas prestadas</span></div></div>`;
}

// Reparte a las personas de un área en una cuadrícula dentro del rectángulo
function posiciones(a, gente, prop) {
  const n = gente.length; if (!n) return [];
  const aspecto = (a.w * prop) / a.h;
  const cols = Math.max(1, Math.min(n, Math.round(Math.sqrt(n * aspecto)) || 1)), filas = Math.ceil(n / cols);
  return gente.map((w, i) => [w, +a.x + (a.w * ((i % cols) + 0.5)) / cols, +a.y + (a.h * (Math.floor(i / cols) + 0.5)) / filas]);
}

function token(w, x, y) {
  const r = recesoAbierto(w.id), [px, py] = ultimas[w.id] || [x, y];
  const herr = prestamosActivos().filter((p) => p.trabajador_id === w.id).reduce((s, p) => s + p.cantidad, 0);
  return `<button class="tok ${r ? "on-break" : ""} ${ui.sel === w.id ? "sel" : ""}" data-w="${w.id}" data-to="${x},${y}" style="left:${px}%;top:${py}%"
    aria-label="${esc(w.nombre)}${r ? ", en receso" : ""}">
    ${r ? `<span class="bub" data-desde="${ms(r.inicio)}"></span>` : ""}
    <span class="av">${esc(iniciales(w.nombre))}</span>${herr ? `<span class="tl">${herr}</span>` : ""}
    <span class="nm">${esc(primerNombre(w.nombre))}</span></button>`;
}

const chipPersona = (w) => { const r = recesoAbierto(w.id);
  return `<button class="persona ${r ? "on-break" : ""}" data-w="${w.id}"><span class="av">${esc(iniciales(w.nombre))}</span><span>${esc(primerNombre(w.nombre))}${r ? ` <span class="num" data-desde="${ms(r.inicio)}"></span>` : ""}</span></button>`; };

function hojaTrabajador(w) {
  const r = recesoAbierto(w.id), a = area(w.area_id);
  const herr = prestamosActivos().filter((p) => p.trabajador_id === w.id);
  return `<div class="hoja-h"><span class="av big ${r ? "on-break" : ""}">${esc(iniciales(w.nombre))}</span>
      <div class="grow"><b>${esc(w.nombre)}</b><small>${esc(w.puesto || "")}${(w.habilidades || []).length ? " · " + esc(w.habilidades.join(", ")) : ""}</small></div>
      <button class="x" data-cerrar aria-label="Cerrar">×</button></div>
    <p class="estado">${a ? `<span class="pill ok">Asignado</span> <b>${esc(a.nombre)}</b>` : `<span class="pill">Sin área</span> Toca “Mover de área” para asignarlo.`}
      ${r ? `<br><span class="pill out">En receso</span> hace <span class="num" data-desde="${ms(r.inicio)}"></span>` : ""}</p>
    ${herr.length ? `<p class="note" style="margin:0 0 10px">Tiene: ${herr.map((p) => `${p.cantidad} × ${esc(herramienta(p.herramienta_id).nombre)}`).join(", ")}</p>` : ""}
    <div class="acts"><button class="btn primary" data-mover>Mover de área</button>${a ? `<button class="btn" data-sacar>Quitar del área</button>` : ""}</div>`;
}

function hojaArea(a) {
  const aqui = enArea(a.id), otros = S.trabajadores.filter((w) => w.area_id !== a.id);
  return `<div class="hoja-h"><div class="grow"><p class="eyebrow" style="margin:0">Área${a.uso_actual ? " · hoy: " + esc(a.uso_actual) : ""}</p><b>${esc(a.nombre)}</b>
      <small>${aqui.length ? `${aqui.length} ${aqui.length === 1 ? "persona asignada" : "personas asignadas"}` : "Nadie asignado aquí"}</small></div>
      <button class="x" data-cerrar aria-label="Cerrar">×</button></div>
    ${aqui.length ? `<div class="chips" style="margin-bottom:12px">${aqui.map(chipPersona).join("")}</div>` : ""}
    <p class="note" style="margin:0 0 6px">Toca a alguien para asignarlo a esta área:</p>
    <div class="chips">${otros.map((w) => `<button class="chip" data-traer="${w.id}">${esc(w.nombre)}${w.area_id ? `<span class="n">${esc(area(w.area_id)?.nombre || "")}</span>` : ""}</button>`).join("")}</div>`;
}

export function render(V, { hacer, redibujar }) {
  const o = S.obra;
  if (!o) { V.innerHTML = `<h2>Obra</h2><p class="lead">Todavía no hay una obra activa.</p>`; return; }
  const prop = +o.plano_proporcion || 0.694, receso = !!S.sesion;
  const zr = S.areas.find((a) => a.es_receso);
  if (receso) { ui.sel = null; ui.areaSel = null; ui.moviendo = false; }
  const w = ui.sel ? S.trabajadores.find((x) => x.id === ui.sel) : null;
  const aSel = ui.areaSel ? area(ui.areaSel) : null;

  const descansando = S.trabajadores.filter((x) => recesoAbierto(x.id));
  const trabajando = S.trabajadores.filter((x) => !recesoAbierto(x.id));
  const conArea = trabajando.filter((x) => area(x.area_id));
  const sinArea = trabajando.filter((x) => !area(x.area_id));
  const tokens = [
    ...S.areas.flatMap((a) => posiciones(a, conArea.filter((x) => x.area_id === a.id), prop)),
    ...(zr ? posiciones(zr, descansando, prop) : []),
  ];
  const prev = V.querySelector("#mapaScroll"), scroll = prev ? [prev.scrollLeft, prev.scrollTop] : null;

  V.innerHTML = `<p class="eyebrow">${esc(o.nombre)}${o.propietario ? " · " + esc(o.propietario) : ""}</p>
  <h2>${receso ? "Receso en curso" : "¿Quién está en qué?"}</h2>
  ${receso ? `<div class="aviso receso"><div><b>Receso abierto desde ${hhmm(S.sesion.inicio)}</b> · <span class="num" data-desde="${ms(S.sesion.inicio)}"></span><br>
      Toca a quien sale: se pone naranja y va a la bodega. Tócalo otra vez cuando regrese.</div></div>` : ""}
  ${ui.moviendo && w ? `<div class="aviso">Toca el área a donde va <b>${esc(primerNombre(w.nombre))}</b> <button class="btn small" data-cancelar-mover>Cancelar</button></div>` : ""}
  <div class="mapa-bar">
    <div class="seg mini" role="group" aria-label="Plano">
      <button data-plano="actual" aria-pressed="${ui.plano === "actual"}">Ahora · G-06</button>
      <button data-plano="final" aria-pressed="${ui.plano === "final"}">Final · AR-01</button></div>
    <div class="zoom"><button data-z="-1" aria-label="Alejar" ${ui.zoom === ZOOMS[0] ? "disabled" : ""}>−</button><button data-z="1" aria-label="Acercar" ${ui.zoom === ZOOMS.at(-1) ? "disabled" : ""}>+</button></div>
  </div>
  <div class="mapa-scroll ${ui.zoom > 1 ? "acercado" : ""}" id="mapaScroll">
    <div class="mapa z${ZOOMS.indexOf(ui.zoom)} ${ui.moviendo ? "moviendo" : ""} ${receso ? "en-receso" : ""}" style="width:${ui.zoom * 100}%;aspect-ratio:${prop}">
      ${ui.plano === "actual" ? `<img class="plano tenue" src="${esc(o.plano_final)}" alt="" aria-hidden="true">` : ""}
      <img class="plano" src="${esc(ui.plano === "actual" ? o.plano_actual : o.plano_final)}" alt="Plano ${ui.plano === "actual" ? "actual" : "final"} de ${esc(o.nombre)}">
      ${S.areas.map((a) => { const n = conArea.filter((x) => x.area_id === a.id).length;
        const nombre = a.es_receso && (ui.plano === "actual" || receso) ? a.uso_actual || "Zona de receso" : a.nombre;
        return `<button class="area ${n ? "ocupada" : ""} ${a.es_receso ? "zr" : ""} ${ui.areaSel === a.id ? "sel" : ""}" data-area="${a.id}"
          style="left:${a.x}%;top:${a.y}%;width:${a.w}%;height:${a.h}%" aria-label="${esc(nombre)}, ${n} asignados"><span class="an">${esc(nombre)}</span></button>`; }).join("")}
      ${tokens.map(([p, x, y]) => token(p, x, y)).join("")}
    </div>
  </div>
  <div class="section" style="margin-top:12px">${resumen()}</div>
  ${sinArea.length ? `<div class="bandeja"><p class="eyebrow">Sin área asignada (${sinArea.length})</p><div class="chips">${sinArea.map(chipPersona).join("")}</div>
    ${receso ? "" : `<p class="note">Toca a alguien y luego “Mover de área”, o toca un área del plano para asignar gente.</p>`}</div>` : ""}
  ${!zr && descansando.length ? `<div class="bandeja rest"><p class="eyebrow">En receso</p><div class="chips">${descansando.map(chipPersona).join("")}</div></div>` : ""}
  <div class="section">${receso
    ? `<button class="btn primary big" id="fin">Terminar receso (todos a trabajar)</button>`
    : `<button class="btn break big" id="ini">Iniciar receso</button>`}</div>
  ${(w && !ui.moviendo) || (aSel && !ui.moviendo) ? `<div class="hoja" role="dialog" aria-label="Detalle">${w ? hojaTrabajador(w) : hojaArea(aSel)}</div>` : ""}`;

  const mapa = V.querySelector("#mapaScroll");
  if (scroll) { mapa.scrollLeft = scroll[0]; mapa.scrollTop = scroll[1]; }
  // Animación: cada persona camina desde donde estaba hasta su nuevo lugar
  requestAnimationFrame(() => V.querySelectorAll(".tok").forEach((t) => {
    const [x, y] = t.dataset.to.split(",").map(Number); t.style.left = x + "%"; t.style.top = y + "%"; ultimas[t.dataset.w] = [x, y];
  }));

  // ---- Interacción ----
  const $$ = (s) => V.querySelectorAll(s);
  const cerrar = () => { ui.sel = null; ui.areaSel = null; ui.moviendo = false; redibujar(); };
  $$("[data-plano]").forEach((b) => (b.onclick = () => { ui.plano = b.dataset.plano; redibujar(); }));
  $$("[data-z]").forEach((b) => (b.onclick = () => {
    const cx = (mapa.scrollLeft + mapa.clientWidth / 2) / mapa.scrollWidth, cy = (mapa.scrollTop + mapa.clientHeight / 2) / mapa.scrollHeight;
    ui.zoom = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, ZOOMS.indexOf(ui.zoom) + +b.dataset.z))]; redibujar();
    const n = V.querySelector("#mapaScroll"); n.scrollLeft = cx * n.scrollWidth - n.clientWidth / 2; n.scrollTop = cy * n.scrollHeight - n.clientHeight / 2;
  }));
  $$("[data-w]").forEach((b) => (b.onclick = (e) => {
    e.stopPropagation(); const id = b.dataset.w;
    if (receso) return hacer(async () => { const sale = await cambiarReceso(id); return `${primerNombre(trabajador(id).nombre)} ${sale ? "se fue a receso" : "regresó a trabajar"}`; });
    ui.sel = id; ui.areaSel = null; ui.moviendo = false; redibujar();
  }));
  $$("[data-area]").forEach((b) => (b.onclick = () => {
    if (receso) return;
    if (ui.moviendo && ui.sel) {
      const id = ui.sel, a = area(b.dataset.area); ui.moviendo = false; ui.sel = null;
      return hacer(async () => { await moverTrabajador(id, a.id); return `${primerNombre(trabajador(id).nombre)} → ${a.nombre}`; });
    }
    ui.areaSel = b.dataset.area; ui.sel = null; redibujar();
  }));
  $$("[data-cerrar]").forEach((b) => (b.onclick = cerrar));
  $$("[data-cancelar-mover]").forEach((b) => (b.onclick = () => { ui.moviendo = false; redibujar(); }));
  const mv = V.querySelector("[data-mover]"); if (mv) mv.onclick = () => { ui.moviendo = true; redibujar(); };
  const sc = V.querySelector("[data-sacar]");
  if (sc) sc.onclick = () => { const id = ui.sel; hacer(async () => { await moverTrabajador(id, null); return `${primerNombre(trabajador(id).nombre)} quedó sin área`; }); };
  $$("[data-traer]").forEach((b) => (b.onclick = () => { const id = b.dataset.traer, a = area(ui.areaSel);
    hacer(async () => { await moverTrabajador(id, a.id); return `${primerNombre(trabajador(id).nombre)} → ${a.nombre}`; }); }));
  const ini = V.querySelector("#ini"); if (ini) ini.onclick = () => hacer(async () => { await iniciarReceso(); return "Receso iniciado: toca a quien sale a descansar"; });
  const fin = V.querySelector("#fin"); if (fin) fin.onclick = () => hacer(async () => { await terminarReceso(); return "Receso cerrado, todos a trabajar"; });
}
