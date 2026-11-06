// Vista "Obra": centro de mando. Mapa dibujado del proyecto (2D) o maqueta 3D,
// con cada trabajador en el área donde está asignado.
// - Normal: tocas a alguien para ver qué hace y moverlo de área; tocas un área para ver o traer gente.
// - Receso: con "Iniciar receso", cada toque manda a la persona a la bodega (naranja) o la regresa a su área.
import { S, recesoAbierto, enReceso, recesoTurno, turnoDe, turnoActual, limiteReceso, esAlmuerzo, almuerzoHoy, LIMITE_ALMUERZO, prestamosActivos, cambiarReceso, terminarReceso,
  trabajador, herramienta, area, enArea, moverTrabajador,
  ESTADOS, NOMBRE_ESTADO, TIPOS_ELEMENTO, estadoArea, agregarElemento, editarElemento, borrarElemento,
  ponerActividad, prestarRapido, cerrarPrestamo, disponibles, METROS_POR_UNIDAD, usarComoBodega, estadoPiezas } from "../datos.js";
import { esc, iniciales, primerNombre, ms, hhmm } from "../util.js";
import { miniatura, tarjeta, avatares, cara } from "./fotos.js";
import { dibujarObra, capaPiezas, estadoPieza, PIEZAS, CAJAS, grupoDe, queEs, pegar, ANCHO, ALTO, MATERIALES, puntas, pared, largoPared, gruesoPared, enderezar, distPared, enLinea, sobrePared, ANCHO_HUECO } from "./mapa-svg.js";

const ZOOMS = [1, 1.6, 2.4, 3.4];
let vistaGuardada = "2d"; try { vistaGuardada = localStorage.getItem("sym-vista") || "2d"; } catch (e) {}
const ui = { vista: vistaGuardada, zoom: 1, sel: null, areaSel: null, moviendo: false,
  editar: false, elSel: null, nuevo: null, borrar: false,
  prestar: null, verPrestamos: false, perdida: null,
  pz: null,
  modo: null, mas: false };   // modo rápido: "receso" o "almuerzo"; cada toque manda/regresa a esa pausa   // modo rápido: cada toque manda/regresa de receso   // pz = { grupo: [índices], nombre } pieza del plano seleccionada en Editar plano   // prestar = { h, nuevo, w, q }   // nuevo = { tipo, p1 } mientras se dibuja un elemento
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
  const nb = enReceso().length, na = enReceso().filter(esAlmuerzo).length, nl = prestamosActivos().reduce((a, p) => a + p.cantidad, 0);
  const sinArea = S.trabajadores.filter((w) => !w.area_id && !recesoAbierto(w.id)).length;
  return `<div class="stats">
    <div class="stat w"><b>${S.trabajadores.length - nb - sinArea}</b><span>en su área</span></div>
    <div class="stat b"><b>${nb}</b><span>${na ? `en pausa (${na} almorzando)` : "en receso"}</span></div>
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
  const alm = esAlmuerzo(r), usado = alm ? almuerzoHoy(w.id) : r ? recesoTurno(w.id, turnoDe(r.inicio)) : 0;
  return `<button class="tok ${r ? "on-break" : ""} ${alm ? "almuerzo" : ""} ${ui.sel === w.id ? "sel" : ""}" data-w="${w.id}" data-to="${x},${y}" style="left:${px}%;top:${py}%"
    aria-label="${esc(w.nombre)}${r ? (alm ? ", almorzando" : ", en receso") : ""}">
    ${r ? `<span class="bub" data-desde="${ms(r.inicio) - (usado - (Date.now() - ms(r.inicio)))}" data-limite="${alm ? LIMITE_ALMUERZO : limiteReceso()}"></span>` : ""}
    <span class="av">${cara(w)}</span>${herr ? `<span class="tl">${herr}</span>` : ""}
    <span class="nm">${esc(primerNombre(w.nombre))}</span>${w.actividad && !r ? `<span class="act">${esc(w.actividad)}</span>` : ""}</button>`;
}

const chipPersona = (w) => { const r = recesoAbierto(w.id);
  return `<button class="persona ${r ? "on-break" : ""} ${esAlmuerzo(r) ? "almuerzo" : ""}" data-w="${w.id}"><span class="av">${cara(w)}</span><span>${esc(primerNombre(w.nombre))}${w.actividad && !r ? ` <small class="p-act">· ${esc(w.actividad)}</small>` : ""}${r ? ` <span class="num" data-desde="${ms(r.inicio)}"></span>` : ""}</span></button>`; };

function hojaTrabajador(w) {
  const r = recesoAbierto(w.id), a = area(w.area_id);
  const herr = prestamosActivos().filter((p) => p.trabajador_id === w.id);
  return `<div class="hoja-h"><span class="av big ${r ? "on-break" : ""}">${cara(w)}</span>
      <div class="grow"><b>${esc(w.nombre)}</b><small>${esc(w.puesto || "")}${(w.habilidades || []).length ? " · " + esc(w.habilidades.join(", ")) : ""}</small></div>
      <button class="x" data-cerrar aria-label="Cerrar">×</button></div>
    <p class="estado">${a ? `<span class="pill ok">Asignado</span> <b>${esc(a.nombre)}</b>` : `<span class="pill">Sin área</span> Toca “Mover de área” para asignarlo.`}
      ${r ? `<br><span class="pill out ${esAlmuerzo(r) ? "almuerzo" : ""}">${esAlmuerzo(r) ? "Almorzando" : "En receso"}</span> hace <span class="num" data-desde="${ms(r.inicio)}"></span>` : ""}</p>
    <form class="actividad" id="formAct"><label for="actTxt">Haciendo ahora${w.actividad && w.actividad_desde ? ` <span class="note">desde ${hhmm(w.actividad_desde)}</span>` : ""}</label>
      <div class="addrow" style="margin-top:4px"><input id="actTxt" value="${esc(w.actividad || "")}" placeholder="Ej. Repello de pared norte" autocomplete="off" maxlength="80">
      <button class="btn primary">Guardar</button>${w.actividad ? `<button type="button" class="btn" data-sin-act>Quitar</button>` : ""}</div></form>
    ${herr.length ? `<p class="note" style="margin:0 0 10px">Tiene: ${herr.map((p) => `${p.cantidad} × ${esc(herramienta(p.herramienta_id).nombre)}`).join(", ")}</p>` : ""}
    <div class="acts">${r ? `<button class="btn" data-receso-w style="border-color:var(--work);color:var(--work)">Regresar a trabajar</button>`
        : `<button class="btn break" data-receso-w>Mandar a receso</button>`}<button class="btn primary" data-mover>Mover de área</button>${a ? `<button class="btn" data-sacar>Quitar del área</button>` : ""}</div>`;
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
    ${S.herramientas.length ? `<div class="tarjetas">${S.herramientas.map((x) => tarjeta(x, { attr: "data-ph", seleccionada: P.h === x.id, disponibles: disponibles(x) })).join("")}</div>`
      : `<p class="note" style="margin:0">Todavía no hay herramientas registradas. Escribe el nombre abajo.</p>`}
    <div class="addrow"><input id="hNueva" value="${esc(P.nuevo)}" placeholder="…o escribe una nueva (ej. Rotomartillo)" aria-label="Herramienta nueva" autocomplete="off"></div>
    <p class="note" style="margin:12px 0 6px">¿A quién?</p>
    ${avatares(S.trabajadores, { attr: "data-pw", seleccionado: P.w })}
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
      ${ps.map((p) => `<div class="li">${miniatura(herramienta(p.herramienta_id), "foto chica")}<div class="grow"><b>${p.cantidad} × ${esc(herramienta(p.herramienta_id).nombre)}</b><small>desde ${new Date(p.prestado_en).toLocaleDateString("es-SV", { day: "numeric", month: "short" })} · ${hhmm(p.prestado_en)}</small></div>
        ${ui.perdida === p.id ? `<span class="acts"><button class="btn small danger" data-perdida-si="${p.id}">Sí, se perdió</button><button class="btn small" data-perdida-no>No</button></span>`
          : `<span class="acts"><button class="btn small" data-devolvio="${p.id}">Devolvió</button><button class="btn small danger" data-perdida="${p.id}">Perdida</button></span>`}</div>`).join("")}`).join("")
      : `<div class="empty">Nadie debe nada. Usa “Prestar” cuando alguien se lleve una herramienta.</div>`}</div>
    ${perd.length ? `<p class="eyebrow" style="margin:14px 0 6px">Perdidas</p><div class="list">${perd.map((p) => `<div class="li">${miniatura(herramienta(p.herramienta_id), "foto chica")}<div class="grow"><b>${p.cantidad} × ${esc(herramienta(p.herramienta_id).nombre)}</b><small>La tenía ${esc(trabajador(p.trabajador_id).nombre)}</small></div><span class="pill lost">Perdida</span></div>`).join("")}</div>` : ""}`;
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

const chipsMaterial = (actual, attr) => `<div class="chips">${Object.entries(MATERIALES).map(([k, l]) =>
  `<button class="chip" ${attr}="${k}" aria-pressed="${(actual || "block") === k}">${l}</button>`).join("")}</div>`;
// Hoja corta: lo de todos los días (estado y alargar) a la vista; lo demás en "Más opciones"
const masOpciones = () => `<button class="linkbtn" data-mas>${ui.mas ? "Menos opciones ▴" : "Más opciones ▾"}</button>`;
function hojaPared(e) {
  return `<div class="hoja-h"><div class="grow"><b>${esc(e.nombre || "Pared")} · ${fmtM(largoPared(e))}</b>
      <small>${ui.hueco ? `Toca en la pared dónde va la ${ui.hueco.t}` : "Arrastra los puntos verdes para alargarla o acortarla"}</small></div><button class="x" data-cerrar aria-label="Cerrar">×</button></div>
    ${botonesEstado(e.estado, "data-estado-el")}
    <div class="acts" style="margin-top:8px;align-items:center">
      <button class="btn small ${ui.hueco?.t === "puerta" ? "activo-edit" : ""}" data-hueco="puerta">＋ Puerta</button>
      <button class="btn small ${ui.hueco?.t === "ventana" ? "activo-edit" : ""}" data-hueco="ventana">＋ Ventana</button>
      ${(e.huecos || []).map((h, k) => `<button class="chip" data-quitar-hueco="${k}" aria-label="Quitar ${h.t}">${h.t === "puerta" ? "Puerta" : "Ventana"} ${fmtM(h.w)} ×</button>`).join("")}</div>
    <div class="acts" style="margin-top:8px;align-items:center">${ui.borrar ? `<button class="btn small danger" data-borrar-si>Sí, borrar</button><button class="btn small" data-borrar-no>No</button>`
      : `<button class="btn small danger" data-borrar>Borrar</button>`}${masOpciones()}</div>
    ${ui.mas ? `<p class="note" style="margin:10px 0 6px">Material</p>${chipsMaterial(e.material, "data-mat")}
    <form class="addrow medidas" id="medPared"><label>Alto <input id="pAlto" type="number" step="0.1" min="0.2" value="${e.alto ?? ""}" placeholder="auto"> m</label>
      <label>Grueso <input id="pGrueso" type="number" step="0.01" min="0.05" value="${gruesoPared(e)}"> m</label><button class="btn">Aplicar</button></form>
    <form class="addrow" id="nomEl"><input id="elNombre" value="${esc(e.nombre || "")}" placeholder="Nombre (opcional)" aria-label="Nombre de la pared"><button class="btn">Guardar nombre</button></form>` : ""}`;
}
function hojaElemento(e) {
  if (e.trazo) return hojaPared(e);
  return `<div class="hoja-h"><div class="grow"><p class="eyebrow" style="margin:0">Editar plano · elemento</p><b>${esc(e.nombre || TIPOS_ELEMENTO[e.tipo])}</b>
      <small>${TIPOS_ELEMENTO[e.tipo]}</small></div><button class="x" data-cerrar aria-label="Cerrar">×</button></div>
    ${botonesEstado(e.estado, "data-estado-el")}
    ${e.trazo ? "" : `<form class="addrow medidas" id="medEl"><label>Ancho <input id="elAncho" type="number" step="0.05" min="0.1" value="${metros(e.w, "x").toFixed(2)}"> m</label>
      <label>Largo <input id="elLargo" type="number" step="0.05" min="0.1" value="${metros(e.h, "y").toFixed(2)}"> m</label><button class="btn">Aplicar medidas</button></form>`}
    <form class="addrow" id="nomEl"><input id="elNombre" value="${esc(e.nombre || "")}" placeholder="Nombre (ej. Gradas sala Nissan)" aria-label="Nombre del elemento"><button class="btn">Guardar nombre</button></form>
    <div class="acts" style="margin-top:10px">${ui.borrar ? `<button class="btn danger" data-borrar-si>Sí, borrar del plano</button><button class="btn" data-borrar-no>No</button>`
      : `<button class="btn danger" data-borrar>Borrar elemento</button>`}</div>`;
}
function hojaPieza() {
  const g = ui.pz.grupo, estados = g.map((i) => estadoPieza(i, S.piezas));
  const actual = estados.every((e) => e === estados[0]) ? estados[0] : null, pared = esPared(g) && actual !== "quitado";
  return `<div class="hoja-h"><div class="grow"><b>${esc(ui.pz.nombre)}</b>
      <small>${actual === "quitado" ? "Marcada como que no va" : pared ? "Arrastra los puntos verdes para alargarla o acortarla" : "Resaltado en verde en el plano"}</small></div>
      <button class="x" data-cerrar aria-label="Cerrar">×</button></div>
    ${actual === "quitado" ? "" : botonesEstado(actual, "data-estado-pz")}
    <div class="acts" style="margin-top:8px;align-items:center">
      <button class="btn small ${actual === "quitado" ? "" : "danger"}" data-estado-pz="${actual === "quitado" ? (PIEZAS[ui.pz.tocada][4] ? "existe" : "falta") : "quitado"}">${actual === "quitado" ? "Sí va (regresarla)" : "No va"}</button>
      ${actual !== "quitado" ? masOpciones() : ""}</div>
    ${ui.mas && actual !== "quitado" ? `<div class="acts" style="margin-top:8px">${pared ? `<button class="btn small" data-a-pared>Cambiar material, alto o grueso</button>` : ""}
      ${g.length > 1 ? `<button class="btn small" data-solo-pieza>Solo la línea que toqué</button>` : ""}</div>` : ""}`;
}

function hojaNuevo() {
  const pared = ui.nuevo.tipo === "muro";
  return `<div class="hoja-h"><div class="grow"><b>${pared ? "Dibujar pared" : ui.nuevo.tipo ? "Agregar " + TIPOS_ELEMENTO[ui.nuevo.tipo].toLowerCase() : "¿Qué vas a agregar?"}</b>
      <small>${pared ? (ui.nuevo.p1 ? "Ahora toca donde termina." : "Toca donde empieza la pared.") : ui.nuevo.tipo ? (ui.nuevo.p1 ? "Ahora toca la esquina opuesta." : "Toca una esquina en el plano.") : "Elige qué vas a agregar."}</small></div>
      <button class="x" data-cerrar aria-label="Terminar">×</button></div>
    ${pared ? chipsMaterial(ui.nuevo.material, "data-mat-nuevo") : ""}
    <button class="linkbtn" data-mas style="margin-top:8px">${ui.mas ? "Ocultar otras cosas ▴" : "Agregar otra cosa (gradas, jardinera…) ▾"}</button>
    ${ui.mas ? `<div class="chips" style="margin-top:6px">${Object.entries(TIPOS_ELEMENTO).map(([k, l]) => `<button class="chip" data-tipo="${k}" aria-pressed="${ui.nuevo.tipo === k}">${l}</button>`).join("")}</div>` : ""}`;
}

// Pieza(s) del plano vistas como una pared recta: de punta a punta por el lado largo
function paredDePieza(g) {
  const c = g.map((i) => CAJAS[i]), x0 = Math.min(...c.map((q) => q.x0)), x1 = Math.max(...c.map((q) => q.x1)), y0 = Math.min(...c.map((q) => q.y0)), y1 = Math.max(...c.map((q) => q.y1));
  const horiz = x1 - x0 >= y1 - y0, a = horiz ? [x0, (y0 + y1) / 2] : [(x0 + x1) / 2, y0], b = horiz ? [x1, (y0 + y1) / 2] : [(x0 + x1) / 2, y1];
  const grueso = +Math.min(0.4, Math.max(0.1, (horiz ? y1 - y0 : x1 - x0) * METROS_POR_UNIDAD)).toFixed(2);
  const clases = g.map((i) => PIEZAS[i][0]), material = clases.includes("lamina") ? "lamina" : clases.includes("muro") ? "block" : "ventanal";
  return { a, b, grueso, material, grupo: g };
}
const esPared = (g) => g.some((i) => ["muro", "lamina", "fino", "borde"].includes(PIEZAS[i][0]));
// Las dos agarraderas de lo que está seleccionado (pared dibujada o pared del plano), o null
function asasActuales() {
  if (!ui.editar || ui.nuevo || ui.punta || ui.hueco) return null;
  const e = ui.elSel && S.elementos.find((q) => q.id === ui.elSel);
  if (e?.trazo) return { e, puntas: puntas(e.trazo) };
  if (ui.pz && esPared(ui.pz.grupo) && estadoPieza(ui.pz.tocada, S.piezas) !== "quitado") { const w = paredDePieza(ui.pz.grupo); return { w, puntas: [w.a, w.b] }; }
  return null;
}
// Mientras se arrastra una punta: la nueva punta pegada a lo cercano y enderezada respecto a la otra
function moverAsa(asas, idx, x, y) {
  const fija = asas.puntas[1 - idx], otras = S.elementos.filter((q) => q.trazo && q !== asas.e).flatMap((q) => puntas(q.trazo));
  const p = enderezar(fija, pegar(x, y, 9, otras)), ab = idx === 0 ? [p, fija] : [fija, p];
  return { ab, texto: fmtM(Math.hypot(ab[1][0] - ab[0][0], ab[1][1] - ab[0][1]) * METROS_POR_UNIDAD) };
}
let soltarAsa = () => {};

export function render(V, { hacer, redibujar }) {
  const o = S.obra;
  if (!o) { V.innerHTML = `<h2>Obra</h2><p class="lead">Todavía no hay una obra activa.</p>`; return; }
  const prop = ANCHO / ALTO;
  const receso = !!ui.modo, alm = ui.modo === "almuerzo";   // solo el modo rápido cambia lo que hace un toque
  const nRec = enReceso().filter((r) => !esAlmuerzo(r)).length, nAlm = enReceso().filter(esAlmuerzo).length;
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
    `<button class="hud-btn ${ui.modo === "receso" ? "activo-receso" : ""}" id="hudReceso" aria-pressed="${ui.modo === "receso"}">${ICONO.reloj}<span>${ui.modo === "receso"
      ? `Receso de la ${turnoActual() === "manana" ? "mañana" : "tarde"}` : "Receso"}${nRec ? ` <b class="cuenta">${nRec}</b>` : ""}</span></button>`,
    `<button class="hud-btn almuerzo ${alm ? "activo-receso" : ""}" id="hudAlmuerzo" aria-pressed="${alm}">${ICONO.reloj}<span>Almuerzo${nAlm ? ` <b class="cuenta">${nAlm}</b>` : ""}</span></button>`,
  ];

  V.innerHTML = `<div class="titulo-obra"><div><p class="eyebrow">${esc(o.nombre)}${o.propietario ? " · " + esc(o.propietario) : ""}</p>
    <h2>${alm ? "Modo almuerzo" : receso ? "Modo receso" : "Centro de mando"}</h2></div></div>
  <div class="hud" role="toolbar" aria-label="Acciones de la obra">
    ${HERRAMIENTAS.join("")}
    ${receso || ui.editar ? "" : `<button class="hud-btn secundario" id="hudPrestar">${ICONO.llave}<span>Prestar</span></button>
      <button class="hud-btn secundario" id="hudVerPrestamos">${ICONO.lista}<span>Ver préstamos${prestamosActivos().length ? ` <b class="cuenta">${prestamosActivos().reduce((a, p) => a + p.cantidad, 0)}</b>` : ""}</span></button>`}
    ${receso ? "" : `<button class="hud-btn secundario ${ui.editar ? "activo-edit" : ""}" id="hudEditar">${ICONO.lapiz}<span>${ui.editar ? "Listo" : "Editar plano"}</span></button>`}
    ${ui.editar && !receso ? `<button class="hud-btn secundario ${ui.nuevo ? "activo-edit" : ""}" id="hudAgregar"><b aria-hidden="true">＋</b><span>Agregar</span></button>` : ""}
    <span class="hud-sep"></span>
    <div class="seg mini hud-vista" role="group" aria-label="Vista">
      <button data-vista="2d" aria-pressed="${!es3d}">2D</button><button data-vista="3d" aria-pressed="${es3d}">3D</button></div>
    ${es3d ? `<button class="hud-icono" id="centrar" aria-label="Volver a la vista inicial">${ICONO.centrar}</button>`
      : `<div class="zoom"><button data-z="-1" aria-label="Alejar" ${ui.zoom === ZOOMS[0] ? "disabled" : ""}>−</button><button data-z="1" aria-label="Acercar" ${ui.zoom === ZOOMS.at(-1) ? "disabled" : ""}>+</button></div>`}
  </div>
  ${receso ? `<p class="pista receso ${alm ? "almuerzo" : ""}">Toca a quien sale ${alm ? "a almorzar (se pone azul, cuenta su hora)" : "a receso (se pone naranja)"}. Tócalo otra vez cuando regrese. Toca <b>${alm ? "Almuerzo" : "Receso"}</b> otra vez para terminar: todos regresan a trabajar.</p>`
    : ui.moviendo && w ? `<p class="pista mover">Toca el área a donde va <b>${esc(primerNombre(w.nombre))}</b> <button class="btn small" data-cancelar-mover>Cancelar</button></p>`
    : ui.punta ? `<p class="pista mover">Toca a dónde llega la pared: se mueve la punta más cercana (se pega y se endereza).</p>`
    : ui.nuevo?.tipo ? `<p class="pista mover">${ui.nuevo.tipo === "muro" ? (ui.nuevo.p1 ? "Toca donde termina la" : "Toca donde empieza la") : ui.nuevo.p1 ? "Toca la esquina opuesta de:" : "Toca una esquina de:"} <b>${TIPOS_ELEMENTO[ui.nuevo.tipo]}</b></p>`
    : ui.editar ? `<p class="pista mover">Editando: pasa el mouse o toca una pared, puerta o grada (se pone verde) y márcala <b>Hecho</b>, <b>En construcción</b> o <b>Falta</b>.${es3d ? " Los techos se esconden mientras editas." : ""}</p>`
    : `<p class="pista">Toca un área para ver quién está ahí, o toca a una persona para moverla.${es3d ? " Arrastra para moverte, dos dedos o clic derecho para girar, pellizca o rueda para acercar." : ""}</p>`}
  ${es3d ? `<div class="escena" id="escena"><p class="cargando">Levantando la obra en 3D…</p></div>`
  : `<div class="mapa-scroll ${ui.zoom > 1 ? "acercado" : ""}" id="mapaScroll">
    <div class="mapa z${ZOOMS.indexOf(ui.zoom)} ${ui.moviendo ? "moviendo" : ""} ${receso ? "en-receso" : ""} ${ui.editar ? "editando" : ""}" style="width:${ui.zoom * 100}%;aspect-ratio:${prop}">
      ${dibujo.svg}
      ${S.areas.map((a) => { const n = conArea.filter((x) => x.area_id === a.id).length;
        const nombre = a.es_receso ? a.uso_actual || "Zona de receso" : a.nombre;
        return `<button class="area ${n ? "ocupada" : ""} ${a.es_receso ? "zr" : ""} ${ui.areaSel === a.id ? "sel" : ""}" data-area="${a.id}"
          style="left:${a.x}%;top:${a.y}%;width:${a.w}%;height:${a.h}%" aria-label="${esc(nombre)}, ${n} asignados"></button>`; }).join("")}
      ${tokens.map(([p, x, y]) => token(p, x, y)).join("")}
      ${ui.editar && !ui.nuevo ? capaPiezas(S.piezas, ui.pz?.grupo) : ""}
      ${ui.editar ? S.elementos.map((e) => `<button class="el-btn ${e.trazo ? "pared" : ""} ${ui.elSel === e.id ? "sel" : ""}" data-el="${e.id}" style="left:${e.x}%;top:${e.y}%;width:${e.w}%;height:${e.h}%" aria-label="${esc(e.nombre || TIPOS_ELEMENTO[e.tipo])}"></button>`).join("") : ""}
      ${(() => { const A = asasActuales(); if (!A) return ""; const [a, b] = A.puntas, P = (q) => `left:${(q[0] / ANCHO) * 100}%;top:${(q[1] / ALTO) * 100}%`;
        return `<svg class="capa-edicion" viewBox="0 0 ${ANCHO} ${ALTO}" preserveAspectRatio="none"><path id="previa" d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}"/></svg>
          <span class="asa" data-asa="0" style="${P(a)}" aria-label="Arrastra para alargar"></span><span class="asa" data-asa="1" style="${P(b)}" aria-label="Arrastra para alargar"></span>`; })()}
      ${ui.nuevo?.p1 ? `<span class="punto" style="left:${ui.nuevo.p1[0]}%;top:${ui.nuevo.p1[1]}%"></span>` : ""}
      ${ui.nuevo?.tipo || ui.punta || ui.hueco ? `<div class="captura" id="captura"></div>` : ""}
    </div>
  </div>`}
  <div class="section" style="margin-top:12px">${resumen()}</div>
  ${sinArea.length ? `<div class="bandeja"><p class="eyebrow">Sin área asignada (${sinArea.length})</p><div class="chips">${sinArea.map(chipPersona).join("")}</div>
    ${receso ? "" : `<p class="note">Toca a alguien y luego “Mover de área”, o toca un área del mapa para asignar gente.</p>`}</div>` : ""}
  ${!zr && descansando.length ? `<div class="bandeja rest"><p class="eyebrow">En receso</p><div class="chips">${descansando.map(chipPersona).join("")}</div></div>` : ""}
  ${ui.editar && ui.pz ? `<div class="hoja" role="dialog" aria-label="Pieza del plano">${hojaPieza()}</div>`
    : ui.prestar ? `<div class="hoja" role="dialog" aria-label="Prestar">${hojaPrestar()}</div>`
    : ui.verPrestamos ? `<div class="hoja" role="dialog" aria-label="Préstamos">${hojaPrestamos()}</div>`
    : ui.nuevo ? `<div class="hoja" role="dialog" aria-label="Agregar">${hojaNuevo()}</div>`
    : ui.editar && elSel ? `<div class="hoja" role="dialog" aria-label="Elemento">${hojaElemento(elSel)}</div>`
    : ui.editar && aSel ? `<div class="hoja" role="dialog" aria-label="Área">${hojaEditarArea(aSel)}</div>`
    : (w && !ui.moviendo) || (aSel && !ui.moviendo) ? `<div class="hoja" role="dialog" aria-label="Detalle">${w ? hojaTrabajador(w) : hojaArea(aSel)}</div>` : ""}`;

  // ---- Qué pasa al tocar ----
  const tocarPersona = (id) => {
    if (ui.editar) return;
    if (receso) return hacer(async () => { const sale = await cambiarReceso(id, ui.modo); return `${primerNombre(trabajador(id).nombre)} ${sale ? (alm ? "se fue a almorzar" : "se fue a receso") : "regresó a trabajar"}`; });
    ui.sel = id; ui.areaSel = null; ui.moviendo = false; redibujar();
  };
  const puntasDibujadas = () => S.elementos.filter((e) => e.trazo).flatMap((e) => puntas(e.trazo));
  const tocarPunto = (px, py) => {   // al dibujar un elemento nuevo: dos esquinas
    if (ui.hueco) {   // puerta o ventana: se pone donde se tocó la pared
      const e = S.elementos.find((q) => q.id === ui.elSel); if (!e) { ui.hueco = null; return false; }
      const { p, d } = sobrePared(e, (px / 100) * ANCHO, (py / 100) * ALTO); if (d > 25) return true;
      const t = ui.hueco.t, huecos = [...(e.huecos || []), { t, c: [+p[0].toFixed(1), +p[1].toFixed(1)], w: ANCHO_HUECO[t] }];
      e.huecos = huecos; ui.hueco = null; redibujar();
      hacer(async () => { await editarElemento(e.id, { huecos }); return `${t === "puerta" ? "Puerta" : "Ventana"} agregada`; });
      return true;
    }
    if (ui.punta) {   // mover la punta más cercana de una pared dibujada
      const e = S.elementos.find((q) => q.id === ui.punta); if (!e) { ui.punta = null; return false; }
      const [a, b] = puntas(e.trazo), t = [(px / 100) * ANCHO, (py / 100) * ALTO];
      const otras = puntasDibujadas().filter((q) => q !== a && q !== b && !(q[0] === a[0] && q[1] === a[1]) && !(q[0] === b[0] && q[1] === b[1]));
      const mueveA = Math.hypot(t[0] - a[0], t[1] - a[1]) < Math.hypot(t[0] - b[0], t[1] - b[1]), fija = mueveA ? b : a;
      const nueva = enderezar(fija, pegar(t[0], t[1], 9, otras)), cambios = pared(mueveA ? nueva : a, mueveA ? b : nueva);
      Object.assign(e, cambios); ui.punta = null; redibujar();
      hacer(async () => { await editarElemento(e.id, cambios); return `Pared: ${fmtM(largoPared(e))}`; });
      return true;
    }
    if (!ui.nuevo?.tipo) return false;
    const nuevoMaterial = ui.nuevo.material;
    if (!ui.nuevo.p1) { ui.nuevo.p1 = [px, py]; redibujar(); return true; }
    const [x1, y1] = ui.nuevo.p1, tipo = ui.nuevo.tipo;
    if (tipo === "muro") {   // pared: de una punta a la otra
      const extra = puntasDibujadas(), a = ui.nuevo.a || pegar((x1 / 100) * ANCHO, (y1 / 100) * ALTO, 9, extra);
      const b = enderezar(a, pegar((px / 100) * ANCHO, (py / 100) * ALTO, 9, extra.concat(ui.nuevo.hechas || [])));
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 4) return true;
      ui.nuevo = null;
      guardarPared(null, a, b, { tipo, estado: "falta", material: ui.nuevo?.material || nuevoMaterial || "block" });
      return true;
    }
    const el = { tipo, estado: "falta", x: +Math.min(x1, px).toFixed(2), y: +Math.min(y1, py).toFixed(2), w: +Math.max(0.6, Math.abs(px - x1)).toFixed(2), h: +Math.max(0.6, Math.abs(py - y1)).toFixed(2) };
    ui.nuevo = null;
    hacer(async () => { const n = await agregarElemento(el); ui.elSel = n.id; ui.areaSel = null; return `${TIPOS_ELEMENTO[tipo]} agregado al plano`; });
    return true;
  };
  const tocarPieza = (i) => { const grupo = grupoDe(i); ui.mas = false; ui.pz = { tocada: i, grupo, nombre: queEs(grupo) }; ui.areaSel = null; ui.elSel = null; redibujar(); };
  const textoPieza = (grupo) => { const est = grupo.map((i) => estadoPieza(i, S.piezas));
    return `<b>${esc(queEs(grupo))}</b><span>${est.every((e) => e === est[0]) ? NOMBRE_ESTADO[est[0]] : "Partes en distinto estado"}</span>`; };
  const tocarArea = (aid) => {
    if (receso || !aid) return;
    if (ui.editar) { ui.areaSel = aid; ui.elSel = null; ui.sel = null; ui.pz = null; return redibujar(); }
    if (ui.moviendo && ui.sel) {
      const id = ui.sel, a = area(aid); ui.moviendo = false; ui.sel = null;
      return hacer(async () => { await moverTrabajador(id, a.id); return `${primerNombre(trabajador(id).nombre)} → ${a.nombre}`; });
    }
    ui.areaSel = aid; ui.sel = null; redibujar();
  };

  if (es3d) {
    const personas = tokens.map(([p, x, y]) => ({ id: p.id, nombre: primerNombre(p.nombre) + (p.actividad && !recesoAbierto(p.id) ? " · " + p.actividad : ""), x: (x / 100) * ANCHO, y: (y / 100) * ALTO, receso: !!recesoAbierto(p.id), almuerzo: esAlmuerzo(recesoAbierto(p.id)), sel: ui.sel === p.id }));
    import("./escena3d.js").then((m) => {
      const cont = V.querySelector("#escena"); if (!cont) return;
      cont.querySelector(".cargando")?.remove();
      m.montar(cont, { svg: dibujo.svg, clave: dibujo.clave, areas: S.areas, elementos: S.elementos, piezas: S.piezas, personas, editar: ui.editar && !ui.nuevo && !ui.punta && !ui.hueco, seleccion: ui.pz?.grupo, asas: asasActuales()?.puntas || null, handlers: {
        asaMueve: (idx, x, y) => { const A = asasActuales(); return A ? moverAsa(A, idx, x, y) : null; },
        asaSuelta: (idx, x, y) => { const A = asasActuales(); if (A) soltarAsa(A, moverAsa(A, idx, x, y).ab); },
        persona: tocarPersona, pieza: tocarPieza, textoPieza,
        pared: (x, y) => { const e = S.elementos.filter((q) => q.trazo).find((q) => distPared(x, y, q) < 8); if (!e) return false; ui.mas = false; ui.elSel = e.id; ui.pz = null; ui.areaSel = null; ui.borrar = false; redibujar(); return true; },
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
        else if (el.dataset.w) { const w = trabajador(el.dataset.w), a = area(w.area_id); t = `<b>${esc(w.nombre)}</b><span>${recesoAbierto(w.id) ? "En receso" : (w.actividad ? esc(w.actividad) + " · " : "") + (a ? esc(a.nombre) : "Sin área")}</span>`; }
        tip.innerHTML = t; tip.hidden = false;
        tip.style.left = e.clientX - r.left + 14 + "px"; tip.style.top = e.clientY - r.top + 14 + "px";
      });
      el.addEventListener("pointerleave", () => (tip.hidden = true));
    });
    // Editar plano: cada pieza avanza falta → en construcción → existe → falta
    const pzs = [...V.querySelectorAll("[data-pz]")], porIdx = new Map(pzs.map((el) => [+el.dataset.pz, el]));
    let hov = [];
    const quitarHov = () => { hov.forEach((el) => el.classList.remove("hov")); hov = []; tip.hidden = true; };
    pzs.forEach((el) => {
      el.addEventListener("click", (e) => { e.stopPropagation(); tocarPieza(+el.dataset.pz); });
      // al pasar el mouse se resalta la pieza completa (toda la pared, todas las gradas…)
      el.addEventListener("pointerenter", (e) => {
        if (e.pointerType !== "mouse") return;
        quitarHov(); const grupo = grupoDe(+el.dataset.pz);
        hov = grupo.map((i) => porIdx.get(i)).filter(Boolean); hov.forEach((p) => p.classList.add("hov"));
        tip.innerHTML = textoPieza(grupo); tip.hidden = false;
      });
      el.addEventListener("pointermove", (e) => { const r = mapaEl.getBoundingClientRect(); tip.style.left = e.clientX - r.left + 14 + "px"; tip.style.top = e.clientY - r.top + 14 + "px"; });
      el.addEventListener("pointerleave", quitarHov);
    });
    const cap = V.querySelector("#captura");
    if (cap) cap.onclick = (e) => { const r = cap.getBoundingClientRect(); tocarPunto(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100); };
  }

  // ---- Alargar paredes arrastrando sus puntas ----
  soltarAsa = (A, ab, w0) => {
    if (A?.e) return guardarPared(A.e, ab[0], ab[1]);   // pared dibujada: cambia su largo (y se junta si toca otra en la misma línea)
    const w = w0 || A.w, [a, b] = ab || [w.a, w.b], g = w.grupo;   // pared del plano → se vuelve pared editable
    const est = estadoPieza(ui.pz.tocada, S.piezas);
    g.forEach((i) => (S.piezas[i] = "quitado")); ui.pz = null;
    guardarPared(null, a, b, { tipo: "muro", estado: est === "quitado" ? "falta" : est, material: w.material, grueso: w.grueso }, () => estadoPiezas(g, "quitado"));
  };
  // Guarda una pared de a → b. Si hay otras en la misma línea que la tocan o se enciman, quedan como una sola pared.
  // base = pared que se está cambiando (o null si es nueva, con sus datos en "nueva").
  function guardarPared(base, a, b, nueva = {}, antes = null) {
    const otras = S.elementos.filter((q) => q.trazo && q !== base);
    const r = enLinea(a, b, otras), quien = base || r.juntas[0] || null, sobran = r.juntas.filter((q) => q !== quien);
    const huecos = [...(quien?.huecos || []), ...sobran.flatMap((q) => q.huecos || [])];
    const cambios = { ...pared(r.a, r.b), huecos }, largo = fmtM(Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]) * METROS_POR_UNIDAD);
    S.elementos = S.elementos.filter((q) => !sobran.includes(q));
    let tmp = null;
    if (quien) Object.assign(quien, cambios); else { tmp = { id: "tmp" + Date.now(), ...nueva, ...cambios }; S.elementos.push(tmp); }
    ui.mas = false; ui.areaSel = null; ui.elSel = (quien || tmp).id; redibujar();   // se ve al instante
    hacer(async () => {
      if (antes) await antes();
      if (quien) await editarElemento(quien.id, cambios); else { const n = await agregarElemento({ ...nueva, ...cambios }); if (ui.elSel === tmp.id) ui.elSel = n.id; }
      for (const q of sobran) await borrarElemento(q.id);
      return `Pared ${quien ? "" : "agregada "}· ${largo}${sobran.length || (quien && !base) ? " (unida en una sola)" : ""}`;
    });
  }
  if (!es3d) V.querySelectorAll(".asa").forEach((h) => {
    const mapa = V.querySelector(".mapa"), prev = V.querySelector("#previa"), tipA = V.querySelector(".mapa .tip");
    let A = null, ultimo = null;
    const punto = (e) => { const r = mapa.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * ANCHO, ((e.clientY - r.top) / r.height) * ALTO]; };
    h.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); try { h.setPointerCapture(e.pointerId); } catch (_) {} A = asasActuales(); h.classList.add("arrastrando"); });
    h.addEventListener("pointermove", (e) => {
      if (!A) return; const idx = +h.dataset.asa, m = moverAsa(A, idx, ...punto(e)); ultimo = m.ab;
      const q = m.ab[idx]; h.style.left = (q[0] / ANCHO) * 100 + "%"; h.style.top = (q[1] / ALTO) * 100 + "%";
      prev.setAttribute("d", `M${m.ab[0][0]} ${m.ab[0][1]}L${m.ab[1][0]} ${m.ab[1][1]}`);
      if (tipA) { const r = mapa.getBoundingClientRect(); tipA.innerHTML = `<b>${m.texto}</b>`; tipA.hidden = false; tipA.style.left = e.clientX - r.left + 16 + "px"; tipA.style.top = e.clientY - r.top + 16 + "px"; }
    });
    const fin = () => { if (!A) return; const a = A; A = null; h.classList.remove("arrastrando"); if (tipA) tipA.hidden = true; if (ultimo) soltarAsa(a, ultimo); };
    h.addEventListener("pointerup", fin); h.addEventListener("pointercancel", fin);
  });

  // ---- Interacción ----
  const $$ = (s) => V.querySelectorAll(s);
  function cerrarTodo() { ui.hueco = null; ui.mas = false; ui.punta = null; ui.pz = null; ui.sel = null; ui.areaSel = null; ui.moviendo = false; ui.elSel = null; ui.nuevo = null; ui.borrar = false; ui.prestar = null; ui.verPrestamos = false; ui.perdida = null; }
  const cerrar = () => { ui.hueco = null; ui.mas = false; ui.punta = null; ui.pz = null; ui.sel = null; ui.areaSel = null; ui.moviendo = false; ui.elSel = null; ui.nuevo = null; ui.borrar = false; ui.prestar = null; ui.verPrestamos = false; ui.perdida = null; redibujar(); };
  $$("[data-vista]").forEach((b) => (b.onclick = () => { ui.vista = b.dataset.vista; try { localStorage.setItem("sym-vista", ui.vista); } catch (e) {} redibujar(); }));
  $$("[data-w]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); tocarPersona(b.dataset.w); }));
  $$("[data-cerrar]").forEach((b) => (b.onclick = cerrar));
  $$("[data-cancelar-mover]").forEach((b) => (b.onclick = () => { ui.moviendo = false; redibujar(); }));
  // Actividad del trabajador
  const fa = V.querySelector("#formAct");
  if (fa) {
    const guardar = (texto) => { const id = ui.sel, n = primerNombre(trabajador(id).nombre);
      hacer(async () => { await ponerActividad(id, texto); return texto ? `${n}: ${texto}` : `${n} sin actividad`; }); };
    fa.onsubmit = (e) => { e.preventDefault(); guardar(V.querySelector("#actTxt").value); };
    fa.querySelectorAll("[data-act]").forEach((b) => (b.onclick = () => guardar(b.dataset.act)));
    const sa = fa.querySelector("[data-sin-act]"); if (sa) sa.onclick = () => guardar("");
  }
  const mv = V.querySelector("[data-mover]"); if (mv) mv.onclick = () => { ui.moviendo = true; redibujar(); };
  const sc = V.querySelector("[data-sacar]");
  if (sc) sc.onclick = () => { const id = ui.sel; hacer(async () => { await moverTrabajador(id, null); return `${primerNombre(trabajador(id).nombre)} quedó sin área`; }); };
  $$("[data-traer]").forEach((b) => (b.onclick = () => { const id = b.dataset.traer, a = area(ui.areaSel);
    hacer(async () => { await moverTrabajador(id, a.id); return `${primerNombre(trabajador(id).nombre)} → ${a.nombre}`; }); }));
  const he = V.querySelector("#hudEditar");
  if (he) he.onclick = () => { ui.pz = null; ui.editar = !ui.editar; ui.nuevo = null; ui.elSel = null; ui.areaSel = null; ui.sel = null; ui.moviendo = false; redibujar(); };
  $$("[data-hueco]").forEach((b) => (b.onclick = () => { ui.hueco = ui.hueco?.t === b.dataset.hueco ? null : { t: b.dataset.hueco }; redibujar(); }));
  $$("[data-quitar-hueco]").forEach((b) => (b.onclick = () => { const e = S.elementos.find((q) => q.id === ui.elSel), k = +b.dataset.quitarHueco;
    const huecos = (e.huecos || []).filter((_, i) => i !== k); e.huecos = huecos; redibujar();
    hacer(async () => { await editarElemento(e.id, { huecos }); return "Hueco quitado"; }); }));
  const mo = V.querySelector("[data-mas]"); if (mo) mo.onclick = () => { ui.mas = !ui.mas; redibujar(); };
  const ha = V.querySelector("#hudAgregar"); if (ha) ha.onclick = () => { ui.nuevo = ui.nuevo ? null : { tipo: "muro", p1: null, material: "block" }; ui.elSel = null; ui.areaSel = null; redibujar(); };
  $$("[data-tipo]").forEach((b) => (b.onclick = () => { ui.nuevo = { tipo: b.dataset.tipo, p1: null, material: ui.nuevo?.material }; redibujar(); }));
  $$("[data-mat-nuevo]").forEach((b) => (b.onclick = () => { ui.nuevo.material = b.dataset.matNuevo; redibujar(); }));
  $$("[data-mat]").forEach((b) => (b.onclick = () => { const id = ui.elSel, material = b.dataset.mat;
    hacer(async () => { await editarElemento(id, { material }); return `Material: ${MATERIALES[material]}`; }); }));
  const mp = V.querySelector("#medPared"); if (mp) mp.onsubmit = (ev) => { ev.preventDefault(); const id = ui.elSel;
    const alto = parseFloat(V.querySelector("#pAlto").value), grueso = parseFloat(V.querySelector("#pGrueso").value);
    const cambios = { alto: alto > 0 ? alto : null, grueso: grueso > 0 ? grueso : null };
    hacer(async () => { await editarElemento(id, cambios); return `Alto ${alto > 0 ? fmtM(alto) : "automático"} · grueso ${grueso > 0 ? fmtM(grueso) : "normal"}`; }); };
  const pp = V.querySelector("[data-punta]"); if (pp) pp.onclick = () => { ui.punta = ui.punta ? null : ui.elSel; redibujar(); };
  const ap = V.querySelector("[data-a-pared]"); if (ap) ap.onclick = () => { const w = paredDePieza(ui.pz.grupo); soltarAsa(null, null, w); };
  $$("[data-el]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); if (ui.punta || ui.hueco) return; ui.mas = false; ui.elSel = b.dataset.el; ui.areaSel = null; ui.borrar = false; redibujar(); }));
  $$("[data-estado-area]").forEach((b) => (b.onclick = () => { const a = area(ui.areaSel), est = b.dataset.estadoArea;
    const X0 = (a.x / 100) * ANCHO, Y0 = (a.y / 100) * ALTO, X1 = X0 + (a.w / 100) * ANCHO, Y1 = Y0 + (a.h / 100) * ALTO;
    const dentro = PIEZAS.map((p, i) => [p, i]).filter(([p, i]) => p[0] !== "jardin" && S.piezas[i] !== "quitado" && p[1] >= X0 && p[1] <= X1 && p[2] >= Y0 && p[2] <= Y1).map(([, i]) => i);
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
  // Marcar pieza(s) del plano
  $$("[data-estado-pz]").forEach((b) => (b.onclick = () => { const g = ui.pz.grupo, est = b.dataset.estadoPz, nombre = ui.pz.nombre;
    g.forEach((i) => (S.piezas[i] = est)); ui.pz = null; redibujar();   // se ve al instante; se guarda atrás
    hacer(async () => { await estadoPiezas(g, est); return `${nombre}: ${NOMBRE_ESTADO[est]}`; }); }));
  const sp = V.querySelector("[data-solo-pieza]"); if (sp) sp.onclick = () => { ui.pz.grupo = [ui.pz.tocada]; ui.pz.nombre = queEs(ui.pz.grupo); redibujar(); };

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

  // Receso / Almuerzo: un toque lo activa; otro toque lo termina (todos los de esa pausa regresan a trabajar)
  const modoPausa = (tipo) => {
    cerrarTodo(); const antes = ui.modo, nombre = { receso: "Receso", almuerzo: "Almuerzo" };
    ui.modo = antes === tipo ? null : tipo;
    const abiertos = (t) => enReceso().some((r) => (r.tipo || "receso") === t);
    if (antes && abiertos(antes)) return hacer(async () => { await terminarReceso(antes); return `${nombre[antes]} terminado, todos a trabajar`; });
    redibujar();
  };
  const hr = V.querySelector("#hudReceso"); if (hr) hr.onclick = () => modoPausa("receso");
  const hal = V.querySelector("#hudAlmuerzo"); if (hal) hal.onclick = () => modoPausa("almuerzo");
  const rw = V.querySelector("[data-receso-w]"); if (rw) rw.onclick = () => { const id = ui.sel;
    hacer(async () => { const sale = await cambiarReceso(id, recesoAbierto(id)?.tipo || "receso"); return `${primerNombre(trabajador(id).nombre)} ${sale ? "se fue a receso" : "regresó a trabajar"}`; }); };
}
