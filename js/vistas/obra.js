// Vista "Obra": centro de mando. Mapa dibujado del proyecto (2D) o maqueta 3D,
// con cada trabajador en el área donde está asignado.
// - Normal: tocas a alguien para ver qué hace y moverlo de área; tocas un área para ver o traer gente.
// - Receso: con "Iniciar receso", cada toque manda a la persona a la bodega (naranja) o la regresa a su área.
import { S, recesoAbierto, enReceso, recesoTurno, turnoDe, turnoActual, limiteReceso, esAlmuerzo, almuerzoHoy, LIMITE_ALMUERZO, prestamosActivos, cambiarReceso, terminarReceso,
  trabajador, herramienta, area, enArea, moverTrabajador,
  ESTADOS, NOMBRE_ESTADO, TIPOS_ELEMENTO, estadoArea, agregarArea, editarArea, borrarArea, agregarElemento, editarElemento, borrarElemento,
  ponerActividad, prestarRapido, cerrarPrestamo, disponibles, METROS_POR_UNIDAD, usarComoBodega, estadoPiezas, deshacer, puedeDeshacer, rehacer, puedeRehacer, guardarColor } from "../datos.js";
import { esc, iniciales, primerNombre, ms, hhmm } from "../util.js";
import { lugarEn, lugarDe, nombreArea, areaEn } from "./lugares.js";
import * as planDia from "./dashboard.js";
import { miniatura, tarjeta, avatares, cara } from "./fotos.js";
import { FICHAS, nEscalones, esquinas, agarraderas, moverFigura, girar, correr, guardable, figuraNueva, medidasFigura, medidaCorta, altoDe, dentroDe, centro, U, altoPared, moverRect, rectPct, cercaDe } from "./figuras.js";
import { dibujarObra, capaPiezas, estadoPieza, PIEZAS, CAJAS, grupoDe, queEs, pegar, ANCHO, ALTO, MATERIALES, puntas, pared, largoPared, gruesoPared, enderezar, distPared, enLinea, sobrePared, ANCHO_HUECO, CHICAS, rampaDe, piezaEn, medidasPieza, medidasArea, medidasElemento } from "./mapa-svg.js";
// el 3D se pide con la versión: así el celular no se queda con un 3D viejo guardado (súbelo junto con sw.js)
const ESCENA = "./escena3d.js?v=170";

const ZOOMS = [1, 1.6, 2.4, 3.4];
let vistaGuardada = "2d"; try { vistaGuardada = localStorage.getItem("sym-vista") || "2d"; } catch (e) {}
let sinGenteGuardado = false; try { sinGenteGuardado = localStorage.getItem("sym-sin-gente") === "1"; } catch (e) {}
const ui = { vista: vistaGuardada, sinGente: sinGenteGuardado, zoom: 1, sel: null, areaSel: null, moviendo: false,
  editar: false, elSel: null, nuevo: null, borrar: false,
  prestar: null, verPrestamos: false, perdida: null,
  pz: null,
  modo: null, mas: false, agregar: false,
  herr: "mano", grosor: { lapiz: 0.15, cortar: 0.6 } };   // herramienta del editor y grosor del lápiz / del corte (m)   // agregar: hoja con las fichas para agregar algo   // modo rápido: "receso" o "almuerzo"; cada toque manda/regresa a esa pausa   // modo rápido: cada toque manda/regresa de receso   // pz = { grupo: [índices], nombre } pieza del plano seleccionada en Editar plano   // prestar = { h, nuevo, w, q }   // nuevo = { tipo, p1 } mientras se dibuja un elemento
let ultimas = {};
let dibujo = { clave: "", svg: "" };
const ICONO = {
  ojo: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`,
  ojoNo: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.8 0 3.4-.5 4.8-1.3M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>`,
  comida: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2 1-3 4-3 7h3"/></svg>`,
  reloj: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M3 21h14"/><path d="M8 3.5c-.8 1 .8 1.8 0 3M12 3.5c-.8 1 .8 1.8 0 3"/></svg>`,   // taza de café humeante
  deshacer: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>`,
  rehacer: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></svg>`,
  centrar: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>`,
  lapiz: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/></svg>`,
  llave: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/></svg>`,
  lista: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/></svg>`,
  mas: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`,
};

export function resumen() {
  const nb = enReceso().length, na = enReceso().filter(esAlmuerzo).length, nl = prestamosActivos().reduce((a, p) => a + p.cantidad, 0);
  const sinArea = S.trabajadores.filter((w) => !w.area_id && w.pos_x == null && !recesoAbierto(w.id)).length;
  return `<div class="stats">
    <div class="stat w"><b>${S.trabajadores.length - nb - sinArea}</b><span>ubicados</span></div>
    <div class="stat b"><b>${nb}</b><span>${na ? `en pausa (${na} almorzando)` : "en receso"}</span></div>
    <div class="stat"><b>${nl}</b><span>herramientas prestadas</span></div></div>`;
}

// Reparte a las personas de un área en una cuadrícula dentro del rectángulo
// Los que tienen lugar exacto (pos_x, pos_y dentro del área) van ahí; los demás se reparten.
const enSuLugar = (w, a) => w.pos_x != null && w.pos_y != null && +w.pos_x >= +a.x && +w.pos_x <= +a.x + +a.w && +w.pos_y >= +a.y && +w.pos_y <= +a.y + +a.h;
function posiciones(a, gente, prop) {
  const fijos = gente.filter((w) => enSuLugar(w, a));
  return [...fijos.map((w) => [w, +w.pos_x, +w.pos_y]), ...repartir(a, gente.filter((w) => !fijos.includes(w)), prop)];
}
function repartir(a, gente, prop) {
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
    <p class="estado">${lugarDe(w) ? `<span class="pill ok">Está en</span> <b>${esc(lugarDe(w))}</b>` : `<span class="pill">Sin área</span> Toca “Mover de área” para asignarlo.`}
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
    <p class="note" style="margin-top:0;margin-bottom:6px">Toca a alguien para asignarlo a esta área:</p>
    <div class="chips">${otros.map((w) => `<button class="chip" data-traer="${w.id}">${esc(w.nombre)}${w.area_id ? `<span class="n">${esc(area(w.area_id)?.nombre || "")}</span>` : ""}</button>`).join("")}</div>`;
}

const metros = (pct, eje) => ((pct / 100) * (eje === "x" ? ANCHO : ALTO) * METROS_POR_UNIDAD);
const fmtM = (m) => m.toFixed(m < 10 ? 2 : 1).replace(/\.?0+$/, "") + " m";

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
  return `<div class="hoja-h"><div class="grow"><p class="eyebrow" style="margin:0">Herramientas</p><b>Quién tiene qué</b>
      <small>${total ? `${total} herramienta${total > 1 ? "s" : ""} afuera` : "Todo está en bodega"}</small></div><button class="x" data-cerrar aria-label="Cerrar">×</button></div>
    <button class="btn primary big" id="hojaPrestar" style="display:block;width:100%;margin-top:4px;margin-bottom:12px">＋ Prestar herramienta</button>
    <div class="list">${Object.keys(por).length ? Object.entries(por).map(([wid, ps]) => `<div class="person-h">${esc(trabajador(wid).nombre)}<span class="pill out">debe ${ps.reduce((a, p) => a + p.cantidad, 0)}</span></div>
      ${ps.map((p) => `<div class="li">${miniatura(herramienta(p.herramienta_id), "foto chica")}<div class="grow"><b>${p.cantidad} × ${esc(herramienta(p.herramienta_id).nombre)}</b><small>desde ${new Date(p.prestado_en).toLocaleDateString("es-SV", { day: "numeric", month: "short" })} · ${hhmm(p.prestado_en)}</small></div>
        ${ui.perdida === p.id ? `<span class="acts"><button class="btn small danger" data-perdida-si="${p.id}">Sí, se perdió</button><button class="btn small" data-perdida-no>No</button></span>`
          : `<span class="acts"><button class="btn small" data-devolvio="${p.id}">Devolvió</button><button class="btn small danger" data-perdida="${p.id}">Perdida</button></span>`}</div>`).join("")}`).join("")
      : `<div class="empty">Nadie debe nada. Usa “Prestar” cuando alguien se lleve una herramienta.</div>`}</div>
    ${perd.length ? `<p class="eyebrow" style="margin:14px 0 6px">Perdidas</p><div class="list">${perd.map((p) => `<div class="li">${miniatura(herramienta(p.herramienta_id), "foto chica")}<div class="grow"><b>${p.cantidad} × ${esc(herramienta(p.herramienta_id).nombre)}</b><small>La tenía ${esc(trabajador(p.trabajador_id).nombre)}</small></div><span class="pill lost">Perdida</span></div>`).join("")}</div>` : ""}`;
}

const botonesEstado = (actual, attr, nombres = ESTADOS) => `<div class="estados">${Object.entries(ESTADOS).map(([k, l]) =>
  `<button class="est ${k}" ${attr}="${k}" aria-pressed="${actual === k}">${nombres[k] || l}</button>`).join("")}</div>`;
const ESTADOS_HOYO = { falta: "Por excavar", en_proceso: "Excavando", existe: "Excavado" };
// Editor como juego de dibujo: se escoge una herramienta y se usa el dedo. Nada de escoger "qué es".
const HERRAMIENTAS = [["mano", "✋", "Mover"], ["lapiz", "✏️", "Construir"], ["cortar", "✂️", "Cortar"], ["borrar", "🧽", "Borrar"], ["zona", "⬚", "Zona"]];
const GROSORES = { lapiz: [[0.1, "10 cm"], [0.15, "15 cm"], [0.3, "30 cm"], [0.6, "60 cm"], [1, "1 m"]], cortar: [[0.3, "30 cm"], [0.6, "60 cm"], [1, "1 m"], [2, "2 m"], [4, "4 m"]] };
const PISTA_HERR = { mano: "Toca algo para moverlo o estirarlo con sus puntos.", lapiz: "Pared: toca donde empieza y donde termina (o arrastra el dedo). Columna: toca dos veces el mismo punto.",
  cortar: "Arrastra el dedo: se abre una zanja. Si cruza una pared, le abre un hueco.", borrar: "Toca lo que quieras quitar. Con ↶ regresa.",
  zona: "Arrastra para marcar una zona donde pueda estar la gente." };
const DIBUJA = new Set(["lapiz", "cortar", "zona"]);

function hojaEditarArea(a) {
  const els = S.elementos.filter((e) => +e.x + e.w / 2 >= a.x && +e.x + e.w / 2 <= +a.x + +a.w && +e.y + e.h / 2 >= a.y && +e.y + e.h / 2 <= +a.y + +a.h);
  const admin = S.perfil?.rol === "admin";
  return `<div class="hoja-h"><div class="grow"><p class="eyebrow" style="margin:0">Editar plano · área</p><b>${esc(nombreArea(a))}</b>
      <small>${medidasArea(a)}</small></div><button class="x" data-cerrar aria-label="Cerrar">×</button></div>
    <p class="note pista-puntos"><i class="pt esquina"></i> esquinas y <i class="pt lado"></i> lados: agrandar o achicar · <i class="pt centro"></i> mover</p>
    <form class="addrow" id="nomArea" style="margin:0 0 10px"><input id="areaNombre" value="${esc(a.nombre || "")}" placeholder="Nombre (opcional). Ej. Baños, Lockers, Caseta" aria-label="Nombre del área" autocomplete="off"><button class="btn">Guardar</button></form>
    <div class="juego">${jbtn('data-dividir="v"', "◫", "Dividir en 2 ⇆")}${jbtn('data-dividir="h"', "⊟", "Dividir en 2 ⇅")}
      ${a.es_receso ? "" : jbtn("data-bodega", "☕", "Bodega de receso")}${admin && !a.es_receso ? jbtn("data-borrar-area", "✕", "Borrar área", "borrar") : ""}</div>
    ${ui.borrar === "area" ? `<div class="acts confirma-borrar"><span>¿Borrar “${esc(nombreArea(a))}”? La gente que estaba ahí se queda en su lugar.</span><button class="btn small danger" data-borrar-area-si>Sí, borrar</button><button class="btn small" data-borrar-no>No</button></div>` : ""}
    ${a.es_receso ? `<p class="note"><span class="pill out">Bodega de receso</span> Aquí van los que salen a receso.</p>` : ""}
    <p class="note" style="margin:12px 0 6px">¿Cómo está esta parte de la obra?</p>${botonesEstado(a.estado, "data-estado-area")}
    ${els.length ? `<p class="note" style="margin:12px 0 6px">Elementos en esta área:</p><div class="chips">${els.map((e) =>
      `<button class="chip" data-el="${e.id}">${esc(e.nombre || TIPOS_ELEMENTO[e.tipo])}<span class="n">${ESTADOS[e.estado]}</span></button>`).join("")}</div>` : ""}`;
}

const chipsMaterial = (actual, attr) => `<div class="chips">${Object.entries(MATERIALES).map(([k, l]) =>
  `<button class="chip" ${attr}="${k}" aria-pressed="${(actual || "block") === k}">${l}</button>`).join("")}</div>`;
// Hoja corta: lo de todos los días (estado y alargar) a la vista; lo demás en "Más opciones"
const masOpciones = () => `<button class="linkbtn" data-mas>${ui.mas ? "Menos opciones ▴" : "Más opciones ▾"}</button>`;
const borrarSiNo = (txt) => ui.borrar ? `<div class="acts confirma-borrar"><span>¿${txt}?</span><button class="btn small danger" data-borrar-si>Sí, borrar</button><button class="btn small" data-borrar-no>No</button></div>` : "";
// Botones grandes "de juego": cada toque cambia un poquito; no hay que escribir medidas
const jbtn = (attr, ico, txt, extra = "") => `<button class="jbtn ${extra}" ${attr}><b aria-hidden="true">${ico}</b>${txt}</button>`;
function hojaPared(e) {
  if (ui.huecoSel != null && e.huecos?.[ui.huecoSel]) return hojaHueco(e);
  if (e.material === "caseta") return hojaCara(e);
  return `<div class="hoja-h"><div class="grow"><b>${esc(e.nombre || "Pared")}</b>
      <small>${ui.hueco ? `Toca en la pared dónde va la ${ui.hueco.t}` : medidasElemento(e)}</small></div><button class="x" data-cerrar aria-label="Cerrar">×</button></div>
    <p class="note pista-puntos"><i class="pt esquina"></i> Arrastra los puntos verdes para alargarla o acortarla.</p>
    <div class="juego">
      ${jbtn('data-alto="1"', "▲", "Más alta")}${jbtn('data-alto="-1"', "▼", "Más baja")}
      ${jbtn('data-grueso="1"', "▐▌", "Más gruesa")}${jbtn('data-grueso="-1"', "▏", "Más delgada")}
      ${jbtn('data-hueco="puerta"', "◫", "Puerta", ui.hueco?.t === "puerta" ? "on" : "")}${jbtn('data-hueco="ventana"', "▭", "Ventana", ui.hueco?.t === "ventana" ? "on" : "")}
      ${jbtn("data-borrar", "✕", "Borrar", "borrar")}</div>
    ${e.quita ? `<div class="acts" style="margin-top:8px"><span class="note">Ya se quitó ${NOM_PARTE[e.quita]}</span><button class="btn small" data-regresa-parte>Regresarla</button></div>` : ""}
    ${borrarSiNo("Borrar esta pared")}
    <div style="margin-top:10px">${botonesEstado(e.estado, "data-estado-el")}</div>
    <div style="margin-top:8px">${masOpciones()}</div>
    ${ui.mas ? `<p class="note" style="margin:10px 0 6px">Material</p>${chipsMaterial(e.material, "data-mat")}
    <form class="addrow" id="nomEl"><input id="elNombre" value="${esc(e.nombre || "")}" placeholder="Nombre (opcional)" aria-label="Nombre de la pared"><button class="btn">Guardar nombre</button></form>` : ""}`;
}
// Paleta para pintar lo que se ve en 3D
const COLORES = [["#cfd0cc", "Gris perla"], ["#f2f2ef", "Blanco"], ["#ece3cf", "Crema"], ["#4a4f55", "Gris grafito"], ["#1f2226", "Negro"], ["#e0b022", "Amarillo"],
  ["#e0662e", "Naranja"], ["#b8352b", "Rojo"], ["#2f6fc2", "Azul"], ["#5f9a45", "Verde"], ["#8a6a45", "Café"]];
function hojaParte(pt) {
  const actual = (S.obra?.colores || {})[pt.clave] || pt.original;
  return `<div class="hoja-h"><div class="grow"><b>${esc(pt.nombre || "Pieza")}</b><small>Toca un color para pintarlo</small></div><button class="x" data-cerrar aria-label="Cerrar">×</button></div>
    <div class="colores">${COLORES.map(([c, n]) => `<button class="color" data-color="${c}" aria-pressed="${actual === c}" title="${n}"><i style="background:${c}"></i>${n}</button>`).join("")}</div>
    <div class="acts" style="margin-top:10px">${(S.obra?.colores || {})[pt.clave] ? `<button class="btn small" data-color-original>Volver al color original</button>` : ""}
      ${pt.cara ? `<button class="btn small" data-abrir-cara="${pt.cara}">Puertas y ventanas de esta pared</button>` : ""}</div>`;
}
// Cara de una caseta existente: aquí solo se quitan, ponen o cambian sus puertas y ventanas (la caseta se queda como está)
function hojaCara(e) {
  const [edif, cara] = (e.nombre || "Caseta · cara").split(" · ");
  return `<div class="hoja-h"><div class="grow"><b>${esc(edif)}</b><small>${ui.hueco ? `Toca en la pared dónde va la ${ui.hueco.t}` : esc(cara || "")}</small></div><button class="x" data-cerrar aria-label="Cerrar">×</button></div>
    <div class="juego">${jbtn('data-hueco="puerta"', "◫", "Poner puerta", ui.hueco?.t === "puerta" ? "on" : "")}${jbtn('data-hueco="ventana"', "▭", "Poner ventana", ui.hueco?.t === "ventana" ? "on" : "")}</div>`;
}
const NOM_PARTE = { murito: "el murito", lamina: "la lámina" };
const EST_HUECO = { abierto: "hueco hecho", falta: "falta abrir", quitar: "no va" };
// Una puerta o ventana tocada: solo lo de ella (cómo está, ancho, borrar)
function hojaHueco(e) {
  const h = e.huecos[ui.huecoSel], k = ui.huecoSel;
  return `<div class="hoja-h"><div class="grow"><b>${h.t === "puerta" ? "Puerta" : "Ventana"} · ${fmtM(h.w)}</b><small>${esc(e.nombre || "Pared")}</small></div><button class="x" data-hueco-sel="${k}" aria-label="Cerrar">×</button></div>
    <div class="chips" role="group" aria-label="Cómo está">${[["", "✓ Ya está"], ["falta", "Falta abrir"], ["quitar", "✕ No va"]].map(([v, t]) =>
      `<button class="chip" data-hueco-est="${v}" aria-pressed="${(h.e === "abierto" ? "" : h.e || "") === v}">${t}</button>`).join("")}</div>
    <div class="acts" style="margin-top:10px"><button class="btn small" data-hueco-ancho="-1" aria-label="Más angosta">−</button><span class="note">Ancho ${fmtM(h.w)}</span><button class="btn small" data-hueco-ancho="1" aria-label="Más ancha">+</button>
      <span style="flex:1"></span><button class="btn small danger" data-quitar-hueco="${k}">Borrar</button></div>`;
}
// Cualquier otra cosa (hoyo, columna, bloque, gradas…): se deforma con los puntos y se ajusta con botones
function hojaElemento(e) {
  if (e.trazo) return hojaPared(e);
  const hoyo = e.tipo === "hoyo", techo = e.tipo === "techo";
  return `<div class="hoja-h"><div class="grow"><b>${esc(e.nombre || TIPOS_ELEMENTO[e.tipo] || "Elemento")}</b>
      <small>${medidasFigura(e)}</small></div><button class="x" data-cerrar aria-label="Cerrar">×</button></div>
    <p class="note pista-puntos"><i class="pt esquina"></i> esquinas: deformar · <i class="pt lado"></i> estirar o aplanar un lado · <i class="pt centro"></i> mover</p>
    <div class="juego">
      ${jbtn('data-alto="1"', "▲", hoyo ? "Más hondo" : techo ? "Más arriba" : "Más alto")}${jbtn('data-alto="-1"', "▼", hoyo ? "Menos hondo" : techo ? "Más abajo" : "Más bajo")}
      ${jbtn('data-girar="15"', "↻", "Girar")}${jbtn("data-copiar", "⧉", "Copiar")}${jbtn("data-borrar", "✕", "Borrar", "borrar")}</div>
    ${e.tipo === "grada" ? `<div class="juego" style="margin-top:6px">${jbtn('data-escalon="1"', "＋", "Un escalón más")}${jbtn('data-escalon="-1"', "－", "Un escalón menos")}
      ${jbtn('data-subida="1"', "⟲", "Sube por otro lado")}</div>` : ""}
    ${borrarSiNo(`Borrar ${hoyo ? "este hoyo" : "esto"} del plano`)}
    <div style="margin-top:10px">${botonesEstado(e.estado, "data-estado-el", hoyo ? ESTADOS_HOYO : ESTADOS)}</div>
    <div style="margin-top:8px">${masOpciones()}</div>
    ${ui.mas ? `<form class="addrow" id="nomEl"><input id="elNombre" value="${esc(e.nombre || "")}" placeholder="Nombre (ej. Zanja de aguas lluvias)" aria-label="Nombre"><button class="btn">Guardar nombre</button></form>` : ""}`;
}
function hojaAgregar() {
  return `<div class="hoja-h"><div class="grow"><b>¿Qué vas a agregar?</b><small>Aparece en el centro de la pantalla. Después lo estiras y lo deformas con los dedos.</small></div>
      <button class="x" data-cerrar aria-label="Cerrar">×</button></div>
    <div class="fichas">${FICHAS.map((f, i) => `<button class="ficha" data-ficha="${i}"><span class="ficha-ico f-${f.tipo}" aria-hidden="true">${f.icono}</span>${esc(f.nombre)}</button>`).join("")}</div>`;
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
      <small>${pared ? "Material de la pared:" : ui.nuevo.tipo ? "Márcalo en el plano." : "Elige qué vas a agregar."}</small></div>
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
const detalle = (g) => g.some((i) => CHICAS.has(i)) && g.every((i) => CHICAS.has(i) || !["muro", "columna"].includes(PIEZAS[i][0]));   // cuadrito suelto, no es pared
const esPared = (g) => !rampaDe(g[0]) && !detalle(g) && g.some((i) => ["muro", "lamina", "fino", "borde"].includes(PIEZAS[i][0]));
// Las dos agarraderas de lo que está seleccionado (pared dibujada o pared del plano), o null
function asasActuales() {
  if (!ui.editar || ui.nuevo || ui.punta || ui.hueco) return null;
  const e = ui.elSel && S.elementos.find((q) => q.id === ui.elSel);
  if (e?.trazo) return e.material === "caseta" ? null : { e, puntas: puntas(e.trazo) };   // la cara de una caseta no se estira
  if (e) { const pts = esquinas(e); return { f: e, pts, puntas: agarraderas(pts).puntos }; }
  const ar = !ui.pz && ui.areaSel && area(ui.areaSel);
  if (ar) { const pts = esquinas(ar); return { f: ar, ar: true, pts, puntas: agarraderas(pts).puntos }; }
  if (ui.pz && esPared(ui.pz.grupo) && estadoPieza(ui.pz.tocada, S.piezas) !== "quitado") { const w = paredDePieza(ui.pz.grupo); return { w, puntas: [w.a, w.b] }; }
  return null;
}
// Mientras se arrastra una punta: la nueva punta pegada a lo cercano y enderezada respecto a la otra
function moverAsa(asas, idx, x, y) {
  if (asas.f) { const pts = (asas.ar ? moverRect : moverFigura)(asas.pts, idx, x, y); return { pts, asas: specFigura(pts), texto: medidaCorta(pts) }; }
  const fija = asas.puntas[1 - idx], otras = S.elementos.filter((q) => q.trazo && q !== asas.e).flatMap((q) => puntas(q.trazo));
  const p = enderezar(fija, pegar(x, y, 9, otras)), ab = idx === 0 ? [p, fija] : [fija, p];
  return { ab, texto: fmtM(Math.hypot(ab[1][0] - ab[0][0], ab[1][1] - ab[0][1]) * METROS_POR_UNIDAD) };
}
const dPoli = (pts) => "M" + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L") + "Z";
const enMapa = (q) => `left:${(q[0] / ANCHO) * 100}%;top:${(q[1] / ALTO) * 100}%`;
// El botón tocable de una figura tiene su forma (no todo el rectángulo que la encierra)
function recorte(e) {
  const pts = esquinas(e), X = (e.x / 100) * ANCHO, Y = (e.y / 100) * ALTO, W = (e.w / 100) * ANCHO || 1, H = (e.h / 100) * ALTO || 1;
  return `clip-path:polygon(${pts.map(([x, y]) => `${(((x - X) / W) * 100).toFixed(1)}% ${(((y - Y) / H) * 100).toFixed(1)}%`).join(",")})`;
}
// Contorno de la figura elegida con sus 9 agarraderas (2D)
const NOMBRE_ASA = { esquina: "Esquina: arrastra para deformar", lado: "Lado: arrastra para estirar o aplanar", centro: "Centro: arrastra para mover" };
function capaFigura(pts) {
  const a = agarraderas(pts);
  return `<svg class="capa-edicion" viewBox="0 0 ${ANCHO} ${ALTO}" preserveAspectRatio="none"><path id="previa" class="fig" d="${dPoli(pts)}"/></svg>
    <span class="medida" id="medidaFig" style="${enMapa(a.puntos.at(-1))}">${medidaCorta(pts)}</span>
    ${a.puntos.map((q, i) => `<span class="asa ${a.tipos[i]}" data-asa-fig="${i}" style="${enMapa(q)}" aria-label="${NOMBRE_ASA[a.tipos[i]]}" title="${NOMBRE_ASA[a.tipos[i]]}"></span>`).join("")}`;
}
const specFigura = (pts) => { const a = agarraderas(pts); return { puntos: a.puntos, tipos: a.tipos, n: pts.length }; };
const specAsas = (A) => (A ? (A.f ? specFigura(A.pts) : A.puntas) : null);
let soltarAsa = () => {};
// Atajos de teclado: un solo escucha para toda la app; apunta a la versión más reciente de la vista
let teclas = () => {}; document.addEventListener("keydown", (e) => teclas(e));

export function render(V, { hacer, redibujar }) {
  const o = S.obra;
  if (!o) { V.innerHTML = `<h2>Obra</h2><p class="lead">Todavía no hay una obra activa.</p>`; return; }
  const prop = ANCHO / ALTO;
  const receso = !!ui.modo && !ui.editar, alm = ui.modo === "almuerzo";   // el modo rápido solo cambia lo que hace tocar a una PERSONA; lo demás del mapa sigue igual
  const nRec = enReceso().filter((r) => !esAlmuerzo(r)).length, nAlm = enReceso().filter(esAlmuerzo).length;
  const clave = JSON.stringify([S.areas.map((a) => [a.id, a.x, a.y, a.w, a.h, a.tipo, a.nombre, a.es_receso, a.uso_actual, a.estado]),
    S.elementos.map((e) => [e.id, e.x, e.y, e.w, e.h, e.tipo, e.estado, e.forma, e.alto, e.grueso, e.trazo, e.material, e.huecos]), S.piezas]);
  if (dibujo.clave !== clave) dibujo = { clave, svg: dibujarObra(S.areas, S.elementos, S.piezas) };
  const elSel = ui.elSel ? S.elementos.find((e) => e.id === ui.elSel) : null;
  const zr = S.areas.find((a) => a.es_receso);
  if (receso) ui.sel = null;
  const w = ui.sel ? S.trabajadores.find((x) => x.id === ui.sel) : null;
  const aSel = ui.areaSel ? area(ui.areaSel) : null;

  const descansando = S.trabajadores.filter((x) => recesoAbierto(x.id));
  const trabajando = S.trabajadores.filter((x) => !recesoAbierto(x.id));
  const conArea = trabajando.filter((x) => area(x.area_id));
  const sueltos = trabajando.filter((x) => !area(x.area_id) && x.pos_x != null && x.pos_y != null);   // puestos en cualquier lugar del plano
  const sinArea = trabajando.filter((x) => !area(x.area_id) && !sueltos.includes(x));
  const tokens = [
    ...S.areas.flatMap((a) => posiciones(a, conArea.filter((x) => x.area_id === a.id), prop)),
    ...sueltos.map((x) => [x, +x.pos_x, +x.pos_y]),
    ...(zr ? repartir(zr, descansando, prop) : []),
  ];
  const prev = V.querySelector("#mapaScroll"), scroll = prev ? [prev.scrollLeft, prev.scrollTop] : null;
  const es3d = ui.vista === "3d";

  // Tres botones grandes (lo de todos los días); los controles del mapa van encima del mapa
  const nPrest = prestamosActivos().reduce((a, p) => a + p.cantidad, 0), recOn = ui.modo === "receso";
  const ACCIONES = ui.editar ? "" : `<div class="acciones dos" role="toolbar" aria-label="Acciones de la obra">
    <button class="accion pausa ${recOn ? "on" : ""}" id="hudReceso" aria-pressed="${recOn}">${ICONO.reloj}
      <b>${recOn ? "Terminar receso" : "Receso"}</b><small>${recOn ? (nRec ? `${nRec} afuera` : "Toca a quien sale") : nRec ? `${nRec} en receso` : "15 minutos"}</small></button>
    <button class="accion pausa almuerzo ${alm ? "on" : ""}" id="hudAlmuerzo" aria-pressed="${alm}">${ICONO.comida}
      <b>${alm ? "Terminar almuerzo" : "Almuerzo"}</b><small>${alm ? (nAlm ? `${nAlm} afuera` : "Toca a quien sale") : nAlm ? `${nAlm} almorzando` : "1 hora"}</small></button>
  </div>`;
  const BARRA_MAPA = `<div class="barra-mapa">
      <div class="flot-grupo">${ui.editar ? `<button class="flot-btn on" id="hudEditar">✓<span>Listo</span></button>` : `<button class="flot-btn icono" id="hudEditar" aria-label="Editar el plano" title="Editar el plano">${ICONO.lapiz}</button>`}
        ${ui.editar ? `<button class="flot-btn icono" id="hudDeshacer" aria-label="Deshacer lo último" title="Deshacer (Ctrl+Z)" ${puedeDeshacer() ? "" : "disabled"}>${ICONO.deshacer}</button>
          <button class="flot-btn icono" id="hudRehacer" aria-label="Rehacer" title="Rehacer (Ctrl+Y)" ${puedeRehacer() ? "" : "disabled"}>${ICONO.rehacer}</button>` : ""}</div>
      <div class="flot-grupo">${ui.editar ? "" : `<button class="flot-btn icono ${ui.sinGente ? "on" : ""}" id="verGente" aria-pressed="${ui.sinGente}" aria-label="${ui.sinGente ? "Mostrar a los trabajadores" : "Ocultar a los trabajadores y ver solo el plano"}" title="${ui.sinGente ? "Mostrar trabajadores" : "Solo el plano"}">${ui.sinGente ? ICONO.ojoNo : ICONO.ojo}</button>`}
      <div class="seg mini flot-vista" role="group" aria-label="Vista"><button data-vista="2d" aria-pressed="${!es3d}">2D</button><button data-vista="3d" aria-pressed="${es3d}">3D</button></div></div>
    </div>`;
  const HERR = ui.editar ? `<div class="herr-barra" role="toolbar" aria-label="Herramientas">
      <div class="herr-fila">${HERRAMIENTAS.map(([k, ico, txt]) => `<button class="herr ${ui.herr === k ? "on" : ""}" data-herr="${k}" aria-pressed="${ui.herr === k}"><b aria-hidden="true">${ico}</b>${txt}</button>`).join("")}</div>
      ${GROSORES[ui.herr] ? `<div class="grosores"><span>Grosor</span>${GROSORES[ui.herr].map(([g, t]) => `<button class="chip ${ui.grosor[ui.herr] === g ? "" : ""}" data-grosor="${g}" aria-pressed="${ui.grosor[ui.herr] === g}"><i style="height:${Math.max(2, Math.min(14, g * 12))}px"></i>${t}</button>`).join("")}</div>` : ""}
    </div>` : "";
  const FLOTANTES = `<div class="flot flot-abajo">${es3d ? `<button class="flot-btn icono" id="centrar" aria-label="Volver a la vista inicial">${ICONO.centrar}</button>`
      : `<button class="flot-btn icono" data-z="1" aria-label="Acercar" ${ui.zoom === ZOOMS.at(-1) ? "disabled" : ""}>+</button><button class="flot-btn icono" data-z="-1" aria-label="Alejar" ${ui.zoom === ZOOMS[0] ? "disabled" : ""}>−</button>`}</div>`;

  V.innerHTML = `${ui.editar ? `<div class="titulo-obra"><div><h2>Editando el plano</h2></div></div>` : ""}
  ${ACCIONES}
  ${receso ? `<p class="pista receso ${alm ? "almuerzo" : ""}"><span>${alm ? "🍽️ <b>Almuerzo</b>" : "☕ <b>Receso</b>"}: toca a cada persona que sale. Cuando regrese, tócala otra vez. Para terminar, toca <b>${alm ? "Terminar almuerzo" : "Terminar receso"}</b> arriba.</span></p>`
    : ui.moviendo && w ? `<p class="pista mover">Toca el lugar exacto a donde va <b>${esc(primerNombre(w.nombre))}</b> <button class="btn small" data-cancelar-mover>Cancelar</button></p>`
    : ui.punta ? `<p class="pista mover">Toca a dónde llega la pared.</p>`
    : ui.nuevo?.tipo === "muro" ? `<p class="pista mover">${ui.nuevo.p1 ? "Ahora toca donde termina (o arrastra)." : "Toca donde empieza la pared, o arrástrala de punta a punta."}</p>`
    : ui.nuevo?.tipo ? `<p class="pista mover">${ui.nuevo.p1 ? "Toca la esquina opuesta." : "Toca una esquina."}</p>`
    : ui.editar && ui.inicio ? `<p class="pista mover">Ahora toca dónde termina la pared. Toca el mismo punto para una columna.</p>`
    : ui.editar ? `<p class="pista mover">${PISTA_HERR[ui.herr]}</p>`
    : ""}
  ${BARRA_MAPA}
  ${HERR}
  <div class="mapa-caja">
  ${es3d ? `<div class="escena" id="escena"><p class="cargando">Levantando la obra en 3D…</p></div>`
  : `<div class="mapa-scroll ${ui.zoom > 1 ? "acercado" : ""}" id="mapaScroll">
    <div class="mapa z${ZOOMS.indexOf(ui.zoom)} ${ui.moviendo ? "moviendo" : ""} ${receso ? "en-receso" : ""} ${ui.editar ? "editando" : ""}" style="width:${ui.zoom * 100}%;aspect-ratio:${prop}">
      ${dibujo.svg}
      ${S.areas.map((a) => { const n = conArea.filter((x) => x.area_id === a.id).length;
        const nombre = a.es_receso ? a.uso_actual || "Zona de receso" : a.nombre;
        return `<button class="area ${n ? "ocupada" : ""} ${a.es_receso ? "zr" : ""} ${ui.areaSel === a.id ? "sel" : ""}" data-area="${a.id}"
          style="left:${a.x}%;top:${a.y}%;width:${a.w}%;height:${a.h}%" aria-label="${esc(nombre)}, ${n} asignados"></button>`; }).join("")}
      ${ui.sinGente || ui.editar ? "" : tokens.map(([p, x, y]) => token(p, x, y)).join("")}
      ${ui.editar && !ui.nuevo ? capaPiezas(S.piezas, ui.pz?.grupo) : ""}
      ${ui.editar ? S.elementos.map((e) => `<button class="el-btn ${e.trazo ? "pared" : ""} ${e.tipo === "techo" ? "techo" : ""} ${e.tipo === "hoyo" ? "hoyo" : ""} ${ui.elSel === e.id ? "sel" : ""}" data-el="${e.id}" style="left:${e.x}%;top:${e.y}%;width:${e.w}%;height:${e.h}%${e.trazo ? "" : ";" + recorte(e)}" aria-label="${esc(e.nombre || TIPOS_ELEMENTO[e.tipo])}"></button>`).join("") : ""}
      ${(() => { const A = asasActuales(); if (!A) return ""; if (A.f) return capaFigura(A.pts); const [a, b] = A.puntas, P = (q) => `left:${(q[0] / ANCHO) * 100}%;top:${(q[1] / ALTO) * 100}%`;
        const L = fmtM(Math.hypot(b[0] - a[0], b[1] - a[1]) * METROS_POR_UNIDAD);
        return `<svg class="capa-edicion" viewBox="0 0 ${ANCHO} ${ALTO}" preserveAspectRatio="none"><path id="previa" d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}"/></svg>
          <span class="medida" style="left:${((a[0] + b[0]) / 2 / ANCHO) * 100}%;top:${((a[1] + b[1]) / 2 / ALTO) * 100}%">${L}</span>
          <span class="asa" data-asa="0" style="${P(a)}" aria-label="Arrastra para alargar"></span><span class="asa" data-asa="1" style="${P(b)}" aria-label="Arrastra para alargar"></span>`; })()}
      ${ui.nuevo?.p1 ? `<span class="punto" style="left:${ui.nuevo.p1[0]}%;top:${ui.nuevo.p1[1]}%"></span>` : ""}
      ${ui.nuevo?.tipo || ui.punta || ui.hueco || (ui.moviendo && ui.sel) || (ui.editar && DIBUJA.has(ui.herr)) ? `<div class="captura ${ui.moviendo ? "mover" : ""} ${ui.editar && DIBUJA.has(ui.herr) ? "dibujar " + ui.herr : ""}" id="captura"></div>` : ""}
    </div>
  </div>`}
  ${FLOTANTES}</div>
  <div class="section" style="margin-top:12px">${resumen()}</div>
  ${sinArea.length ? `<div class="bandeja"><p class="eyebrow">Sin lugar en el plano (${sinArea.length})</p><div class="chips">${sinArea.map(chipPersona).join("")}</div>
    ${receso ? "" : `<p class="note">Toca a alguien y luego “Mover de área”, o toca un área del mapa para asignar gente.</p>`}</div>` : ""}
  ${!zr && descansando.length ? `<div class="bandeja rest"><p class="eyebrow">En receso</p><div class="chips">${descansando.map(chipPersona).join("")}</div></div>` : ""}
  ${ui.editar ? "" : `<section class="plan-dia" id="planDia" aria-label="Plan del día"></section>`}
  ${ui.editar && ui.pz ? `<div class="hoja" role="dialog" aria-label="Pieza del plano">${hojaPieza()}</div>`
    : ui.prestar ? `<div class="hoja" role="dialog" aria-label="Prestar">${hojaPrestar()}</div>`
    : ui.verPrestamos ? `<div class="hoja" role="dialog" aria-label="Préstamos">${hojaPrestamos()}</div>`
    : ui.nuevo ? `<div class="hoja" role="dialog" aria-label="Agregar">${hojaNuevo()}</div>`
    : ui.editar && ui.agregar ? `<div class="hoja" role="dialog" aria-label="Agregar">${hojaAgregar()}</div>`
    : ui.editar && ui.parte ? `<div class="hoja" role="dialog" aria-label="Pintar">${hojaParte(ui.parte)}</div>`
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
  const tocarPieza = (i, parte = null) => { const grupo = grupoDe(i);
    // murito y lámina: se borra solo la parte tocada; la pared pasa a ser editable y se acuerda de lo que se quitó
    if (ui.editar && ui.herr === "borrar" && parte && grupo.some((k) => PIEZAS[k][0] === "lamina")) {
      const w = paredDePieza(grupo), est = estadoPieza(i, S.piezas); grupo.forEach((k) => (S.piezas[k] = "quitado"));
      return guardarPared(null, w.a, w.b, { tipo: "muro", estado: est, material: "lamina", grueso: w.grueso, nombre: "Pared de murito y lámina", quita: parte }, () => estadoPiezas(grupo, "quitado"), false); }
    if (ui.editar && ui.herr === "borrar") { grupo.forEach((k) => (S.piezas[k] = "quitado")); redibujar();
      return hacer(async () => { await estadoPiezas(grupo, "quitado"); return `${queEs(grupo)}: quitada (↶ la regresa)`; }); } ui.mas = false; ui.pz = { tocada: i, grupo, nombre: queEs(grupo) }; ui.areaSel = null; ui.elSel = null; redibujar(); };
  const textoPieza = (grupo, parte = null) => { const est = grupo.map((i) => estadoPieza(i, S.piezas));
    if (parte) return `<b>${parte === "murito" ? "Murito" : "Lámina"}</b><span class="med">${esc(queEs(grupo))}</span>${ui.herr === "borrar" ? `<span>Toca para quitar solo ${NOM_PARTE[parte]}</span>` : ""}`;
    return `<b>${esc(queEs(grupo))}</b><span class="med">${medidasPieza(grupo)}</span><span>${est.every((e) => e === est[0]) ? NOMBRE_ESTADO[est[0]] : "Partes en distinto estado"}</span>`; };
  // Poner a alguien en un punto del mapa (en %): dentro de un área o en cualquier otro lugar
  const ponerEn = (id, p) => {
    const L = lugarEn(...p), w = S.trabajadores.find((q) => q.id === id) || trabajador(id), n = primerNombre(w.nombre);
    ultimas[id] = p; ui.sel = null; ui.areaSel = null; ui.moviendo = false;
    Object.assign(w, { area_id: L.area?.id || null, pos_x: +p[0].toFixed(2), pos_y: +p[1].toFixed(2) });   // se ve al instante
    redibujar();
    hacer(async () => { await moverTrabajador(id, L.area?.id || null, p); return `${n} → ${L.texto}`; });
  };
  const tocarArea = (aid, punto = null) => {
    if (ui.moviendo && ui.sel && punto) { const a = area(aid); if (!a?.es_receso) return ponerEn(ui.sel, punto); }
    if (!aid) return;
    if (ui.editar && ui.herr === "borrar") { if (S.perfil?.rol !== "admin") return; ui.areaSel = aid; ui.borrar = "area"; ui.elSel = null; ui.pz = null; return redibujar(); }
    if (ui.editar) { ui.areaSel = aid; ui.elSel = null; ui.sel = null; ui.pz = null; return redibujar(); }
    if (ui.moviendo && ui.sel) {
      const id = ui.sel, a = (punto && areaEn(...punto)) || area(aid); ui.moviendo = false; ui.sel = null;
      if (a.es_receso) punto = null;
      return hacer(async () => { await moverTrabajador(id, a.id, punto); return `${primerNombre(trabajador(id).nombre)} → ${a.nombre}`; });
    }
    ui.areaSel = aid; ui.sel = null; redibujar();
  };

  if (es3d) {
    const personas = ui.sinGente ? [] : tokens.map(([p, x, y]) => ({ id: p.id, nombre: primerNombre(p.nombre) + (p.actividad && !recesoAbierto(p.id) ? " · " + p.actividad : ""), x: (x / 100) * ANCHO, y: (y / 100) * ALTO, receso: !!recesoAbierto(p.id), almuerzo: esAlmuerzo(recesoAbierto(p.id)), sel: ui.sel === p.id }));
    import(ESCENA).then((m) => {
      const cont = V.querySelector("#escena"); if (!cont) return;
      cont.querySelector(".cargando")?.remove();
      m.montar(cont, { colores: S.obra?.colores || {}, dibujo: ui.editar && DIBUJA.has(ui.herr) ? { tipo: ui.herr, grosor: ui.grosor[ui.herr] || 0.3 } : null, svg: dibujo.svg, clave: dibujo.clave, areas: S.areas, elementos: S.elementos, piezas: S.piezas, personas, editar: ui.editar && !ui.nuevo && !ui.punta && !ui.hueco, seleccion: ui.pz?.grupo, asas: specAsas(asasActuales()) || (ui.inicio ? [ui.inicio, ui.inicio] : null), handlers: {
        asaMueve: (idx, x, y) => { const A = asasActuales(); return A ? moverAsa(A, idx, x, y) : null; },
        asaSuelta: (idx, x, y) => { const A = asasActuales(); if (!A) return; const m = moverAsa(A, idx, x, y); soltarAsa(A, A.f ? m.pts : m.ab); },
        elemento: (id, hk, q, parte) => { if (!ui.editar || ui.hueco || ui.punta || !S.elementos.some((x) => x.id === id)) return false; ui.parte = null; tocarElemento(id, hk, q, parte);
          if (hk != null && ui.elSel === id && ui.herr !== "borrar") { ui.huecoSel = hk; redibujar(); } return true; },
        parte: (pt, q) => { if (!ui.editar || ui.hueco || ui.punta) return false;
          if (ui.herr === "borrar") { const antes = (S.obra.colores || {})[pt.clave] ?? null; S.obra.colores = { ...(S.obra.colores || {}), [pt.clave]: "quitado" }; redibujar();
            hacer(async () => { await guardarColor(pt.clave, "quitado", antes); return `${pt.nombre}: quitado (↶ lo regresa)`; }); return true; }
          if (DIBUJA.has(ui.herr)) return false;
          const cara = q && S.elementos.find((e) => e.material === "caseta" && distPared(q[0], q[1], e) < 10);   // pared de caseta cercana: sus puertas y ventanas
          ui.parte = { ...pt, cara: cara?.id || null }; ui.elSel = null; ui.areaSel = null; ui.pz = null; ui.huecoSel = null; redibujar(); return true; },
        trazoMueve: (a, q) => { const [a2, b] = ajustarTrazo(a, q); return { a: a2, b, texto: textoTrazo(a2, b) }; },
        trazo: (a, b) => hacerTrazo(a, b),
        persona: tocarPersona, pieza: tocarPieza, textoPieza, textoParte: (n) => `<b>${esc(n)}</b><span>${ui.herr === "borrar" ? "Toca para quitarlo (solo este)" : "Toca para pintarlo (solo este)"}</span>`,
        textoElemento: (id, hk, q, parte) => { const e = S.elementos.find((x) => x.id === id); if (!e) return "";
          const k = hk ?? huecoEn(e, q?.[0], q?.[1]), h = k != null ? e.huecos?.[k] : null;
          if (!h && parte && e.material === "lamina") return `<b>${parte === "murito" ? "Murito" : "Lámina"}</b><span class="med">${esc(e.nombre || "Pared")}</span>${ui.herr === "borrar" ? `<span>Toca para quitar solo ${NOM_PARTE[parte]}</span>` : ""}`;
          if (h) return `<b>${nombreHueco(h)} ${fmtM(h.w)}</b><span>${h.e ? EST_HUECO[h.e] : "Ya está"}</span><span class="med">${esc((e.nombre || "Pared").split(" · ")[0])}</span>`;
          return `<b>${esc(e.nombre || TIPOS_ELEMENTO[e.tipo] || "Elemento")}</b><span class="med">${medidasElemento(e)}</span><span>${ESTADOS[e.estado] || ""}</span>`; },
        pared: (x, y) => { const e = S.elementos.filter((q) => q.trazo).find((q) => distPared(x, y, q) < 8); if (!e) return false; tocarElemento(e.id, null, [x, y]); return true; },
        punto: (px, py) => { // el área más pequeña que contiene el punto tocado
          if (tocarPunto(px, py)) return;
          if (ui.editar) { const X = (px / 100) * ANCHO, Y = (py / 100) * ALTO, e = S.elementos.find((q) => !q.trazo && cercaDe(esquinas(q), X, Y, 8)); if (e) return tocarElemento(e.id); }
          const a = S.areas.filter((a) => px >= a.x && px <= +a.x + +a.w && py >= a.y && py <= +a.y + +a.h).sort((p, q) => p.w * p.h - q.w * q.h)[0];
          tocarArea(a?.id, [px, py]);
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
    // Zoom con dos dedos (celular) o con la rueda / el trackpad (compu): se acerca hacia donde están los dedos o el puntero
    const zoomA = (nivel, fx, fy) => {   // fx, fy: punto de la pantalla que debe quedarse quieto
      const z = ZOOMS.reduce((m, q) => (Math.abs(q - nivel) < Math.abs(m - nivel) ? q : m), ZOOMS[0]); if (z === ui.zoom) return;
      const r = mapa.getBoundingClientRect(), px = (mapa.scrollLeft + fx - r.left) / mapa.scrollWidth, py = (mapa.scrollTop + fy - r.top) / mapa.scrollHeight;
      ui.zoom = z; redibujar();
      const n = V.querySelector("#mapaScroll"); if (n) { n.scrollLeft = px * n.scrollWidth - (fx - r.left); n.scrollTop = py * n.scrollHeight - (fy - r.top); }
    };
    let pinza = null;
    const dosDedos = (t) => [Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY), (t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2];
    mapa.addEventListener("touchstart", (e) => { if (e.touches.length === 2) { const [d, x, y] = dosDedos(e.touches); pinza = { d, x, y, f: 1 }; } }, { passive: true });
    mapa.addEventListener("touchmove", (e) => {
      if (!pinza || e.touches.length !== 2) return; e.preventDefault();
      const [d] = dosDedos(e.touches); pinza.f = d / pinza.d; const m = mapa.querySelector(".mapa"); m.style.transformOrigin = `${pinza.x - mapa.getBoundingClientRect().left + mapa.scrollLeft}px ${pinza.y - mapa.getBoundingClientRect().top + mapa.scrollTop}px`; m.style.transform = `scale(${pinza.f})`;
    }, { passive: false });
    mapa.addEventListener("touchend", () => { if (!pinza) return; const p = pinza; pinza = null; const m = mapa.querySelector(".mapa"); if (m) m.style.transform = ""; if (Math.abs(p.f - 1) > 0.12) zoomA(ui.zoom * p.f, p.x, p.y); });
    mapa.addEventListener("wheel", (e) => { if (!e.ctrlKey && !e.metaKey && ui.zoom === ZOOMS[0] && e.deltaY > 0) return; if (!e.ctrlKey && !e.metaKey && !ui.editar) return;
      e.preventDefault(); const i = ZOOMS.indexOf(ui.zoom) + (e.deltaY < 0 ? 1 : -1); if (i >= 0 && i < ZOOMS.length) zoomA(ZOOMS[i], e.clientX, e.clientY); }, { passive: false });
    const enPct = (e) => { const r = V.querySelector(".mapa").getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100]; };
    V.querySelectorAll("[data-area]").forEach((b) => (b.onclick = (e) => tocarArea(b.dataset.area, enPct(e))));
    // Arrastrar a una persona al lugar exacto donde está trabajando (dentro de su área o en otra)
    if (!ui.editar) V.querySelectorAll(".tok").forEach((t) => {
      let ini = null, movio = false;
      t.addEventListener("pointerdown", (e) => { if (e.button > 0) return; ini = [e.clientX, e.clientY]; movio = false; try { t.setPointerCapture(e.pointerId); } catch (_) {} });
      t.addEventListener("pointermove", (e) => {
        if (!ini) return;
        if (!movio && Math.hypot(e.clientX - ini[0], e.clientY - ini[1]) < 8) return;
        movio = true; t.classList.add("arrastrando"); tip.hidden = true;
        const [x, y] = enPct(e); t.style.left = Math.max(0, Math.min(100, x)) + "%"; t.style.top = Math.max(0, Math.min(100, y)) + "%";
        V.querySelectorAll(".area").forEach((b) => b.classList.toggle("destino", b.dataset.area === areaEn(x, y)?.id));
      });
      const soltar = (e) => {
        if (!ini) return; ini = null; if (!movio) return;
        t.classList.remove("arrastrando"); V.querySelectorAll(".area.destino").forEach((b) => b.classList.remove("destino"));
        t.dataset.solto = "1"; setTimeout(() => delete t.dataset.solto, 0);
        const id = t.dataset.w, p = enPct(e);
        const fuera = p[0] < 0 || p[0] > 100 || p[1] < 0 || p[1] > 100;
        if (fuera || recesoAbierto(id)) { const [x, y] = t.dataset.to.split(",").map(Number); t.style.left = x + "%"; t.style.top = y + "%"; return; }   // fuera del plano o en receso: regresa
        ponerEn(id, p);
      };
      t.addEventListener("pointerup", soltar);
      t.addEventListener("pointercancel", () => { if (!ini) return; ini = null; if (movio) redibujar(); });
    });
    // Nombre flotante al pasar el mouse por cada lugar
    const tip = document.createElement("div"); tip.className = "tip"; tip.hidden = true; V.querySelector(".mapa").appendChild(tip);
    const mapaEl = V.querySelector(".mapa");
    V.querySelectorAll(".area, .el-btn, .tok").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        if (e.pointerType !== "mouse") return;
        const r = mapaEl.getBoundingClientRect();
        let t = "";
        const mx = ((e.clientX - r.left) / r.width) * ANCHO, my = ((e.clientY - r.top) / r.height) * ALTO, iz = el.dataset.area ? piezaEn(mx, my, 3) : -1;
        if (iz >= 0 && !CHICAS.has(iz)) { const gr = grupoDe(iz); t = `<b>${esc(queEs(gr))}</b><span class="med">${medidasPieza(gr)}</span>`; }   // pared, columna, gradas… bajo el mouse
        else if (el.dataset.area) { const a = area(el.dataset.area); t = `<b>${esc(a.es_receso ? a.uso_actual || "Bodega (receso)" : a.nombre)}</b><span class="med">${medidasArea(a)}</span><span>${ESTADOS[a.estado] || ""} · ${enArea(a.id).length} asignados</span>`; }
        else if (el.dataset.el) { const x = S.elementos.find((q) => q.id === el.dataset.el); t = `<b>${esc(x.nombre || TIPOS_ELEMENTO[x.tipo])}</b><span class="med">${medidasElemento(x)}</span><span>${ESTADOS[x.estado]}</span>`; }
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
      el.addEventListener("click", (e) => { e.stopPropagation();
        // si en ese punto hay algo agregado (columna, zanja, pared dibujada), eso va primero que el plano
        const r = mapaEl.getBoundingClientRect(), X = ((e.clientX - r.left) / r.width) * ANCHO, Y = ((e.clientY - r.top) / r.height) * ALTO;
        const tol = 14 / (r.width / ANCHO);   // ~14 px de margen en la pantalla
        const propio = S.elementos.find((q) => !q.trazo && q.tipo !== "techo" && cercaDe(esquinas(q), X, Y, tol)) || S.elementos.find((q) => q.trazo && distPared(X, Y, q) < tol);
        if (propio) return tocarElemento(propio.id);
        tocarPieza(+el.dataset.pz); });
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
    const pct = (e) => { const r = cap.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100]; };
    if (cap && ui.nuevo?.tipo === "muro") {
      // Pared: toca y toca, o arrastra de punta a punta. Mientras tanto se ve la línea (pegada y enderezada) con su medida.
      cap.innerHTML = `<svg class="capa-edicion" viewBox="0 0 ${ANCHO} ${ALTO}" preserveAspectRatio="none"><path class="previa-nueva" d=""/></svg><span class="punto iman" hidden></span><div class="tip" hidden></div>`;
      const linea = cap.querySelector("path"), iman = cap.querySelector(".iman"), tip = cap.querySelector(".tip");
      const extra = puntasDibujadas(), aMapa = ([x, y]) => [(x / 100) * ANCHO, (y / 100) * ALTO];
      const inicio = () => ui.nuevo.p1 && (ui.nuevo.a || pegar(...aMapa(ui.nuevo.p1), 9, extra));
      let abajo = null;
      const mostrar = (e) => {
        const a = inicio(), q = pegar(...aMapa(pct(e)), 9, extra), b = a ? enderezar(a, q) : q, r = cap.getBoundingClientRect();
        iman.hidden = false; iman.style.left = (b[0] / ANCHO) * 100 + "%"; iman.style.top = (b[1] / ALTO) * 100 + "%";
        if (!a) { tip.hidden = true; linea.setAttribute("d", ""); return; }
        linea.setAttribute("d", `M${a[0]} ${a[1]}L${b[0]} ${b[1]}`);
        tip.hidden = false; tip.innerHTML = `<b>${fmtM(Math.hypot(b[0] - a[0], b[1] - a[1]) * METROS_POR_UNIDAD)}</b>`;
        tip.style.left = Math.min(r.width - 90, e.clientX - r.left + 18) + "px"; tip.style.top = Math.max(0, e.clientY - r.top - 40) + "px";
      };
      cap.addEventListener("pointermove", mostrar);
      cap.addEventListener("pointerdown", (e) => {
        e.preventDefault(); try { cap.setPointerCapture(e.pointerId); } catch (_) {}
        abajo = { x: e.clientX, y: e.clientY, nuevo: !ui.nuevo.p1 };
        if (!ui.nuevo.p1) { ui.nuevo.p1 = pct(e); ui.nuevo.a = pegar(...aMapa(ui.nuevo.p1), 9, extra); }
        mostrar(e);
      });
      cap.addEventListener("pointerup", (e) => {
        if (!abajo) return; const movio = Math.hypot(e.clientX - abajo.x, e.clientY - abajo.y) > 12, eraNuevo = abajo.nuevo; abajo = null;
        if (eraNuevo && !movio) { redibujar(); return; }   // primer toque: queda marcado el inicio
        tocarPunto(...pct(e));
      });
    } else if (cap && ui.moviendo && ui.sel) cap.onclick = (e) => ponerEn(ui.sel, pct(e));
    else if (cap) cap.onclick = (e) => tocarPunto(...pct(e));
  }

  // ---- Alargar paredes arrastrando sus puntas ----
  soltarAsa = (A, ab, w0) => {
    if (A?.ar) return guardarArea(A.f, ab);    // área: rectángulo nuevo
    if (A?.f) return guardarFigura(A.f, ab);   // figura: ab son las esquinas nuevas
    if (A?.e) return guardarPared(A.e, ab[0], ab[1]);   // pared dibujada: cambia su largo (y se junta si toca otra en la misma línea)
    const w = w0 || A.w, [a, b] = ab || [w.a, w.b], g = w.grupo;   // pared del plano → se vuelve pared editable
    const est = estadoPieza(ui.pz.tocada, S.piezas);
    g.forEach((i) => (S.piezas[i] = "quitado")); ui.pz = null;
    guardarPared(null, a, b, { tipo: "muro", estado: est === "quitado" ? "falta" : est, material: w.material, grueso: w.grueso }, () => estadoPiezas(g, "quitado"));
  };
  // Guarda una pared de a → b. Si hay otras en la misma línea que la tocan o se enciman, quedan como una sola pared.
  // base = pared que se está cambiando (o null si es nueva, con sus datos en "nueva").
  function guardarPared(base, a, b, nueva = {}, antes = null, elegirla = true) {
    const otras = S.elementos.filter((q) => q.trazo && q !== base && q.material !== "caseta");
    const r = enLinea(a, b, otras), quien = base || r.juntas[0] || null, sobran = r.juntas.filter((q) => q !== quien);
    const huecos = [...(quien?.huecos || []), ...sobran.flatMap((q) => q.huecos || [])];
    const cambios = { ...pared(r.a, r.b), huecos }, largo = fmtM(Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]) * METROS_POR_UNIDAD);
    S.elementos = S.elementos.filter((q) => !sobran.includes(q));
    let tmp = null;
    if (quien) Object.assign(quien, cambios); else { tmp = { id: "tmp" + Date.now(), ...nueva, ...cambios }; S.elementos.push(tmp); }
    ui.mas = false; ui.areaSel = null; ui.elSel = elegirla ? (quien || tmp).id : null; redibujar();   // se ve al instante
    hacer(async () => {
      if (antes) await antes();
      if (quien) await editarElemento(quien.id, cambios); else { const n = await agregarElemento({ ...nueva, ...cambios }), era = tmp.id; Object.assign(tmp, n); if (ui.elSel === era) ui.elSel = n.id; }
      for (const q of sobran) await borrarElemento(q.id);
      return `Pared ${quien ? "" : "agregada "}· ${largo}${sobran.length || (quien && !base) ? " (unida en una sola)" : ""}`;
    });
  }
  if (!es3d) V.querySelectorAll("[data-asa]").forEach((h) => {
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

  // ---- Figuras: arrastrar sus agarraderas (2D). En 3D lo hace la escena con asaMueve / asaSuelta ----
  const hsFig = [...V.querySelectorAll("[data-asa-fig]")];
  if (!es3d && hsFig.length) {
    const mapa = V.querySelector(".mapa"), prev = V.querySelector("#previa"), med = V.querySelector("#medidaFig");
    const punto = (e) => { const r = mapa.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * ANCHO, ((e.clientY - r.top) / r.height) * ALTO]; };
    // Si la figura se ve chiquita, los puntos se separan del centro para que se puedan agarrar con el dedo
    const colocar = (pts) => {
      const a = agarraderas(pts), c = a.puntos.at(-1), esc = mapa.getBoundingClientRect().width / ANCHO || 1;
      a.puntos.forEach((q, i) => { let [x, y] = q; const t = a.tipos[i], min = (t === "esquina" ? 38 : t === "lado" ? 26 : 0) / esc, d = Math.hypot(x - c[0], y - c[1]);
        if (min && d < min) { if (d < 1e-6) { x = c[0] + min; } else { x = c[0] + ((x - c[0]) / d) * min; y = c[1] + ((y - c[1]) / d) * min; } }
        hsFig[i].style.left = (x / ANCHO) * 100 + "%"; hsFig[i].style.top = (y / ALTO) * 100 + "%"; });
      med.style.left = (c[0] / ANCHO) * 100 + "%"; med.style.top = (c[1] / ALTO) * 100 + "%";
    };
    colocar(asasActuales().pts);
    // Al arrastrar, el punto sigue al dedo desde donde se agarró (no salta)
    let A = null, ultimo = null, ini = null, base = null;
    hsFig.forEach((h) => {
      h.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); try { h.setPointerCapture(e.pointerId); } catch (_) {}
        A = asasActuales(); ultimo = null; ini = punto(e); base = agarraderas(A.pts).puntos[+h.dataset.asaFig]; h.classList.add("arrastrando"); });
      h.addEventListener("pointermove", (e) => {
        if (!A?.f) return; const q = punto(e), m = moverAsa(A, +h.dataset.asaFig, base[0] + q[0] - ini[0], base[1] + q[1] - ini[1]); ultimo = m.pts;
        prev.setAttribute("d", dPoli(m.pts)); colocar(m.pts); med.textContent = m.texto;
      });
      const fin = () => { if (!A) return; const a = A; A = null; h.classList.remove("arrastrando"); if (ultimo && a.f) soltarAsa(a, ultimo); };
      h.addEventListener("pointerup", fin); h.addEventListener("pointercancel", fin);
    });
  }
  function elegir(id) { ui.parte = null; if (ui.elSel !== id) ui.huecoSel = null; ui.mas = false; ui.elSel = id; ui.pz = null; ui.areaSel = null; ui.borrar = false; ui.agregar = false; ui.hueco = null; redibujar(); }
  // Guarda las esquinas nuevas de una figura (se ve al instante; se guarda atrás)
  function guardarFigura(e, pts, extra = {}) {
    const cambios = { ...guardable(pts), ...extra }; Object.assign(e, cambios); redibujar();
    hacer(async () => { await editarElemento(e.id, cambios); return medidasFigura(e); });
  }
  function guardarArea(a, pts) {
    const cambios = rectPct(pts); Object.assign(a, cambios); redibujar();
    hacer(async () => { await editarArea(a.id, cambios); return `${nombreArea(a)}: ${medidasArea(a)}`; });
  }
  function ponerArea(datos, aviso) {
    const tmp = { id: "tmp" + Date.now(), nombre: "", tipo: "patio", estado: "existe", orden: 50, ...datos }; S.areas.push(tmp);
    ui.areaSel = tmp.id; ui.elSel = null; ui.pz = null; ui.agregar = false; redibujar();
    return hacer(async () => { const n = await agregarArea(datos), era = tmp.id; Object.assign(tmp, n); if (ui.areaSel === era) ui.areaSel = n.id; return aviso; });
  }
  // Pone una figura nueva (o una copia) y la deja elegida, lista para deformar
  function ponerFigura(datos, aviso, elegirla = true) {
    const tmp = { id: "tmp" + Date.now(), ...datos }; S.elementos.push(tmp); if (elegirla) elegir(tmp.id); else redibujar();
    hacer(async () => { const n = await agregarElemento(datos), era = tmp.id; Object.assign(tmp, n); if (ui.elSel === era) ui.elSel = n.id; return aviso; });
  }
  // Centro de lo que se ve del plano 2D (un poco arriba, porque abajo está la hoja)
  const centro2d = () => { const r = V.querySelector(".mapa").getBoundingClientRect(), cl = (v, a, b) => Math.max(a, Math.min(b, v));
    return [((cl(innerWidth / 2, r.left, r.right) - r.left) / r.width) * ANCHO, ((cl(innerHeight * 0.4, r.top, r.bottom) - r.top) / r.height) * ALTO]; };
  async function agregarFicha(i) {
    const f = FICHAS[i], c = es3d ? (await import(ESCENA)).centroVista() : centro2d();
    ui.agregar = false;
    if (f.tipo === "area") return ponerArea(rectPct(figuraNueva(f, c[0], c[1])), "Área nueva: estírala con los puntos y ponle nombre si quieres");
    if (f.tipo === "muro") return guardarPared(null, [c[0] - U(f.w) / 2, c[1]], [c[0] + U(f.w) / 2, c[1]], { tipo: "muro", estado: "falta", material: "block" });
    ponerFigura({ tipo: f.tipo, estado: "falta", ...guardable(figuraNueva(f, c[0], c[1])), alto: f.alto ?? null }, `${f.nombre}: arrastra sus puntos para darle forma`);
  }

  // ---- Herramientas de dibujo (lo mismo en 2D y en 3D) ----
  // Tocar algo: con el borrador se quita (y ↶ lo regresa); con la mano se elige para moverlo y estirarlo
  // la puerta/ventana de una pared que está bajo el punto (x, y del plano), o null
  function huecoEn(e, x, y) {
    if (!e?.trazo || !(e.huecos || []).length || x == null) return null;
    const [a, b] = puntas(e.trazo), L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, t = ((x - a[0]) * (b[0] - a[0]) + (y - a[1]) * (b[1] - a[1])) / L;
    let mejor = null, dm = Infinity;
    e.huecos.forEach((h, k) => { const th = ((h.c[0] - a[0]) * (b[0] - a[0]) + (h.c[1] - a[1]) * (b[1] - a[1])) / L, d = Math.abs(t - th) - U(h.w || 0.9) / 2;
      if (d < 3 && d < dm) { dm = d; mejor = k; } });
    return mejor;
  }
  const nombreHueco = (h) => (h.t === "puerta" ? "Puerta" : "Ventana");
  function guardarHuecos(e, huecos, aviso) { e.huecos = huecos; ui.huecoSel = null; redibujar(); hacer(async () => { await editarElemento(e.id, { huecos }); return aviso; }); }
  // BORRAR una puerta/ventana: la pared queda cerrada en ese tramo (lo rojo "no va" ya se tapó)
  const borrarHueco = (e, k) => { const h = e.huecos[k]; guardarHuecos(e, e.huecos.filter((_, j) => j !== k), `${nombreHueco(h)} quitada: la pared quedó cerrada (↶ la regresa)`); };
  // CONSTRUIR sobre lo que está en el plano: lo transparente pasa a hecho; lo rojo se tapa. Devuelve true si había algo que construir ahí.
  function construirEn(x, y) {
    const pared = S.elementos.filter((q) => q.trazo).map((q) => ({ q, d: distPared(x, y, q) })).filter((o) => o.d < 6).sort((m, n) => m.d - n.d)[0]?.q;
    if (pared) {
      const k = huecoEn(pared, x, y), h = k != null ? pared.huecos[k] : null;
      if (h?.e === "quitar") { borrarHueco(pared, k); return true; }
      if (h?.e === "falta") { guardarHuecos(pared, pared.huecos.map((x2, j) => (j === k ? { ...x2, e: "abierto" } : x2)), `${nombreHueco(h)}: hueco hecho (toca otra vez cuando ya esté puesta)`); return true; }
      if (h?.e === "abierto") { guardarHuecos(pared, pared.huecos.map((x2, j) => { if (j !== k) return x2; const n = { ...x2 }; delete n.e; return n; }), `${nombreHueco(h)}: ya está`); return true; }
      if (pared.estado !== "existe") { pared.estado = "existe"; redibujar(); hacer(async () => { await editarElemento(pared.id, { estado: "existe" }); return `${pared.nombre || "Pared"}: ya está`; }); return true; }
    }
    const fig = S.elementos.find((q) => !q.trazo && q.estado !== "existe" && dentroDe(esquinas(q), x, y));
    if (fig) { fig.estado = "existe"; redibujar(); hacer(async () => { await editarElemento(fig.id, { estado: "existe" }); return `${fig.nombre || TIPOS_ELEMENTO[fig.tipo] || "Elemento"}: ya está`; }); return true; }
    const i = piezaEn(x, y, 5);
    if (i >= 0 && ["falta", "en_proceso"].includes(estadoPieza(i, S.piezas))) { const g = grupoDe(i); g.forEach((k2) => (S.piezas[k2] = "existe")); redibujar();
      hacer(async () => { await estadoPiezas(g, "existe"); return `${queEs(g)}: ya está`; }); return true; }
    return false;
  }
  function tocarElemento(id, hk = null, pt = null, parte = null) {
    const e = S.elementos.find((q) => q.id === id); if (!e) return;
    if (hk == null && pt) hk = huecoEn(e, pt[0], pt[1]);
    if (ui.herr === "lapiz" && pt && construirEn(pt[0], pt[1])) return;
    if (ui.herr !== "borrar") { elegir(id); if (hk != null && e.huecos?.[hk] && ui.elSel === id) { ui.huecoSel = hk; redibujar(); } return; }
    if (hk != null && e.huecos?.[hk]) return borrarHueco(e, hk);   // borrar sobre una puerta/ventana: solo esa
    if (e.material === "caseta") { ui.herr = "mano"; return elegir(id); }   // la caseta no se borra: se abre para quitar sus puertas o ventanas
    if (parte && e.material === "lamina" && (!e.quita || e.quita === parte)) {   // murito o lámina: solo esa parte (si ya no queda la otra, se va toda)
      if (e.quita !== parte) { e.quita = parte; redibujar(); return hacer(async () => { await editarElemento(e.id, { quita: parte }); return `Se quitó ${NOM_PARTE[parte]} (↶ la regresa)`; }); } }
    S.elementos = S.elementos.filter((q) => q !== e); ui.elSel = null; redibujar();
    hacer(async () => { await borrarElemento(id); return `${e.nombre || TIPOS_ELEMENTO[e.tipo] || "Elemento"} quitado (↶ lo regresa)`; });
  }
  // De dónde a dónde va el trazo: la pared se pega a otras puntas y se endereza; el corte y la zona, libres
  function ajustarTrazo(a, q) {
    if (ui.herr === "lapiz") { const otras = S.elementos.filter((e) => e.trazo).flatMap((e) => puntas(e.trazo)); const a2 = pegar(a[0], a[1], 9, otras); return [a2, enderezar(a2, pegar(q[0], q[1], 9, otras))]; }
    if (ui.herr === "cortar") return [a, enderezar(a, q)];
    return [a, q];
  }
  const largoM = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]) * METROS_POR_UNIDAD;
  const textoTrazo = (a, b) => ui.herr === "zona" ? `${fmtM(Math.abs(b[0] - a[0]) * METROS_POR_UNIDAD)} × ${fmtM(Math.abs(b[1] - a[1]) * METROS_POR_UNIDAD)}` : fmtM(largoM(a, b));
  // Banda de grosor g (m) de a a b: las 4 esquinas
  function banda(a, b, g) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, h = U(g) / 2, n = [(-(b[1] - a[1]) / L) * h, ((b[0] - a[0]) / L) * h];
    return [[a[0] + n[0], a[1] + n[1]], [b[0] + n[0], b[1] + n[1]], [b[0] - n[0], b[1] - n[1]], [a[0] - n[0], a[1] - n[1]]];
  }
  // Punto donde el segmento a-b cruza el segmento p-q (o null)
  function cruce(a, b, p, q) {
    const d = (b[0] - a[0]) * (q[1] - p[1]) - (b[1] - a[1]) * (q[0] - p[0]); if (Math.abs(d) < 1e-9) return null;
    const t = ((p[0] - a[0]) * (q[1] - p[1]) - (p[1] - a[1]) * (q[0] - p[0])) / d, u = ((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) / d;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] : null;
  }
  // Lo que pasa al soltar el dedo
  function hacerTrazo(a0, q) {
    const [a, b] = ajustarTrazo(a0, q), toque = largoM(a, b) < 0.3, h = ui.herr;
    if (h === "zona") {
      if (toque) return;
      ui.herr = "mano";   // para que se pueda estirar y ponerle nombre enseguida
      return ponerArea(rectPct([a, [b[0], a[1]], b, [a[0], b[1]]]), "Zona nueva: ponle nombre si quieres");
    }
    if (h === "lapiz") {
      const g = ui.grosor.lapiz;
      // Pared con dos toques: el primero marca dónde empieza; el segundo, dónde termina (el mismo punto = columna)
      if (toque && !ui.inicio && construirEn(a[0], a[1])) return;   // tocar algo transparente o rojo: se construye / se tapa
      if (toque && !ui.inicio) { ui.inicio = a; return redibujar(); }
      let [p, q] = toque ? ajustarTrazo(ui.inicio, a) : [a, b]; const columna = toque && largoM(p, q) < 0.3;
      ui.inicio = null; ui.herr = "mano";   // lo nuevo queda elegido para ajustarlo enseguida
      if (columna) { const s = Math.max(g, 0.3); return ponerFigura({ tipo: "columna", estado: "existe", ...guardable(figuraNueva({ w: s, h: s }, p[0], p[1])) }, "Columna: ajústala con sus puntos y botones"); }
      return guardarPared(null, p, q, { tipo: "muro", estado: "existe", material: "block", grueso: g });
    }
    if (h === "cortar") {
      const g = ui.grosor.cortar, paredes = S.elementos.filter((e) => e.trazo);
      // si cruza paredes, a cada una se le abre un hueco del ancho del corte
      const cortes = toque ? [] : paredes.map((e) => { const [p1, p2] = puntas(e.trazo), c = cruce(a, b, p1, p2); return c && { e, c }; }).filter(Boolean);
      for (const { e, c } of cortes) {
        const huecos = [...(e.huecos || []), { t: "puerta", c: [+c[0].toFixed(1), +c[1].toFixed(1)], w: +Math.min(g, largoPared(e) * 0.9).toFixed(2) }];
        e.huecos = huecos; hacer(async () => { await editarElemento(e.id, { huecos }); return `Hueco de ${fmtM(g)} en la pared`; });
      }
      ui.herr = "mano";   // lo nuevo queda elegido para ajustarlo enseguida
      if (cortes.length && largoM(a, b) < 3) { ui.elSel = cortes[0].e.id; return redibujar(); }   // pasar el dedo por una pared: solo el hueco
      const pts = toque ? figuraNueva({ w: g, h: g }, a[0], a[1]) : banda(a, b, g);
      return ponerFigura({ tipo: "hoyo", estado: "existe", alto: 1, ...guardable(pts) }, toque ? `Hoyo de ${fmtM(g)}` : `Zanja de ${fmtM(largoM(a, b))} × ${fmtM(g)}`);
    }
  }
  // 2D: dibujar con el dedo sobre el plano
  const capD = V.querySelector("#captura.dibujar");
  if (!es3d && capD) {
    const g = (ui.grosor[ui.herr] || 0.3);
    capD.innerHTML = `<svg class="capa-edicion" viewBox="0 0 ${ANCHO} ${ALTO}" preserveAspectRatio="none"><path class="trazo-${ui.herr}" d="" stroke-width="${Math.max(3, U(g))}"/></svg><div class="tip" hidden></div>
      ${ui.inicio ? `<span class="asa inicio" style="${enMapa(ui.inicio)}"></span>` : ""}`;
    const path = capD.querySelector("path"), tipD = capD.querySelector(".tip");
    const pto = (e) => { const r = capD.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * ANCHO, ((e.clientY - r.top) / r.height) * ALTO]; };
    let a = null;
    const ver = (e) => { const [a2, b] = ajustarTrazo(a, pto(e)), r = capD.getBoundingClientRect();
      path.setAttribute("d", ui.herr === "zona" ? `M${a2[0]} ${a2[1]}H${b[0]}V${b[1]}H${a2[0]}Z` : `M${a2[0]} ${a2[1]}L${b[0]} ${b[1]}`);
      tipD.hidden = false; tipD.innerHTML = `<b>${textoTrazo(a2, b)}</b>`; tipD.style.left = Math.min(r.width - 90, e.clientX - r.left + 18) + "px"; tipD.style.top = Math.max(0, e.clientY - r.top - 44) + "px"; };
    capD.addEventListener("pointerdown", (e) => { if (e.button > 0) return; e.preventDefault(); try { capD.setPointerCapture(e.pointerId); } catch (_) {} a = pto(e); ver(e); });
    capD.addEventListener("pointermove", (e) => { if (a) ver(e); else if (ui.inicio) { a = ui.inicio; ver(e); a = null; } });   // con el inicio marcado, se ve la pared antes del 2.º toque
    const fin = (e) => { if (!a) return; const a0 = a; a = null; tipD.hidden = true; path.setAttribute("d", ""); hacerTrazo(a0, pto(e)); };
    capD.addEventListener("pointerup", fin); capD.addEventListener("pointercancel", () => { a = null; tipD.hidden = true; path.setAttribute("d", ""); });
  }

  // ---- Interacción ----
  const $$ = (s) => V.querySelectorAll(s);
  // Pintar lo elegido en 3D
  $$("[data-color]").forEach((b) => (b.onclick = () => { const pt = ui.parte; if (!pt) return; const c = b.dataset.color, antes = (S.obra.colores || {})[pt.clave] ?? null;
    S.obra.colores = { ...(S.obra.colores || {}), [pt.clave]: c }; redibujar();
    hacer(async () => { await guardarColor(pt.clave, c, antes); return `${pt.nombre}: ${b.title}`; }); }));
  $$("[data-color-original]").forEach((b) => (b.onclick = () => { const pt = ui.parte; if (!pt) return; const antes = (S.obra.colores || {})[pt.clave] ?? null; const col = { ...(S.obra.colores || {}) }; delete col[pt.clave]; S.obra.colores = col; redibujar();
    hacer(async () => { await guardarColor(pt.clave, null, antes); return `${pt.nombre}: color original`; }); }));
  $$("[data-abrir-cara]").forEach((b) => (b.onclick = () => elegir(b.dataset.abrirCara)));
  // Puertas y ventanas de una caseta, una por una
  $$("[data-regresa-parte]").forEach((b) => (b.onclick = () => { const e = S.elementos.find((q) => q.id === ui.elSel); if (!e) return; e.quita = null; redibujar();
    hacer(async () => { await editarElemento(e.id, { quita: null }); return "Pared completa otra vez"; }); }));
  $$("[data-hueco-sel]").forEach((b) => (b.onclick = () => { const k = +b.dataset.huecoSel; ui.huecoSel = ui.huecoSel === k ? null : k; redibujar(); }));
  const cambiarHueco = (fn, aviso) => { const e = S.elementos.find((q) => q.id === ui.elSel); const h = e?.huecos?.[ui.huecoSel]; if (!h) return;
    const huecos = e.huecos.map((x, k) => (k === ui.huecoSel ? fn({ ...x }) : x)); e.huecos = huecos; redibujar();
    hacer(async () => { await editarElemento(e.id, { huecos }); return aviso(huecos[ui.huecoSel]); }); };
  $$("[data-hueco-ancho]").forEach((b) => (b.onclick = () => cambiarHueco((h) => ({ ...h, w: Math.max(0.4, Math.min(6, Math.round((h.w + +b.dataset.huecoAncho * 0.1) * 100) / 100)) }), (h) => `${h.t === "puerta" ? "Puerta" : "Ventana"}: ${fmtM(h.w)} de ancho`)));
  $$("[data-hueco-est]").forEach((b) => (b.onclick = () => cambiarHueco((h) => { const n = { ...h }; if (b.dataset.huecoEst) n.e = b.dataset.huecoEst; else delete n.e; return n; },
    (h) => `${h.t === "puerta" ? "Puerta" : "Ventana"}: ${h.e ? EST_HUECO[h.e] : "ya está"}`)));
  $$("[data-hueco-tipo]").forEach((b) => (b.onclick = () => cambiarHueco((h) => (h.t === "puerta" ? { ...h, t: "ventana", d: h.d > 2 ? h.d + 0.9 : 1, h: 1 } : { ...h, t: "puerta", d: h.d > 2 ? Math.max(0, h.d - 0.9) : 0, h: 2.1 }), (h) => (h.t === "puerta" ? "Ahora es puerta" : "Ahora es ventana"))));

  $$("[data-herr]").forEach((b) => (b.onclick = () => { ui.herr = b.dataset.herr; ui.inicio = null; ui.elSel = null; ui.areaSel = null; ui.pz = null; ui.borrar = false; ui.hueco = null; ui.agregar = false; redibujar(); }));
  $$("[data-grosor]").forEach((b) => (b.onclick = () => { ui.grosor[ui.herr] = +b.dataset.grosor; redibujar(); }));
  function cerrarTodo() { ui.parte = null; ui.huecoSel = null; ui.agregar = false; ui.hueco = null; ui.mas = false; ui.punta = null; ui.pz = null; ui.sel = null; ui.areaSel = null; ui.moviendo = false; ui.elSel = null; ui.nuevo = null; ui.borrar = false; ui.prestar = null; ui.verPrestamos = false; ui.perdida = null; }
  const cerrar = () => { ui.parte = null; ui.huecoSel = null; ui.agregar = false; ui.hueco = null; ui.mas = false; ui.punta = null; ui.pz = null; ui.sel = null; ui.areaSel = null; ui.moviendo = false; ui.elSel = null; ui.nuevo = null; ui.borrar = false; ui.prestar = null; ui.verPrestamos = false; ui.perdida = null; redibujar(); };
  $$("[data-vista]").forEach((b) => (b.onclick = () => { ui.vista = b.dataset.vista; try { localStorage.setItem("sym-vista", ui.vista); } catch (e) {} redibujar(); }));
  $$("[data-w]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); if (b.dataset.solto) return; tocarPersona(b.dataset.w); }));
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
  if (he) he.onclick = () => { ui.pz = null; ui.editar = !ui.editar; ui.agregar = false; ui.herr = "mano"; ui.inicio = null; if (!es3d && innerWidth < 700) ui.zoom = ui.editar ? ZOOMS[1] : ZOOMS[0]; ui.nuevo = null; ui.elSel = null; ui.areaSel = null; ui.sel = null; ui.moviendo = false; redibujar(); };
  $$("[data-hueco]").forEach((b) => (b.onclick = () => { ui.hueco = ui.hueco?.t === b.dataset.hueco ? null : { t: b.dataset.hueco }; redibujar(); }));
  $$("[data-quitar-hueco]").forEach((b) => (b.onclick = () => { ui.huecoSel = null; const e = S.elementos.find((q) => q.id === ui.elSel), k = +b.dataset.quitarHueco;
    const huecos = (e.huecos || []).filter((_, i) => i !== k); e.huecos = huecos; redibujar();
    hacer(async () => { await editarElemento(e.id, { huecos }); return "Hueco quitado"; }); }));
  const mo = V.querySelector("[data-mas]"); if (mo) mo.onclick = () => { ui.mas = !ui.mas; redibujar(); };
  const hd = V.querySelector("#hudDeshacer"); if (hd) hd.onclick = () => { cerrarTodo(); hacer(async () => (await deshacer()) ? "Se deshizo ↶" : ""); };
  const hr2 = V.querySelector("#hudRehacer"); if (hr2) hr2.onclick = () => { cerrarTodo(); hacer(async () => (await rehacer()) ? "Se volvió a hacer ↷" : ""); };
  // Teclado (computadora): Ctrl+Z deshace; Ctrl+Y o Ctrl+Shift+Z rehace. Solo editando el plano.
  teclas = (e) => {
    if (!ui.editar || !(e.ctrlKey || e.metaKey) || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName)) return;
    const k = e.key.toLowerCase(), re = k === "y" || (k === "z" && e.shiftKey);
    if (k !== "z" && k !== "y") return; e.preventDefault(); (re ? hr2 : hd)?.click();
  };
  const ha = V.querySelector("#hudAgregar"); if (ha) ha.onclick = () => { ui.agregar = !ui.agregar; ui.nuevo = null; ui.elSel = null; ui.areaSel = null; ui.pz = null; ui.hueco = null; redibujar(); };
  $$("[data-ficha]").forEach((b) => (b.onclick = () => agregarFicha(+b.dataset.ficha)));
  // Botones de juego: más alto / más bajo, más grueso / más delgado, girar, copiar
  const elegido = () => S.elementos.find((q) => q.id === ui.elSel);
  $$("[data-alto]").forEach((b) => (b.onclick = () => { const e = elegido(); if (!e) return; const d = +b.dataset.alto;
    let alto;
    if (e.trazo) alto = Math.max(0.5, Math.min(12, Math.round((altoPared(e, S.areas) + d * 0.25) * 100) / 100));
    else { const cur = altoDe(e), paso = cur < 1 || (cur === 1 && d < 0) ? 0.1 : 0.25; alto = Math.max(0.1, Math.min(15, Math.round((cur + d * paso) * 100) / 100)); }
    Object.assign(e, { alto }); redibujar();
    hacer(async () => { await editarElemento(e.id, { alto }); return e.tipo === "hoyo" ? `${fmtM(alto)} de hondo` : `${fmtM(alto)} de alto`; }); }));
  $$("[data-grueso]").forEach((b) => (b.onclick = () => { const e = elegido(); if (!e) return;
    const grueso = Math.round(Math.max(0.05, Math.min(1, gruesoPared(e) + +b.dataset.grueso * 0.05)) * 100) / 100;
    Object.assign(e, { grueso }); redibujar();
    hacer(async () => { await editarElemento(e.id, { grueso }); return `Grueso: ${Math.round(grueso * 100)} cm`; }); }));
  const fna = V.querySelector("#nomArea"); if (fna) fna.onsubmit = (ev) => { ev.preventDefault(); const a = area(ui.areaSel), nombre = V.querySelector("#areaNombre").value.trim();
    a.nombre = nombre; hacer(async () => { await editarArea(a.id, { nombre }); return nombre ? `Área: ${nombre}` : "Área sin nombre"; }); };
  $$("[data-dividir]").forEach((b) => (b.onclick = () => { const a = area(ui.areaSel); if (!a) return; const v = b.dataset.dividir === "v";
    const mitad = v ? { w: +(a.w / 2).toFixed(2) } : { h: +(a.h / 2).toFixed(2) };
    const otra = v ? { x: +(+a.x + a.w / 2).toFixed(2), y: +a.y, w: +(a.w / 2).toFixed(2), h: +a.h } : { x: +a.x, y: +(+a.y + a.h / 2).toFixed(2), w: +a.w, h: +(a.h / 2).toFixed(2) };
    Object.assign(a, mitad);
    hacer(async () => { await editarArea(a.id, mitad); return ""; });
    ponerArea({ ...otra, tipo: a.tipo, estado: a.estado }, "Dividida en 2: estira cada parte y ponles nombre"); }));
  $$("[data-borrar-area]").forEach((b) => (b.onclick = () => { ui.borrar = "area"; redibujar(); }));
  $$("[data-borrar-area-si]").forEach((b) => (b.onclick = () => { const a = area(ui.areaSel); ui.areaSel = null; ui.borrar = false;
    S.areas = S.areas.filter((q) => q !== a); redibujar();
    hacer(async () => { await borrarArea(a.id); return `Área borrada: ${nombreArea(a)}`; }); }));
  $$("[data-escalon]").forEach((b) => (b.onclick = () => { const e = elegido(); if (!e) return;
    const escalones = Math.max(1, Math.min(40, nEscalones(e) + +b.dataset.escalon)); Object.assign(e, { escalones }); redibujar();
    hacer(async () => { await editarElemento(e.id, { escalones }); return `${escalones} escalones`; }); }));
  $$("[data-subida]").forEach((b) => (b.onclick = () => { const e = elegido(); if (!e) return; const p = esquinas(e); guardarFigura(e, [p[1], p[2], p[3], p[0]]); }));
  $$("[data-girar]").forEach((b) => (b.onclick = () => { const e = elegido(); if (e && !e.trazo) guardarFigura(e, girar(esquinas(e), +b.dataset.girar)); }));
  $$("[data-copiar]").forEach((b) => (b.onclick = () => { const e = elegido(); if (!e || e.trazo) return;
    ponerFigura({ tipo: e.tipo, estado: e.estado, nombre: e.nombre || null, alto: e.alto ?? null, ...guardable(correr(esquinas(e), U(1), U(1))) }, "Copia lista: muévela con el punto del centro"); }));
  $$("[data-tipo]").forEach((b) => (b.onclick = () => { ui.nuevo = { tipo: b.dataset.tipo, p1: null, material: ui.nuevo?.material }; redibujar(); }));
  $$("[data-mat-nuevo]").forEach((b) => (b.onclick = () => { ui.nuevo.material = b.dataset.matNuevo; redibujar(); }));
  $$("[data-mat]").forEach((b) => (b.onclick = () => { const id = ui.elSel, material = b.dataset.mat;
    hacer(async () => { await editarElemento(id, { material }); return `Material: ${MATERIALES[material]}`; }); }));
  const pp = V.querySelector("[data-punta]"); if (pp) pp.onclick = () => { ui.punta = ui.punta ? null : ui.elSel; redibujar(); };
  const ap = V.querySelector("[data-a-pared]"); if (ap) ap.onclick = () => { const w = paredDePieza(ui.pz.grupo); soltarAsa(null, null, w); };
  $$("[data-el]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); if (ui.punta || ui.hueco) return;
    const r = b.offsetParent?.getBoundingClientRect(), pt = r ? [((e.clientX - r.left) / r.width) * ANCHO, ((e.clientY - r.top) / r.height) * ALTO] : null;
    tocarElemento(b.dataset.el, null, pt); }));
  $$("[data-estado-area]").forEach((b) => (b.onclick = () => { const a = area(ui.areaSel), est = b.dataset.estadoArea;
    const X0 = (a.x / 100) * ANCHO, Y0 = (a.y / 100) * ALTO, X1 = X0 + (a.w / 100) * ANCHO, Y1 = Y0 + (a.h / 100) * ALTO;
    const dentro = PIEZAS.map((p, i) => [p, i]).filter(([p, i]) => p[0] !== "jardin" && p[0] !== "oculto" && S.piezas[i] !== "quitado" && p[1] >= X0 && p[1] <= X1 && p[2] >= Y0 && p[2] <= Y1).map(([, i]) => i);
    dentro.forEach((i) => (S.piezas[i] = est));
    hacer(async () => { await estadoArea(a.id, est); await estadoPiezas(dentro, est); return `${a.nombre}: ${ESTADOS[est]} (${dentro.length} piezas)`; }); }));
  $$("[data-estado-el]").forEach((b) => (b.onclick = () => { const id = ui.elSel, est = b.dataset.estadoEl, e = S.elementos.find((q) => q.id === id);
    if (e) { e.estado = est; redibujar(); }   // se ve al instante
    hacer(async () => { await editarElemento(id, { estado: est }); return `Marcado: ${(e?.tipo === "hoyo" ? ESTADOS_HOYO : ESTADOS)[est]}`; }); }));
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
  const vg = V.querySelector("#verGente"); if (vg) vg.onclick = () => { ui.sinGente = !ui.sinGente; try { localStorage.setItem("sym-sin-gente", ui.sinGente ? "1" : "0"); } catch (e) {} redibujar(); };
  const hh = V.querySelector("#hudHerr"); if (hh) hh.onclick = () => { cerrarTodo(); ui.verPrestamos = true; redibujar(); };
  const hp = V.querySelector("#hojaPrestar"); if (hp) hp.onclick = () => { cerrarTodo(); ui.prestar = { h: null, nuevo: "", w: null, q: 1 }; redibujar(); };
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
  const bo = V.querySelector("[data-bodega]"); if (bo) bo.onclick = () => { const a = area(ui.areaSel);
    hacer(async () => { await usarComoBodega(a.id); return `${a.nombre} ahora es la bodega de receso`; }); };

  // Receso / Almuerzo: un toque lo activa; otro toque lo termina (todos los de esa pausa regresan a trabajar)
  const modoPausa = (tipo) => {
    cerrarTodo(); const antes = ui.modo, nombre = { receso: "Receso", almuerzo: "Almuerzo" };
    ui.modo = antes === tipo ? null : tipo;
    if (ui.modo) ui.sinGente = false;   // para mandar a receso hay que ver a la gente
    const abiertos = (t) => enReceso().some((r) => (r.tipo || "receso") === t);
    if (antes && abiertos(antes)) return hacer(async () => { await terminarReceso(antes); return `${nombre[antes]} terminado, todos a trabajar`; });
    redibujar();
  };
  $$("[data-salir-modo]").forEach((b) => (b.onclick = () => { ui.modo = null; redibujar(); }));
  const hr = V.querySelector("#hudReceso"); if (hr) hr.onclick = () => modoPausa("receso");
  const hal = V.querySelector("#hudAlmuerzo"); if (hal) hal.onclick = () => modoPausa("almuerzo");
  const rw = V.querySelector("[data-receso-w]"); if (rw) rw.onclick = () => { const id = ui.sel;
    hacer(async () => { const sale = await cambiarReceso(id, recesoAbierto(id)?.tipo || "receso"); return `${primerNombre(trabajador(id).nombre)} ${sale ? "se fue a receso" : "regresó a trabajar"}`; }); };
  // Plan del día (antes era la pestaña Dashboard): va abajo de todo lo de la obra
  const pd = V.querySelector("#planDia"); if (pd) planDia.render(pd, { hacer, redibujar });
}
