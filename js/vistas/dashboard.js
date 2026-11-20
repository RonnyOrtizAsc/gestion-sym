// Plan del día (va abajo en la pestaña Obra): el plan de trabajo del día para el supervisor.
// Responde de un vistazo: qué toca hoy, cómo va cada actividad contra lo programado,
// quién está en qué (y en qué área), qué necesita atención y qué viene mañana.
import { S, area, trabajador, recesoAbierto, esAlmuerzo, actividadPlan, asignados,
  guardarActividad, borrarActividad, ponerAvance, cambiarEstadoActividad, asignarActividad, importarActividades, ponerActividad } from "../datos.js";
import { ESTADO_ACT, MOTIVOS, hoyISO, siguienteDia, avance, esperado, vencida, atrasada, tocaHoy, tocaEl, prioridad,
  fechaCorta, fechaLarga, textoAvance, fechaPlanificador, finPorDias } from "../plan.js";
import { PLANIFICADOR_SHEETS } from "../config.js";
import { cara } from "./fotos.js";
import { lugarDe, nombreArea, areaEn } from "./lugares.js";
import { PAQUETES } from "../planos/trabajos.js";
import { ANCHO, ALTO } from "./mapa-svg.js";
import { esc, primerNombre } from "../util.js";

const UNIDADES = ["m²", "ml", "m³", "unidades", "kg", "qq", "bolsas"];
// abierta = { id, modo: "avance" | "detener" | "editar" }; form = valores del formulario mientras se escribe
const ui = { plano: false, desde: "", escribir: null, texto: "", abierta: null, form: null, motivo: "", necesita: "", hecho: "", verPlan: false, borrar: null, imp: null };

const PILL = { pendiente: "", en_proceso: "ok", detenida: "lost", terminada: "ok" };
const pill = (a) => `<span class="pill ${PILL[a.estado]}">${a.estado === "terminada" ? "✓ " : ""}${ESTADO_ACT[a.estado]}</span>`;
const lugar = (a) => [a.fase, area(a.area_id)?.nombre, a.encargado && `Enc. ${a.encargado}`].filter(Boolean).map(esc).join(" · ");
const areasObra = () => S.areas.filter((x) => !x.es_receso);

export function render(V, ctx) {
  const hoy = hoyISO(), manana = siguienteDia(hoy);
  if (!S.planListo) return V.innerHTML = `<p class="eyebrow">${esc(fechaLarga(hoy))}</p><h2>Plan del día</h2>
    <div class="step"><h3>Falta activar el plan de trabajo</h3><p class="note" style="margin:0">La base de datos todavía no tiene la tabla de actividades.
    Hay que aplicar una vez el cambio <b>supabase/migrations/20261117_actividades_del_plan.sql</b> y luego recargar.</p></div>
    ${seccionTrabajadores([], hoy)}`, conectar(V, ctx);

  const deHoy = S.actividades.filter((a) => tocaHoy(a, hoy))
    .sort((a, b) => prioridad(a, hoy) - prioridad(b, hoy) || (a.fin < b.fin ? -1 : 1));
  const deManana = S.actividades.filter((a) => tocaEl(a, manana))
    .sort((a, b) => (b.inicio > hoy) - (a.inicio > hoy) || a.nombre.localeCompare(b.nombre));
  const trabajando = S.trabajadores.filter((w) => !recesoAbierto(w.id));
  const enPlan = S.trabajadores.filter((w) => w.actividad_id && deHoy.some((a) => a.id === w.actividad_id));
  const sinAct = trabajando.filter((w) => !w.actividad);

  // ---- Atención: lo que el supervisor debería resolver primero ----
  const alertas = [];   // una línea por actividad: [actividad, "lost" | "out", texto]
  for (const a of deHoy) {
    const txt = []; let tipo = "out";
    if (a.estado === "detenida") { tipo = "lost"; txt.push(`Detenida${a.motivo ? ": " + a.motivo : ""}`); }
    else if (vencida(a, hoy)) { tipo = "lost"; txt.push(`Debía terminar el ${fechaCorta(a.fin)} · va en ${avance(a)} %`); }
    else if (atrasada(a, hoy)) txt.push(`Va en ${avance(a)} %, debería ir en ${esperado(a, hoy)} %`);
    if (a.estado !== "detenida" && a.inicio <= hoy && !asignados(a.id).length) txt.push("Nadie asignado");
    if (txt.length) alertas.push([a, tipo, txt.join(" · ")]);
  }
  alertas.sort((x, y) => (x[1] === "lost" ? 0 : 1) - (y[1] === "lost" ? 0 : 1));

  V.innerHTML = `<p class="eyebrow">${esc(fechaLarga(hoy))}</p><h2>Plan del día</h2>
  <div class="stats">
    <div class="stat"><b>${deHoy.length}</b><span>actividades hoy</span></div>
    <div class="stat w"><b>${enPlan.length}<small class="de">/${S.trabajadores.length}</small></b><span>en el plan de hoy</span></div>
    <div class="stat ${sinAct.length ? "rojo" : ""}"><b>${sinAct.length}</b><span>sin actividad</span></div></div>

  ${alertas.length || sinAct.length ? `<div class="section dash-atencion"><p class="eyebrow">Atención</p><div class="list">
    ${alertas.map(([a, tipo, txt]) => `<button class="li dash-alerta" data-ir="${a.id}"><div class="grow"><b>${esc(a.nombre)}</b><small>${esc(txt)}</small></div><span class="pill ${tipo}">${tipo === "lost" ? "Urgente" : "Revisar"}</span></button>`).join("")}
    ${sinAct.length ? `<a class="li dash-alerta" href="#dash-gente"><div class="grow"><b>${sinAct.length} ${sinAct.length === 1 ? "persona" : "personas"} sin actividad</b><small>${sinAct.map((w) => esc(primerNombre(w.nombre))).join(", ")}</small></div><span class="pill out">Asignar</span></a>` : ""}
  </div></div>` : ""}

  <div class="section"><p class="eyebrow">Hoy · plan de trabajo</p>
    ${deHoy.length ? deHoy.map((a) => tarjeta(a, hoy)).join("") : `<div class="list"><div class="empty">No hay actividades programadas para hoy. ${S.actividades.length ? "" : "Agrega el plan abajo o impórtalo del Planificador."}</div></div>`}</div>

  <div class="section"><p class="eyebrow">Mañana · ${esc(fechaCorta(manana))}</p><div class="list">
    ${deManana.length ? deManana.map((a) => `<div class="li"><div class="grow"><b>${esc(a.nombre)}</b><small>${lugar(a) || "Sin área"} · hasta ${esc(fechaCorta(a.fin))}</small></div>
      ${a.inicio > hoy ? `<span class="pill out">Empieza</span>` : `<span class="num">${avance(a)} %</span>`}</div>`).join("") : `<div class="empty">Nada programado para mañana.</div>`}</div>
    ${deManana.some((a) => a.inicio > hoy) ? `<p class="note">Lo que empieza mañana: revisa hoy que haya material, herramienta y gente.</p>` : ""}</div>

  ${seccionTrabajadores(deHoy, hoy)}
  ${seccionPlan(hoy)}`;
  conectar(V, ctx);
}

// ---------- Tarjeta de una actividad de hoy ----------
function tarjeta(a, hoy) {
  const pct = avance(a), esp = esperado(a, hoy), gente = asignados(a.id), ab = ui.abierta?.id === a.id ? ui.abierta.modo : null;
  const estadoClase = a.estado === "detenida" || vencida(a, hoy) ? "mal" : atrasada(a, hoy) ? "atras" : "";
  return `<div class="act-card ${estadoClase}" id="act-${a.id}">
    <div class="act-top"><div class="grow"><b>${esc(a.nombre)}</b><small>${lugar(a) || "Sin área"} · ${esc(fechaCorta(a.inicio))} → ${esc(fechaCorta(a.fin))}</small></div>${pill(a)}</div>
    <div class="act-bar" role="img" aria-label="Avance ${pct} %, debería ir en ${esp} %"><i style="width:${pct}%"></i>${!vencida(a, hoy) && esp > 0 ? `<s style="left:${esp}%"></s>` : ""}</div>
    <div class="act-nums"><span><b>${pct} %</b>${a.cantidad ? " · " + esc(textoAvance(a)) : ""}</span><span>debería ${esp} %</span></div>
    ${a.estado === "detenida" && a.motivo ? `<p class="act-motivo">⚠ ${esc(a.motivo)}</p>` : ""}
    <div class="act-gente">${gente.length ? gente.map((w) => `<span class="persona-chip ${recesoAbierto(w.id) ? "receso" : ""}"><span class="avatar mini">${cara(w)}</span>${esc(primerNombre(w.nombre))}</span>`).join("")
      : `<span class="note" style="margin:0">Nadie asignado · asígnalo en “Trabajadores”</span>`}</div>
    <div class="acts">
      <button class="btn small ${ab === "avance" ? "primary" : ""}" data-modo="avance" data-a="${a.id}">Anotar avance</button>
      ${a.estado === "detenida" ? `<button class="btn small" data-reanudar="${a.id}">Reanudar</button>`
        : `<button class="btn small ${ab === "detener" ? "primary" : ""}" data-modo="detener" data-a="${a.id}">Detenida</button>`}
      <button class="btn small" data-terminar="${a.id}">Terminada ✓</button>
      <button class="linkbtn" data-modo="editar" data-a="${a.id}">Editar</button></div>
    ${ab === "avance" ? panelAvance(a) : ab === "detener" ? panelDetener(a) : ab === "editar" ? formActividad(a) : ""}
  </div>`;
}

function panelAvance(a) {
  const val = ui.hecho !== "" ? ui.hecho : a.cantidad ? +a.hecho : avance(a);
  return `<form class="act-panel" id="fAvance" data-a="${a.id}">
    <label for="hecho">${a.cantidad ? `¿Cuánto llevan en total? (de ${+a.cantidad} ${esc(a.unidad || "")})` : "¿En qué porcentaje va?"}</label>
    ${a.cantidad ? "" : `<div class="chips" style="margin:6px 0">${[25, 50, 75, 100].map((n) => `<button type="button" class="chip" data-pct="${n}">${n} %</button>`).join("")}</div>`}
    <div class="addrow" style="margin-top:6px"><input id="hecho" type="number" inputmode="decimal" step="any" min="0" ${a.cantidad ? `max="${+a.cantidad}"` : `max="100"`} value="${esc(val)}">
      <span class="num" style="align-self:center">${esc(a.cantidad ? a.unidad || "" : "%")}</span><button class="btn primary">Guardar avance</button></div></form>`;
}

function panelDetener(a) {
  return `<form class="act-panel" id="fDetener" data-a="${a.id}"><label>¿Por qué se detuvo?</label>
    <div class="chips" style="margin:6px 0">${MOTIVOS.map((m) => `<button type="button" class="chip" data-motivo="${esc(m)}" aria-pressed="${ui.motivo === m}">${esc(m)}</button>`).join("")}</div>
    <div class="addrow"><input id="necesita" placeholder="¿Qué se necesita? Ej. 10 bolsas de cemento" value="${esc(ui.necesita)}" maxlength="120" autocomplete="off">
      <button class="btn primary" ${ui.motivo ? "" : "disabled"}>Marcar detenida</button></div></form>`;
}

// ---------- Formulario para agregar o editar una actividad ----------
function formActividad(a = null) {
  const hoy = hoyISO();
  const f = ui.form || (ui.form = a ? { nombre: a.nombre, fase: a.fase || "", area_id: a.area_id || "", inicio: a.inicio, fin: a.fin,
    cantidad: a.cantidad ?? "", unidad: a.unidad || "", encargado: a.encargado || "" }
    : { nombre: "", fase: "", area_id: "", inicio: hoy, fin: finPorDias(hoy, 1), cantidad: "", unidad: "", encargado: "" });
  const nombres = [...new Set(S.actividades.map((x) => x.nombre))], fases = [...new Set(S.actividades.map((x) => x.fase).filter(Boolean))];
  return `<form class="act-panel act-form" id="fAct" data-a="${a?.id || ""}">
    <div class="field"><label for="fNombre">Actividad</label><input id="fNombre" data-f="nombre" list="dlNombres" value="${esc(f.nombre)}" placeholder="Ej. Repello de pared norte" required maxlength="100" autocomplete="off"></div>
    <div class="dos"><div class="field"><label for="fArea">Área</label><select id="fArea" data-f="area_id"><option value="">Sin área</option>
        ${areasObra().map((x) => `<option value="${x.id}" ${f.area_id === x.id ? "selected" : ""}>${esc(nombreArea(x))}</option>`).join("")}</select></div>
      <div class="field"><label for="fFase">Fase (opcional)</label><input id="fFase" data-f="fase" list="dlFases" value="${esc(f.fase)}" placeholder="Ej. Obra gris" autocomplete="off"></div></div>
    <div class="dos"><div class="field"><label for="fIni">Empieza</label><input id="fIni" type="date" data-f="inicio" value="${esc(f.inicio)}" required></div>
      <div class="field"><label for="fFin">Termina</label><input id="fFin" type="date" data-f="fin" value="${esc(f.fin)}" min="${esc(f.inicio)}" required></div></div>
    <div class="dos"><div class="field"><label for="fCant">Cantidad (opcional)</label><input id="fCant" type="number" inputmode="decimal" step="any" min="0" data-f="cantidad" value="${esc(f.cantidad)}" placeholder="Ej. 120"></div>
      <div class="field"><label for="fUni">Unidad</label><input id="fUni" data-f="unidad" list="dlUnidades" value="${esc(f.unidad)}" placeholder="m²" autocomplete="off"></div></div>
    <div class="field"><label for="fEnc">Encargado (opcional)</label><input id="fEnc" data-f="encargado" value="${esc(f.encargado)}" autocomplete="off"></div>
    <p class="note" style="margin:-4px 0 10px">Sin cantidad, el avance se anota en %. Se cuentan días de lunes a sábado.</p>
    <datalist id="dlNombres">${nombres.map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
    <datalist id="dlFases">${fases.map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
    <datalist id="dlUnidades">${UNIDADES.map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
    <div class="acts"><button class="btn primary">${a ? "Guardar cambios" : "Agregar al plan"}</button><button type="button" class="btn" data-cerrar>Cancelar</button>
      ${a ? ui.borrar === a.id ? `<button type="button" class="btn danger" data-borrar-si="${a.id}">Sí, borrar</button>` : `<button type="button" class="btn danger" data-borrar="${a.id}">Borrar</button>` : ""}</div>
  </form>`;
}

// ---------- Trabajadores por área, con su actividad ----------
function seccionTrabajadores(deHoy, hoy) {
  const grupos = new Map();
  // por área; quien está fuera de las áreas va con el nombre de su lugar (gradas, caseta, jardinera…)
  for (const w of S.trabajadores) { const k = area(w.area_id)?.id || (lugarDe(w) ? "@" + lugarDe(w) : ""); (grupos.get(k) || grupos.set(k, []).get(k)).push(w); }
  const orden = [...areasObra(), ...S.areas.filter((x) => x.es_receso)].map((x) => x.id).filter((id) => grupos.has(id));
  orden.push(...[...grupos.keys()].filter((k) => k.startsWith("@")).sort());
  if (grupos.has("")) orden.push("");
  // actividades escritas a mano que ya está usando alguien (para elegirlas con un toque)
  const libres = [...new Set(S.trabajadores.filter((x) => x.actividad && !x.actividad_id).map((x) => x.actividad.trim()))].sort();
  const opciones = (w) => {
    const libre = w.actividad && !w.actividad_id, otra = w.actividad_id && !deHoy.some((a) => a.id === w.actividad_id) ? actividadPlan(w.actividad_id) : null;
    return `<option value="">— Sin actividad —</option>
      ${libre ? `<option value="__libre" selected>✎ ${esc(w.actividad)} (fuera del plan)</option>` : ""}
      ${otra ? `<option value="${otra.id}" selected>${esc(otra.nombre)} (no toca hoy)</option>` : ""}
      ${deHoy.filter((a) => a.estado !== "detenida" || a.id === w.actividad_id).map((a) => `<option value="${a.id}" ${a.id === w.actividad_id ? "selected" : ""}>${esc(a.nombre)}${area(a.area_id) ? " · " + esc(area(a.area_id).nombre) : ""}</option>`).join("")}
      ${libres.filter((t) => t !== w.actividad).map((t) => `<option value="txt:${esc(t)}">✎ ${esc(t)}</option>`).join("")}
      <option value="__nueva">✎ Escribir otra actividad…</option>`;
  };
  return `<div class="section" id="dash-gente"><p class="eyebrow">Trabajadores · área y actividad</p>
    ${S.trabajadores.length ? `<div class="list">${orden.map((k) => `<div class="person-h">${k.startsWith("@") ? esc(k.slice(1)) : k ? esc(nombreArea(area(k))) : "Sin lugar en el plano"}<span class="num" style="margin-left:auto">${grupos.get(k).length}</span></div>
      ${grupos.get(k).map((w) => { const r = recesoAbierto(w.id), sin = !w.actividad && !r;
        return `<div class="li dash-w ${sin ? "sin" : ""}"><span class="avatar chico">${cara(w)}</span>
          <div class="grow"><b>${esc(w.nombre)}</b><small>${r ? (esAlmuerzo(r) ? "Almorzando" : "En receso") : sin ? "Sin actividad" : esc(w.puesto || "")}</small></div>
          ${S.planListo ? `<select class="dash-sel" data-asignar="${w.id}" aria-label="Actividad de ${esc(w.nombre)}">${opciones(w)}</select>`
            : `<span class="note" style="margin:0">${esc(w.actividad || "—")}</span>`}</div>
          ${ui.escribir === w.id ? `<form class="li dash-escribir" data-escribir="${w.id}"><input id="txtAct" value="${esc(ui.texto)}" placeholder="¿Qué está haciendo ${esc(primerNombre(w.nombre))}? Ej. Cortando piso" maxlength="80" autocomplete="off">
            <button class="btn primary">Guardar</button><button type="button" class="btn" data-no-escribir>Cancelar</button></form>` : ""}`; }).join("")}`).join("")}</div>`
      : `<div class="list"><div class="empty">Todavía no hay trabajadores. Agrégalos en “Más”.</div></div>`}
    ${S.planListo ? `<p class="note">Al elegir una actividad que tiene área, la persona se mueve a esa área en el plano.</p>` : ""}</div>`;
}

// ---------- Plan completo: agregar, editar e importar ----------
function seccionPlan(hoy) {
  const todas = S.actividades.slice().sort((a, b) => (a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : a.nombre.localeCompare(b.nombre)));
  const nueva = ui.abierta?.id === "nueva";
  return `<div class="section"><p class="eyebrow">Plan de trabajo completo (${todas.length})</p>
    ${nueva ? `<div class="act-card">${formActividad(null)}</div>` : `<div class="acts" style="margin-bottom:10px"><button class="btn primary" data-nueva>+ Agregar actividad</button>
      <button class="btn" data-plano>Trabajos de los planos</button>
      <button class="btn" data-importar>${S.actividades.some((a) => a.origen && !a.origen.startsWith("plano:")) ? "Actualizar desde el Planificador" : "Importar del Planificador"}</button></div>`}
    ${ui.plano ? panelPlano(hoy) : ""}
    ${ui.imp ? panelImportar() : ""}
    ${todas.length ? `<button class="linkbtn" data-ver-plan>${ui.verPlan ? "Ocultar plan completo ▴" : "Ver plan completo ▾"}</button>
    ${ui.verPlan ? `<div class="list" style="margin-top:8px">${todas.map((a) => ui.abierta?.id === a.id && ui.abierta.modo === "editar-plan"
      ? `<div class="li" style="display:block">${formActividad(a)}</div>`
      : `<div class="li"><div class="grow"><b>${esc(a.nombre)}</b><small>${esc(fechaCorta(a.inicio))} → ${esc(fechaCorta(a.fin))}${lugar(a) ? " · " + lugar(a) : ""}</small></div>
        <span class="num">${avance(a)} %</span>${pill(a)}<button class="linkbtn" data-modo="editar-plan" data-a="${a.id}">Editar</button></div>`).join("")}</div>` : ""}` : ""}
  </div>`;
}

// Obra nueva sacada de los planos: se carga al plan con un toque (sin repetir lo ya cargado)
function filasPaquete(pq, desde) {
  const pt = pq.punto, a = areaEn((pt[0] / ANCHO) * 100, (pt[1] / ALTO) * 100);
  let dia = desde;
  return pq.trabajos.map((t, k) => {
    const f = { origen: `plano:${pq.id}:${String(k + 1).padStart(2, "0")}`, nombre: t.nombre, fase: `${pq.nombre.split(" ")[0]} · ${t.fase}`,
      area_id: a?.id || null, inicio: dia, fin: dia, cantidad: t.cantidad || null, unidad: t.unidad || null, encargado: null };
    dia = siguienteDia(dia); return f;
  });
}
function panelPlano(hoy) {
  const desde = ui.desde || hoy;
  return `<div class="step"><h3>Trabajos de los planos</h3>
    <p class="note" style="margin:0 0 10px">Lo que se va a construir, sacado de los planos. Se agregan uno por día de trabajo desde la fecha que elijas; después ajustas las fechas de cada uno.</p>
    <div class="field"><label for="planoDesde">Empiezan el</label><input id="planoDesde" type="date" value="${esc(desde)}"></div>
    ${PAQUETES.map((pq) => { const ya = S.actividades.filter((a) => (a.origen || "").startsWith(`plano:${pq.id}:`)).length;
      return `<div class="li" style="display:block"><b>${esc(pq.nombre)}</b><small style="display:block">${pq.trabajos.length} trabajos · hojas ${esc(pq.hojas)}</small>
        <p class="note" style="margin:6px 0">${esc(pq.nota)}</p>
        <div class="acts"><button class="btn primary small" data-paquete="${pq.id}" ${ya >= pq.trabajos.length ? "disabled" : ""}>${ya >= pq.trabajos.length ? "Ya está en el plan" : ya ? `Agregar los ${pq.trabajos.length - ya} que faltan` : `Agregar ${pq.trabajos.length} trabajos`}</button></div></div>`; }).join("")}
    <div class="acts" style="margin-top:10px"><button class="btn small" data-plano>Cerrar</button></div></div>`;
}

function panelImportar() {
  const im = ui.imp;
  if (im.cargando) return `<div class="step"><p class="note" style="margin:0">Conectando con el Planificador (Google Sheets)…</p></div>`;
  if (im.error) return `<div class="step"><p class="err" style="margin:0 0 8px">${esc(im.error)}</p><div class="acts"><button class="btn small" data-importar>Reintentar</button><button class="btn small" data-imp-cerrar>Cerrar</button></div></div>`;
  const filas = filasDeProyecto(im.proyecto);
  return `<div class="step"><h3>Importar del Planificador</h3>
    <div class="field"><label for="impProy">Proyecto</label><select id="impProy">${im.proyectos.map((p) => `<option value="${esc(p.id)}" ${p.id === im.proyecto ? "selected" : ""}>${esc(p.nombre)}</option>`).join("")}</select></div>
    <p class="note" style="margin:0 0 10px">${filas.length} actividades. Las que ya importaste se actualizan (fechas, cantidad, área) sin perder su avance.</p>
    <div class="acts"><button class="btn primary" data-imp-si ${filas.length ? "" : "disabled"}>Importar ${filas.length}</button><button class="btn" data-imp-cerrar>Cancelar</button></div></div>`;
}

// Convierte las filas del Planificador (Google Sheets) al formato del Dashboard
function filasDeProyecto(pid) {
  const porNombre = new Map(areasObra().map((x) => [x.nombre.trim().toLowerCase(), x.id]));
  return (ui.imp?.planes || []).filter((p) => String(p.ID_PROYECTO ?? p.projectId ?? "") === String(pid)).map((p) => {
    const inicio = fechaPlanificador(p.INICIO ?? p.start), dur = +(p.DURACION ?? p.duration) || 1;
    let fin = fechaPlanificador(p.FIN ?? p.end) || (inicio && finPorDias(inicio, dur));
    if (inicio && fin < inicio) fin = inicio;
    const sub = String(p["SUBÁREA"] ?? p.SUBAREA ?? p.subarea ?? "").trim().toLowerCase(), cant = +(p.CANTIDAD ?? p.quantity);
    return { origen: String(p.ID_PLAN ?? p.id ?? ""), nombre: String(p.ACTIVIDAD ?? p.name ?? "").trim(), fase: String(p.FASE ?? p.phase ?? "").trim() || null,
      area_id: porNombre.get(sub) || null, inicio, fin, cantidad: cant > 0 ? cant : null, unidad: String(p.UNIDAD ?? p.unit ?? "").trim() || null,
      encargado: String(p.ENCARGADO ?? p.manager ?? "").trim() || null };
  }).filter((f) => f.origen && f.nombre && f.inicio);
}

// El Planificador responde por JSONP (igual que en el Planificador mismo)
function leerPlanificador() {
  return new Promise((ok, mal) => {
    const cb = `sym_plan_${Date.now()}`, s = document.createElement("script");
    const fin = () => { clearTimeout(t); delete window[cb]; s.remove(); };
    const t = setTimeout(() => { fin(); mal(new Error("El Planificador tardó demasiado en responder.")); }, 20000);
    window[cb] = (d) => { fin(); d && d.ok === false ? mal(new Error(d.error || "Google Sheets devolvió un error.")) : ok(d); };
    s.onerror = () => { fin(); mal(new Error("No se pudo conectar con el Planificador.")); };
    s.src = `${PLANIFICADOR_SHEETS}?callback=${cb}`;
    document.body.appendChild(s);
  });
}
const arreglo = (d, nombres) => { for (const n of nombres) if (Array.isArray(d?.[n])) return d[n]; return []; };

// ---------- Interacción ----------
function conectar(V, { hacer, redibujar }) {
  const $$ = (s) => V.querySelectorAll(s);
  const abrir = (id, modo) => { const igual = ui.abierta?.id === id && ui.abierta.modo === modo;
    ui.abierta = igual ? null : { id, modo }; ui.form = null; ui.hecho = ""; ui.motivo = ""; ui.necesita = ""; ui.borrar = null; redibujar();
    if (!igual) V.querySelector(`#act-${id}, #fAct`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }); };
  const cerrar = () => { ui.abierta = null; ui.form = null; ui.borrar = null; };

  $$("[data-ir]").forEach((b) => (b.onclick = () => document.getElementById("act-" + b.dataset.ir)?.scrollIntoView({ behavior: "smooth", block: "start" })));
  $$("[data-modo]").forEach((b) => (b.onclick = () => abrir(b.dataset.a, b.dataset.modo)));
  $$("[data-nueva]").forEach((b) => (b.onclick = () => abrir("nueva", "editar")));
  $$("[data-cerrar]").forEach((b) => (b.onclick = () => { cerrar(); redibujar(); }));
  $$("[data-ver-plan]").forEach((b) => (b.onclick = () => { ui.verPlan = !ui.verPlan; redibujar(); }));

  // Estado
  $$("[data-reanudar]").forEach((b) => (b.onclick = () => { const a = actividadPlan(b.dataset.reanudar);
    hacer(async () => { await cambiarEstadoActividad(a.id, avance(a) > 0 || asignados(a.id).length ? "en_proceso" : "pendiente"); return `${a.nombre}: reanudada`; }); }));
  $$("[data-terminar]").forEach((b) => (b.onclick = () => { const a = actividadPlan(b.dataset.terminar); cerrar();
    hacer(async () => { const n = asignados(a.id).length; await cambiarEstadoActividad(a.id, "terminada");
      return n ? `${a.nombre} terminada · ${n} ${n === 1 ? "persona queda" : "personas quedan"} sin actividad` : `${a.nombre} terminada`; }); }));

  // Avance
  const fA = V.querySelector("#fAvance");
  if (fA) { const inp = fA.querySelector("#hecho"); inp.oninput = () => (ui.hecho = inp.value);
    fA.querySelectorAll("[data-pct]").forEach((c) => (c.onclick = () => { inp.value = ui.hecho = c.dataset.pct; }));
    fA.onsubmit = (e) => { e.preventDefault(); const a = actividadPlan(fA.dataset.a), h = parseFloat(inp.value); if (!(h >= 0)) return; cerrar();
      hacer(async () => { await ponerAvance(a.id, h); const total = a.cantidad || 100; return h >= total ? `${a.nombre}: ¡terminada!` : `${a.nombre}: avance guardado`; }); }; }

  // Detenida
  const fD = V.querySelector("#fDetener");
  if (fD) { const inp = fD.querySelector("#necesita"), btn = fD.querySelector("button.primary");
    inp.oninput = () => (ui.necesita = inp.value);
    fD.querySelectorAll("[data-motivo]").forEach((c) => (c.onclick = () => { ui.motivo = c.dataset.motivo; btn.disabled = false;
      fD.querySelectorAll("[data-motivo]").forEach((x) => x.setAttribute("aria-pressed", String(x === c))); }));
    fD.onsubmit = (e) => { e.preventDefault(); if (!ui.motivo) return; const a = actividadPlan(fD.dataset.a);
      const motivo = ui.necesita.trim() ? `${ui.motivo}: ${ui.necesita.trim()}` : ui.motivo; cerrar();
      hacer(async () => { await cambiarEstadoActividad(a.id, "detenida", motivo); return `${a.nombre}: detenida`; }); }; }

  // Agregar / editar
  const fF = V.querySelector("#fAct");
  if (fF) {
    fF.querySelectorAll("[data-f]").forEach((el) => (el.oninput = el.onchange = () => { ui.form[el.dataset.f] = el.value;
      if (el.dataset.f === "inicio") { const fin = fF.querySelector("#fFin"); fin.min = el.value; if (fin.value < el.value) fin.value = ui.form.fin = el.value; } }));
    fF.onsubmit = (e) => { e.preventDefault(); const f = ui.form, id = fF.dataset.a || null;
      const datos = { nombre: f.nombre.trim(), fase: f.fase.trim() || null, area_id: f.area_id || null, inicio: f.inicio, fin: f.fin < f.inicio ? f.inicio : f.fin,
        cantidad: +f.cantidad > 0 ? +f.cantidad : null, unidad: f.unidad.trim() || null, encargado: f.encargado.trim() || null };
      if (!datos.nombre || !datos.inicio) return; cerrar();
      hacer(async () => { await guardarActividad(datos, id); return id ? "Actividad guardada" : `${datos.nombre}: agregada al plan`; }); };
  }
  $$("[data-borrar]").forEach((b) => (b.onclick = () => { ui.borrar = b.dataset.borrar; redibujar(); }));
  $$("[data-borrar-si]").forEach((b) => (b.onclick = () => { const a = actividadPlan(b.dataset.borrarSi); cerrar();
    hacer(async () => { await borrarActividad(a.id); return `${a.nombre}: borrada del plan`; }); }));

  // Asignar trabajador a una actividad
  $$("[data-asignar]").forEach((s) => (s.onchange = () => { const wid = s.dataset.asignar, v = s.value; if (v === "__libre") return;
    if (v === "__nueva") { ui.escribir = wid; ui.texto = ""; redibujar(); V.querySelector("#txtAct")?.focus(); return; }
    if (v.startsWith("txt:")) { const t = v.slice(4), n = primerNombre(trabajador(wid).nombre); return hacer(async () => { await ponerActividad(wid, t); return `${n}: ${t}`; }); }
    const n = primerNombre(trabajador(wid).nombre), a = v ? actividadPlan(v) : null;
    hacer(async () => { await asignarActividad(wid, v || null); return a ? `${n} → ${a.nombre}` : `${n} sin actividad`; }); }));

  // Escribir una actividad a mano
  const fe = V.querySelector("[data-escribir]");
  if (fe) { const inp = fe.querySelector("#txtAct"); inp.oninput = () => (ui.texto = inp.value);
    fe.onsubmit = (e) => { e.preventDefault(); const wid = fe.dataset.escribir, t = inp.value.trim(), n = primerNombre(trabajador(wid).nombre); if (!t) return;
      ui.escribir = null; ui.texto = ""; hacer(async () => { await ponerActividad(wid, t); return `${n}: ${t}`; }); };
    fe.querySelector("[data-no-escribir]").onclick = () => { ui.escribir = null; ui.texto = ""; redibujar(); }; }

  // Trabajos de los planos
  $$("[data-plano]").forEach((b) => (b.onclick = () => { ui.plano = !ui.plano; redibujar(); }));
  const pd = V.querySelector("#planoDesde"); if (pd) pd.onchange = () => { ui.desde = pd.value; };
  $$("[data-paquete]").forEach((b) => (b.onclick = () => { const pq = PAQUETES.find((x) => x.id === b.dataset.paquete), ya = new Set(S.actividades.map((a) => a.origen));
    const filas = filasPaquete(pq, ui.desde || hoyISO()).filter((f) => !ya.has(f.origen)); ui.plano = false; ui.verPlan = true;
    hacer(async () => { await importarActividades(filas); return `${pq.nombre}: ${filas.length} trabajos agregados al plan`; }); }));

  // Importar del Planificador
  $$("[data-importar]").forEach((b) => (b.onclick = async () => {
    ui.imp = { cargando: true }; redibujar();
    try {
      const d = await leerPlanificador();
      const proyectos = arreglo(d, ["projects", "PROYECTOS"]).map((p) => ({ id: String(p.ID_PROYECTO ?? p.id ?? ""), nombre: String(p.NOMBRE ?? p.nombre ?? p.name ?? "Proyecto") })).filter((p) => p.id);
      const planes = arreglo(d, ["plannedActivities", "PLAN_ACTIVIDADES"]);
      if (!proyectos.length) throw new Error("El Planificador no tiene proyectos.");
      // Por defecto, el proyecto con más actividades
      const cuenta = (id) => planes.filter((p) => String(p.ID_PROYECTO ?? p.projectId ?? "") === id).length;
      ui.imp = { proyectos, planes, proyecto: proyectos.slice().sort((a, b) => cuenta(b.id) - cuenta(a.id))[0].id };
    } catch (e) { ui.imp = { error: e.message }; }
    redibujar();
  }));
  const sp = V.querySelector("#impProy"); if (sp) sp.onchange = () => { ui.imp.proyecto = sp.value; redibujar(); };
  $$("[data-imp-cerrar]").forEach((b) => (b.onclick = () => { ui.imp = null; redibujar(); }));
  $$("[data-imp-si]").forEach((b) => (b.onclick = () => { const filas = filasDeProyecto(ui.imp.proyecto); ui.imp = null; ui.verPlan = true;
    hacer(async () => { const r = await importarActividades(filas); return `Importadas ${r.nuevas} · actualizadas ${r.actualizadas}`; }); }));
}
