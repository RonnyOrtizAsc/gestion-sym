// Vista "Obra": centro de mando. Mapa dibujado del proyecto (2D) o maqueta 3D,
// con cada trabajador en el área donde está asignado.
// - Normal: tocas a alguien para ver qué hace y moverlo de área; tocas un área para ver o traer gente.
// - Receso: con "Iniciar receso", cada toque manda a la persona a la bodega (naranja) o la regresa a su área.
import { S, recesoAbierto, enReceso, prestamosActivos, cambiarReceso, iniciarReceso, terminarReceso,
  trabajador, herramienta, area, enArea, moverTrabajador,
  ESTADOS, TIPOS_ELEMENTO, estadoArea, agregarElemento, editarElemento, borrarElemento,
  prestarRapido, cerrarPrestamo, disponibles, METROS_POR_UNIDAD, usarComoBodega, estadoPiezas } from "../datos.js";
import { esc, iniciales, primerNombre, ms, hhmm } from "../util.js";
import { dibujarObra, capaPiezas, estadoPieza, PIEZAS, ANCHO, ALTO } from "./mapa-svg.js";

const ZOOMS = [1, 1.6, 2.4, 3.4];
let vistaGuardada = "2d"; try { vistaGuardada = localStorage.getItem("sym-vista") || "2d"; } catch (e) {}
const ui = { vista: vistaGuardada, zoom: 1, sel: null, areaSel: null, moviendo: false,
  editar: false, elSel: null, nuevo: null, borrar: false,
  prestar: null, verPrestamos: false, perdida: null };   // prestar = { h, nuevo, w, q }   // nuevo = { tipo, p1 } mientras se dibuja un elemento
let ultimas = {};
let dibujo = { clave: "", svg: "" };
const ICONO = {
  reloj: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/></svg>`,
  centrar: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>`,
  lapiz: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/></svg>`,
  llave: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/></svg>`,
  lista: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/></svg>`,
  mas: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`,
};

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

const metros = (pct, eje) => ((pct / 100) * (eje === "x" ? ANCHO : ALTO) * METROS_POR_UNIDAD);
const fmtM = (m) => m.toFixed(m < 10 ? 2 : 1).replace(/\.?0+$/, "") + " m";
const aPct = (m, eje) => +((m / METROS_POR_UNIDAD / (eje === "x" ? ANCHO : ALTO)) * 100).toFixed(3);

function hojaPrestar() {
  const P = ui.prestar, h = S.herramientas.find((x) => x.id === P.h), max = h ? Math.max(0, disponibles(h)) : 99;
  const listo = (P.h || P.nuevo.trim()) && P.w && P.q > 0 && (!h || max >= P.q);
  return `<div class="hoja-h"><div class="grow"><p class="eyebrow" style="margin:0">Prestar herramienta</p><b>${h ? esc(h.nombre) : P.nuevo.trim() ? esc(P.nuevo.trim()) : "¿Qué se presta?"}</b>
      <small>${P.w ? "a " + esc(trabajador(P.w).nombre) : "Elige la herramienta y a quién"}</small></div><button class="x" data-cerrar aria-label="Cerrar">×</button></div>
    <p class="note" style="margin:0 0 6px">Herramienta del proyecto</p>
    ${S.herramientas.length ? `<div class="chips">${S.herramientas.map((x) => { const a = disponibles(x); return `<button class="chip" data-ph="${x.id}" aria-pressed="${P.h === x.id}" ${a < 1 ? "disabled" : ""}>${esc(x.nombre)}<span class="n">${a}/${x.cantidad}</span></button>`; }).join("")}</div>`
      : `<p class="note" style="margin:0">Todavía no hay herramientas registradas. Escribe el nombre abajo.</p>`}
    <div class="addrow"><input id="hNueva" value="${esc(P.nuevo)}" placeholder="…o escribe una nueva (ej. Rotomartillo)" aria-label="Herramienta nueva" autocomplete="off"></div>
    <p class="note" style="margin:12px 0 6px">¿A quién?</p>
    <div class="chips">${S.trabajadores.map((w) => `<button class="chip" data-pw="${w.id}" aria-pressed="${P.w === w.id}">${esc(w.nombre)}</button>`).join("")}</div>
    <div class="row-prestar"><div class="qty"><button id="qm" aria-label="Menos">−</button><output>${P.q}</output><button id="qp" aria-label="Más">+</button></div>
      <button class="btn primary" id="okPrestar" ${listo ? "" : "disabled"}>Prestar</button></div>
    ${h && max < P.q ? `<p class="err">Solo quedan ${max} en bodega.</p>` : ""}`;
}

function hojaPrestamos() {
  const por = {};
  prestamosActivos().forEach((p) => (por[p.trabajador_id] ||= []).push(p));
  const perd = S.prestamos.filter((p) => p.estado === "perdido");
  const total = prestamosActivos().reduce((a, p) => a + p.cantidad, 0);
  return `<div class="hoja-h"><div class="grow"><p class="eyebrow" style="margin:0">Préstamos</p><b>Qué debe entregar cada uno</b>
      <small>${total ? `${total} herramienta${total > 1 ? "s" : ""} afuera` : "Todo está en bodega"}</small></div><button class="x" data-cerrar aria-label="Cerrar">×</button></div>
    <div class="list">${Object.keys(por).length ? Object.entries(por).map(([wid, ps]) => `<div class="person-h">${esc(trabajador(wid).nombre)}<span class="pill out">debe ${ps.reduce((a, p) => a + p.cantidad, 0)}</span></div>
      ${ps.map((p) => `<div class="li"><div class="grow"><b>${p.cantidad} × ${esc(herramienta(p.herramienta_id).nombre)}</b><small>desde ${new Date(p.prestado_en).toLocaleDateString("es-SV", { day: "numeric", month: "short" })} · ${hhmm(p.prestado_en)}</small></div>
        ${ui.perdida === p.id ? `<span class="acts"><button class="btn small danger" data-perdida-si="${p.id}">Sí, se perdió</button><button class="btn small" data-perdida-no>No</button></span>`
          : `<span class="acts"><button class="btn small" data-devolvio="${p.id}">Devolvió</button><button class="btn small danger" data-perdida="${p.id}">Perdida</button></span>`}</div>`).join("")}`).join("")
      : `<div class="empty">Nadie debe nada. Usa “Prestar” cuando alguien se lleve una herramienta.</div>`}</div>
    ${perd.length ? `<p class="eyebrow" style="margin:14px 0 6px">Perdidas</p><div class="list">${perd.map((p) => `<div class="li"><div class="grow"><b>${p.cantidad} × ${esc(herramienta(p.herramienta_id).nombre)}</b><small>La tenía ${esc(trabajador(p.trabajador_id).nombre)}</small></div><span class="pill lost">Perdida</span></div>`).join("")}</div>` : ""}`;
}

const botonesEstado = (actual, attr) => `<div class="estados">${Object.entries(ESTADOS).map(([k, l]) =>
  `<button class="est ${k}" ${attr}="${k}" aria-pressed="${actual === k}">${l}</button>`).join("")}</div>`;

function hojaEditarArea(a) {
  const els = S.elementos.filter((e) => +e.x + e.w / 2 >= a.x && +e.x + e.w / 2 <= +a.x + +a.w && +e.y + e.h / 2 >= a.y && +e.y + e.h / 2 <= +a.y + +a.h);
  return `<div class="hoja-h"><div class="grow"><p class="eyebrow" style="margin:0">Editar plano · área</p><b>${esc(a.nombre)}</b>
      <small>¿Cómo está esta parte de la obra?</small></div><button class="x" data-cerrar aria-label="Cerrar">×</button></div>
    ${botonesEstado(a.estado, "data-estado-area")}
    <p class="note" style="margin:10px 0 0">Medida aprox.: ${fmtM(metros(a.w, "x"))} × ${fmtM(metros(a.h, "y"))}</p>
    ${a.es_receso ? `<p class="note"><span class="pill out">Bodega de receso</span> Aquí van los que salen a receso.</p>` : `<button class="btn small" data-bodega style="margin-top:8px">Usar como bodega de receso</button>`}
    ${els.length ? `<p class="note" style="margin:12px 0 6px">Elementos en esta área:</p><div class="chips">${els.map((e) =>
      `<button class="chip" data-el="${e.id}">${esc(e.nombre || TIPOS_ELEMENTO[e.tipo])}<span class="n">${ESTADOS[e.estado]}</span></button>`).join("")}</div>` : ""}`;
}

function hojaElemento(e) {
  return `<div class="hoja-h"><div class="grow"><p class="eyebrow" style="margin:0">Editar plano · elemento</p><b>${esc(e.nombre || TIPOS_ELEMENTO[e.tipo])}</b>
      <small>${TIPOS_ELEMENTO[e.tipo]}</small></div><button class="x" data-cerrar aria-label="Cerrar">×</button></div>
    ${botonesEstado(e.estado, "data-estado-el")}
    <form class="addrow medidas" id="medEl"><label>Ancho <input id="elAncho" type="number" step="0.05" min="0.1" value="${metros(e.w, "x").toFixed(2)}"> m</label>
      <label>Largo <input id="elLargo" type="number" step="0.05" min="0.1" value="${metros(e.h, "y").toFixed(2)}"> m</label><button class="btn">Aplicar medidas</button></form>
    <form class="addrow" id="nomEl"><input id="elNombre" value="${esc(e.nombre || "")}" placeholder="Nombre (ej. Gradas sala Nissan)" aria-label="Nombre del elemento"><button class="btn">Guardar nombre</button></form>
    <div class="acts" style="margin-top:10px">${ui.borrar ? `<button class="btn danger" data-borrar-si>Sí, borrar del plano</button><button class="btn" data-borrar-no>No</button>`
      : `<button class="btn danger" data-borrar>Borrar elemento</button>`}</div>`;
}

function hojaNuevo() {
  return `<div class="hoja-h"><div class="grow"><p class="eyebrow" style="margin:0">Agregar al plano</p><b>${ui.nuevo.tipo ? TIPOS_ELEMENTO[ui.nuevo.tipo] : "¿Qué vas a agregar?"}</b>
      <small>${ui.nuevo.tipo ? (ui.nuevo.p1 ? "Ahora toca la esquina opuesta. Después puedes ajustar la medida exacta en metros." : "Toca una esquina en el plano.") : "Elige el tipo y luego marca dos esquinas en el plano."}</small></div>
      <button class="x" data-cerrar aria-label="Cancelar">×</button></div>
    <div class="chips">${Object.entries(TIPOS_ELEMENTO).map(([k, l]) => `<button class="chip" data-tipo="${k}" aria-pressed="${ui.nuevo.tipo === k}">${l}</button>`).join("")}</div>`;
}

export function render(V, { hacer, redibujar }) {
  const o = S.obra;
  if (!o) { V.innerHTML = `<h2>Obra</h2><p class="lead">Todavía no hay una obra activa.</p>`; return; }
  const prop = ANCHO / ALTO, receso = !!S.sesion;
  const clave = JSON.stringify([S.areas.map((a) => [a.id, a.x, a.y, a.w, a.h, a.tipo, a.nombre, a.es_receso, a.uso_actual, a.estado]),
    S.elementos.map((e) => [e.id, e.x, e.y, e.w, e.h, e.tipo, e.estado]), S.piezas]);
  if (dibujo.clave !== clave) dibujo = { clave, svg: dibujarObra(S.areas, S.elementos, S.piezas) };
  if (receso) { ui.editar = false; ui.nuevo = null; ui.elSel = null; }
  const elSel = ui.elSel ? S.elementos.find((e) => e.id === ui.elSel) : null;
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
  const es3d = ui.vista === "3d";

  // Barra de mando: aquí van las acciones de la obra (receso y las que se agreguen después)
  const HERRAMIENTAS = [
    receso
      ? `<button class="hud-btn activo" id="hudReceso" title="Terminar receso">${ICONO.reloj}<span>Terminar receso <b class="num" data-desde="${ms(S.sesion.inicio)}"></b></span></button>`
      : `<button class="hud-btn" id="hudReceso" title="Iniciar receso">${ICONO.reloj}<span>Iniciar receso</span></button>`,
  ];

  V.innerHTML = `<div class="titulo-obra"><div><p class="eyebrow">${esc(o.nombre)}${o.propietario ? " · " + esc(o.propietario) : ""}</p>
    <h2>${receso ? "Receso en curso" : "Centro de mando"}</h2></div></div>
  <div class="hud" role="toolbar" aria-label="Acciones de la obra">
    ${HERRAMIENTAS.join("")}
    ${receso || ui.editar ? "" : `<button class="hud-btn secundario" id="hudPrestar">${ICONO.llave}<span>Prestar</span></button>
      <button class="hud-btn secundario" id="hudVerPrestamos">${ICONO.lista}<span>Ver préstamos${prestamosActivos().length ? ` <b class="cuenta">${prestamosActivos().reduce((a, p) => a + p.cantidad, 0)}</b>` : ""}</span></button>`}
    ${receso ? "" : `<button class="hud-btn secundario ${ui.editar ? "activo-edit" : ""}" id="hudEditar">${ICONO.lapiz}<span>${ui.editar ? "Listo" : "Editar plano"}</span></button>`}
    ${ui.editar ? `<button class="hud-btn secundario" id="hudAgregar">${ICONO.mas}<span>Agregar</span></button>` : ""}
    <span class="hud-sep"></span>
    <div class="seg mini hud-vista" role="group" aria-label="Vista">
      <button data-vista="2d" aria-pressed="${!es3d}">2D</button><button data-vista="3d" aria-pressed="${es3d}">3D</button></div>
    ${es3d ? `<button class="hud-icono" id="centrar" aria-label="Volver a la vista inicial">${ICONO.centrar}</button>`
      : `<div class="zoom"><button data-z="-1" aria-label="Alejar" ${ui.zoom === ZOOMS[0] ? "disabled" : ""}>−</button><button data-z="1" aria-label="Acercar" ${ui.zoom === ZOOMS.at(-1) ? "disabled" : ""}>+</button></div>`}
  </div>
  ${receso ? `<p class="pista receso">Receso abierto desde ${hhmm(S.sesion.inicio)}. Toca a quien sale: se pone naranja y camina a la bodega. Tócalo otra vez cuando regrese.</p>`
    : ui.moviendo && w ? `<p class="pista mover">Toca el área a donde va <b>${esc(primerNombre(w.nombre))}</b> <button class="btn small" data-cancelar-mover>Cancelar</button></p>`
    : ui.nuevo?.tipo ? `<p class="pista mover">${ui.nuevo.p1 ? "Toca la esquina opuesta" : "Toca una esquina"} de: <b>${TIPOS_ELEMENTO[ui.nuevo.tipo]}</b></p>`
    : ui.editar ? `<p class="pista mover">Editando el plano: toca un muro, puerta o división para pasarlo de <b>falta</b> (transparente) → <b>en construcción</b> → <b>existe</b> (negro). Toca un área vacía para marcarla completa.</p>`
    : `<p class="pista">Toca un área para ver quién está ahí, o toca a una persona para moverla.${es3d ? " Arrastra para girar, pellizca para acercar." : ""}</p>`}
  ${es3d ? `<div class="escena" id="escena"><p class="cargando">Levantando la obra en 3D…</p></div>`
  : `<div class="mapa-scroll ${ui.zoom > 1 ? "acercado" : ""}" id="mapaScroll">
    <div class="mapa z${ZOOMS.indexOf(ui.zoom)} ${ui.moviendo ? "moviendo" : ""} ${receso ? "en-receso" : ""} ${ui.editar ? "editando" : ""}" style="width:${ui.zoom * 100}%;aspect-ratio:${prop}">
      ${dibujo.svg}
      ${S.areas.map((a) => { const n = conArea.filter((x) => x.area_id === a.id).length;
        const nombre = a.es_receso ? a.uso_actual || "Zona de receso" : a.nombre;
        return `<button class="area ${n ? "ocupada" : ""} ${a.es_receso ? "zr" : ""} ${ui.areaSel === a.id ? "sel" : ""}" data-area="${a.id}"
          style="left:${a.x}%;top:${a.y}%;width:${a.w}%;height:${a.h}%" aria-label="${esc(nombre)}, ${n} asignados"></button>`; }).join("")}
      ${tokens.map(([p, x, y]) => token(p, x, y)).join("")}
      ${ui.editar && !ui.nuevo ? capaPiezas(S.piezas) : ""}
      ${ui.editar ? S.elementos.map((e) => `<button class="el-btn ${ui.elSel === e.id ? "sel" : ""}" data-el="${e.id}" style="left:${e.x}%;top:${e.y}%;width:${e.w}%;height:${e.h}%" aria-label="${esc(e.nombre || TIPOS_ELEMENTO[e.tipo])}"></button>`).join("") : ""}
      ${ui.nuevo?.p1 ? `<span class="punto" style="left:${ui.nuevo.p1[0]}%;top:${ui.nuevo.p1[1]}%"></span>` : ""}
      ${ui.nuevo?.tipo ? `<div class="captura" id="captura"></div>` : ""}
    </div>
  </div>`}
  <div class="section" style="margin-top:12px">${resumen()}</div>
  ${sinArea.length ? `<div class="bandeja"><p class="eyebrow">Sin área asignada (${sinArea.length})</p><div class="chips">${sinArea.map(chipPersona).join("")}</div>
    ${receso ? "" : `<p class="note">Toca a alguien y luego “Mover de área”, o toca un área del mapa para asignar gente.</p>`}</div>` : ""}
  ${!zr && descansando.length ? `<div class="bandeja rest"><p class="eyebrow">En receso</p><div class="chips">${descansando.map(chipPersona).join("")}</div></div>` : ""}
  ${ui.prestar ? `<div class="hoja" role="dialog" aria-label="Prestar">${hojaPrestar()}</div>`
    : ui.verPrestamos ? `<div class="hoja" role="dialog" aria-label="Préstamos">${hojaPrestamos()}</div>`
    : ui.nuevo ? `<div class="hoja" role="dialog" aria-label="Agregar">${hojaNuevo()}</div>`
    : ui.editar && elSel ? `<div class="hoja" role="dialog" aria-label="Elemento">${hojaElemento(elSel)}</div>`
    : ui.editar && aSel ? `<div class="hoja" role="dialog" aria-label="Área">${hojaEditarArea(aSel)}</div>`
    : (w && !ui.moviendo) || (aSel && !ui.moviendo) ? `<div class="hoja" role="dialog" aria-label="Detalle">${w ? hojaTrabajador(w) : hojaArea(aSel)}</div>` : ""}`;

  // ---- Qué pasa al tocar ----
  const tocarPersona = (id) => {
    if (ui.editar) return;
    if (receso) return hacer(async () => { const sale = await cambiarReceso(id); return `${primerNombre(trabajador(id).nombre)} ${sale ? "se fue a receso" : "regresó a trabajar"}`; });
    ui.sel = id; ui.areaSel = null; ui.moviendo = false; redibujar();
  };
  const tocarPunto = (px, py) => {   // al dibujar un elemento nuevo: dos esquinas
    if (!ui.nuevo?.tipo) return false;
    if (!ui.nuevo.p1) { ui.nuevo.p1 = [px, py]; redibujar(); return true; }
    const [x1, y1] = ui.nuevo.p1, tipo = ui.nuevo.tipo;
    const el = { tipo, estado: "falta", x: +Math.min(x1, px).toFixed(2), y: +Math.min(y1, py).toFixed(2), w: +Math.max(0.6, Math.abs(px - x1)).toFixed(2), h: +Math.max(0.6, Math.abs(py - y1)).toFixed(2) };
    ui.nuevo = null;
    hacer(async () => { const n = await agregarElemento(el); ui.elSel = n.id; ui.areaSel = null; return `${TIPOS_ELEMENTO[tipo]} agregado al plano`; });
    return true;
  };
  const tocarArea = (aid) => {
    if (receso || !aid) return;
    if (ui.editar) { ui.areaSel = aid; ui.elSel = null; ui.sel = null; return redibujar(); }
    if (ui.moviendo && ui.sel) {
      const id = ui.sel, a = area(aid); ui.moviendo = false; ui.sel = null;
      return hacer(async () => { await moverTrabajador(id, a.id); return `${primerNombre(trabajador(id).nombre)} → ${a.nombre}`; });
    }
    ui.areaSel = aid; ui.sel = null; redibujar();
  };

  if (es3d) {
    const personas = tokens.map(([p, x, y]) => ({ id: p.id, nombre: primerNombre(p.nombre), x: (x / 100) * ANCHO, y: (y / 100) * ALTO, receso: !!recesoAbierto(p.id), sel: ui.sel === p.id }));
    import("./escena3d.js").then((m) => {
      const cont = V.querySelector("#escena"); if (!cont) return;
      cont.querySelector(".cargando")?.remove();
      m.montar(cont, { svg: dibujo.svg, clave: dibujo.clave, areas: S.areas, elementos: S.elementos, personas, handlers: {
        persona: tocarPersona,
        punto: (px, py) => { // el área más pequeña que contiene el punto tocado
          if (tocarPunto(px, py)) return;
          if (ui.editar) { const e = S.elementos.find((e) => px >= e.x && px <= +e.x + +e.w && py >= e.y && py <= +e.y + +e.h); if (e) { ui.elSel = e.id; ui.areaSel = null; return redibujar(); } }
          const a = S.areas.filter((a) => px >= a.x && px <= +a.x + +a.w && py >= a.y && py <= +a.y + +a.h).sort((p, q) => p.w * p.h - q.w * q.h)[0];
          tocarArea(a?.id);
        } } });
      const c = V.querySelector("#centrar"); if (c) c.onclick = () => m.vistaInicial();
    }).catch(() => { const c = V.querySelector("#escena"); if (c) c.innerHTML = `<p class="cargando">No se pudo abrir el 3D en este celular. Usa la vista 2D.</p>`; });
  } else {
    const mapa = V.querySelector("#mapaScroll");
    if (scroll) { mapa.scrollLeft = scroll[0]; mapa.scrollTop = scroll[1]; }
    // Animación: cada persona camina desde donde estaba hasta su nuevo lugar
    requestAnimationFrame(() => V.querySelectorAll(".tok").forEach((t) => {
      const [x, y] = t.dataset.to.split(",").map(Number); t.style.left = x + "%"; t.style.top = y + "%"; ultimas[t.dataset.w] = [x, y];
    }));
    V.querySelectorAll("[data-z]").forEach((b) => (b.onclick = () => {
      const cx = (mapa.scrollLeft + mapa.clientWidth / 2) / mapa.scrollWidth, cy = (mapa.scrollTop + mapa.clientHeight / 2) / mapa.scrollHeight;
      ui.zoom = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, ZOOMS.indexOf(ui.zoom) + +b.dataset.z))]; redibujar();
      const n = V.querySelector("#mapaScroll"); n.scrollLeft = cx * n.scrollWidth - n.clientWidth / 2; n.scrollTop = cy * n.scrollHeight - n.clientHeight / 2;
    }));
    V.querySelectorAll("[data-area]").forEach((b) => (b.onclick = () => tocarArea(b.dataset.area)));
    // Nombre flotante al pasar el mouse por cada lugar
    const tip = document.createElement("div"); tip.className = "tip"; tip.hidden = true; V.querySelector(".mapa").appendChild(tip);
    const mapaEl = V.querySelector(".mapa");
    V.querySelectorAll(".area, .el-btn, .tok").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        if (e.pointerType !== "mouse") return;
        const r = mapaEl.getBoundingClientRect();
        let t = "";
        if (el.dataset.area) { const a = area(el.dataset.area); t = `<b>${esc(a.es_receso ? a.uso_actual || "Bodega (receso)" : a.nombre)}</b><span>${ESTADOS[a.estado] || ""} · ${enArea(a.id).length} asignados</span>`; }
        else if (el.dataset.el) { const x = S.elementos.find((q) => q.id === el.dataset.el); t = `<b>${esc(x.nombre || TIPOS_ELEMENTO[x.tipo])}</b><span>${ESTADOS[x.estado]}</span>`; }
        else if (el.dataset.w) { const w = trabajador(el.dataset.w), a = area(w.area_id); t = `<b>${esc(w.nombre)}</b><span>${recesoAbierto(w.id) ? "En receso" : a ? esc(a.nombre) : "Sin área"}</span>`; }
        tip.innerHTML = t; tip.hidden = false;
        tip.style.left = e.clientX - r.left + 14 + "px"; tip.style.top = e.clientY - r.top + 14 + "px";
      });
      el.addEventListener("pointerleave", () => (tip.hidden = true));
    });
    // Editar plano: cada pieza avanza falta → en construcción → existe → falta
    const SIG = { falta: "en_proceso", en_proceso: "existe", existe: "falta" };
    V.querySelectorAll("[data-pz]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation(); const i = +el.dataset.pz, nuevo = SIG[estadoPieza(i, S.piezas)];
        S.piezas[i] = nuevo; redibujar();   // se ve al instante; se guarda atrás
        hacer(async () => { await estadoPiezas([i], nuevo); return nuevo === "existe" ? "Agregado al plano actual" : nuevo === "en_proceso" ? "En construcción" : "Marcado como pendiente"; });
      });
    });
    const cap = V.querySelector("#captura");
    if (cap) cap.onclick = (e) => { const r = cap.getBoundingClientRect(); tocarPunto(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100); };
  }

  // ---- Interacción ----
  const $$ = (s) => V.querySelectorAll(s);
  function cerrarTodo() { ui.sel = null; ui.areaSel = null; ui.moviendo = false; ui.elSel = null; ui.nuevo = null; ui.borrar = false; ui.prestar = null; ui.verPrestamos = false; ui.perdida = null; }
  const cerrar = () => { ui.sel = null; ui.areaSel = null; ui.moviendo = false; ui.elSel = null; ui.nuevo = null; ui.borrar = false; ui.prestar = null; ui.verPrestamos = false; ui.perdida = null; redibujar(); };
  $$("[data-vista]").forEach((b) => (b.onclick = () => { ui.vista = b.dataset.vista; try { localStorage.setItem("sym-vista", ui.vista); } catch (e) {} redibujar(); }));
  $$("[data-w]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); tocarPersona(b.dataset.w); }));
  $$("[data-cerrar]").forEach((b) => (b.onclick = cerrar));
  $$("[data-cancelar-mover]").forEach((b) => (b.onclick = () => { ui.moviendo = false; redibujar(); }));
  const mv = V.querySelector("[data-mover]"); if (mv) mv.onclick = () => { ui.moviendo = true; redibujar(); };
  const sc = V.querySelector("[data-sacar]");
  if (sc) sc.onclick = () => { const id = ui.sel; hacer(async () => { await moverTrabajador(id, null); return `${primerNombre(trabajador(id).nombre)} quedó sin área`; }); };
  $$("[data-traer]").forEach((b) => (b.onclick = () => { const id = b.dataset.traer, a = area(ui.areaSel);
    hacer(async () => { await moverTrabajador(id, a.id); return `${primerNombre(trabajador(id).nombre)} → ${a.nombre}`; }); }));
  const he = V.querySelector("#hudEditar");
  if (he) he.onclick = () => { ui.editar = !ui.editar; ui.nuevo = null; ui.elSel = null; ui.areaSel = null; ui.sel = null; ui.moviendo = false; redibujar(); };
  const ha = V.querySelector("#hudAgregar"); if (ha) ha.onclick = () => { ui.nuevo = { tipo: null, p1: null }; ui.elSel = null; ui.areaSel = null; redibujar(); };
  $$("[data-tipo]").forEach((b) => (b.onclick = () => { ui.nuevo = { tipo: b.dataset.tipo, p1: null }; redibujar(); }));
  $$("[data-el]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); ui.elSel = b.dataset.el; ui.areaSel = null; ui.borrar = false; redibujar(); }));
  $$("[data-estado-area]").forEach((b) => (b.onclick = () => { const a = area(ui.areaSel), est = b.dataset.estadoArea;
    const X0 = (a.x / 100) * ANCHO, Y0 = (a.y / 100) * ALTO, X1 = X0 + (a.w / 100) * ANCHO, Y1 = Y0 + (a.h / 100) * ALTO;
    const dentro = PIEZAS.map((p, i) => [p, i]).filter(([p]) => p[0] !== "jardin" && p[1] >= X0 && p[1] <= X1 && p[2] >= Y0 && p[2] <= Y1).map(([, i]) => i);
    dentro.forEach((i) => (S.piezas[i] = est));
    hacer(async () => { await estadoArea(a.id, est); await estadoPiezas(dentro, est); return `${a.nombre}: ${ESTADOS[est]} (${dentro.length} piezas)`; }); }));
  $$("[data-estado-el]").forEach((b) => (b.onclick = () => { const id = ui.elSel, est = b.dataset.estadoEl;
    hacer(async () => { await editarElemento(id, { estado: est }); return `Marcado: ${ESTADOS[est]}`; }); }));
  const ne = V.querySelector("#nomEl"); if (ne) ne.onsubmit = (e) => { e.preventDefault(); const id = ui.elSel, nombre = V.querySelector("#elNombre").value.trim() || null;
    hacer(async () => { await editarElemento(id, { nombre }); return "Nombre guardado"; }); };
  $$("[data-borrar]").forEach((b) => (b.onclick = () => { ui.borrar = true; redibujar(); }));
  $$("[data-borrar-no]").forEach((b) => (b.onclick = () => { ui.borrar = false; redibujar(); }));
  $$("[data-borrar-si]").forEach((b) => (b.onclick = () => { const id = ui.elSel; ui.elSel = null; ui.borrar = false;
    hacer(async () => { await borrarElemento(id); return "Elemento borrado del plano"; }); }));
  // Prestar / Ver préstamos
  const hp = V.querySelector("#hudPrestar"); if (hp) hp.onclick = () => { cerrarTodo(); ui.prestar = { h: null, nuevo: "", w: null, q: 1 }; redibujar(); };
  const hv = V.querySelector("#hudVerPrestamos"); if (hv) hv.onclick = () => { cerrarTodo(); ui.verPrestamos = true; redibujar(); };
  if (ui.prestar) {
    $$("[data-ph]").forEach((b) => (b.onclick = () => { ui.prestar.h = b.dataset.ph; ui.prestar.nuevo = ""; ui.prestar.q = 1; redibujar(); }));
    $$("[data-pw]").forEach((b) => (b.onclick = () => { ui.prestar.w = b.dataset.pw; redibujar(); }));
    const hn = V.querySelector("#hNueva");
    hn.oninput = () => { ui.prestar.nuevo = hn.value; if (hn.value.trim()) ui.prestar.h = null;
      const ok = V.querySelector("#okPrestar"); ok.disabled = !((ui.prestar.h || hn.value.trim()) && ui.prestar.w); };
    hn.onchange = () => redibujar();
    V.querySelector("#qm").onclick = () => { ui.prestar.q = Math.max(1, ui.prestar.q - 1); redibujar(); };
    V.querySelector("#qp").onclick = () => { ui.prestar.q += 1; redibujar(); };
    V.querySelector("#okPrestar").onclick = () => { const P = ui.prestar;
      hacer(async () => { const nombre = await prestarRapido({ herramientaId: P.h, nombreNuevo: P.nuevo, trabajadorId: P.w, cantidad: P.q });
        ui.prestar = null; return `${P.q} × ${nombre} → ${trabajador(P.w).nombre}`; }); };
  }
  $$("[data-devolvio]").forEach((b) => (b.onclick = () => hacer(async () => { await cerrarPrestamo(b.dataset.devolvio, "devuelto"); return "Devuelta a bodega"; })));
  $$("[data-perdida]").forEach((b) => (b.onclick = () => { ui.perdida = b.dataset.perdida; redibujar(); }));
  $$("[data-perdida-no]").forEach((b) => (b.onclick = () => { ui.perdida = null; redibujar(); }));
  $$("[data-perdida-si]").forEach((b) => (b.onclick = () => hacer(async () => { await cerrarPrestamo(b.dataset.perdidaSi, "perdido"); ui.perdida = null; return "Marcada como perdida"; })));
  // Medidas y bodega
  const me = V.querySelector("#medEl"); if (me) me.onsubmit = (ev) => { ev.preventDefault(); const id = ui.elSel;
    const an = parseFloat(V.querySelector("#elAncho").value), la = parseFloat(V.querySelector("#elLargo").value);
    if (!(an > 0 && la > 0)) return; hacer(async () => { await editarElemento(id, { w: aPct(an, "x"), h: aPct(la, "y") }); return `Medida: ${fmtM(an)} × ${fmtM(la)}`; }); };
  const bo = V.querySelector("[data-bodega]"); if (bo) bo.onclick = () => { const a = area(ui.areaSel);
    hacer(async () => { await usarComoBodega(a.id); return `${a.nombre} ahora es la bodega de receso`; }); };

  V.querySelector("#hudReceso").onclick = () => hacer(receso
    ? async () => { await terminarReceso(); return "Receso cerrado, todos a trabajar"; }
    : async () => { await iniciarReceso(); return "Receso iniciado: toca a quien sale a descansar"; });
}
