// Vista "Receso": dos turnos por día (mañana y tarde) con su límite de minutos.
// Cada turno suma todos los pedazos de receso; si alguien se pasa, se marca en rojo y cuenta como tiempo perdido.
import { S, recesoAbierto, cambiarReceso, terminarReceso, trabajador, borrarRecesosHoy,
  limiteReceso, turnoDe, turnoActual, recesoTurno, excesoHoy, esAlmuerzo, almuerzoHoy, excesoAlmuerzo, LIMITE_ALMUERZO, enReceso,
  estadoAvisos, activarAvisos, regresarEn, ponerHoras } from "../datos.js";
import { cara } from "./fotos.js";
import { esc, minutos, dur, hhmm, ms } from "../util.js";

const ui = { periodo: "semana", borrar: false, tipo: "receso", pregunta: null, tipoElegido: null, corrige: null };   // corrige: { id, fin }
const limiteDe = (r) => (esAlmuerzo(r) ? LIMITE_ALMUERZO : limiteReceso());
// el receso de hoy que más se pasó de esa persona (el abierto primero)
const paraCorregir = (wid) => recesoAbierto(wid) || S.recesos.filter((r) => r.trabajador_id === wid && r.fin)
  .sort((a, b) => (ms(b.fin) - ms(b.inicio)) - (ms(a.fin) - ms(a.inicio)))[0];
function abrirCorregir(r) { ui.pregunta = null; ui.corrige = { id: r.id }; }
// "Corregir": hora de salida (ya puesta) y hora en que regresó a trabajar (la escribe ella)
const hm = (t) => hhmm(new Date(t).toISOString());
function corregir() {
  const c = ui.corrige, r = c && S.recesos.find((x) => x.id === c.id); if (!r) return "";
  const w = trabajador(r.trabajador_id);
  return `<div class="pregunta-r corrige" role="dialog" aria-label="Corregir horas de ${esc(w.nombre)}"><p><b>${esc(w.nombre)}</b> · ${esAlmuerzo(r) ? "almuerzo" : "receso"}</p>
    <div class="horas-c"><label>Hora de salida<input type="time" id="hIni" value="${hm(r.inicio)}"></label>
      <label>Regresó a trabajar<input type="time" id="hFin" value="${r.fin ? hm(r.fin) : ""}" autofocus></label></div>
    <p class="err" id="errC" hidden></p>
    <div class="acts"><button class="btn primary" data-guardar-c>Guardar</button><button class="btn small" data-cancelar-c>Cancelar</button></div></div>`;
}

// ¿Es hora de almuerzo? (11:45 a 13:30): si en ese rato lo mandan "a receso", se pregunta si no será almuerzo
const horaAlmuerzo = () => { const d = new Date(), mm = d.getHours() * 60 + d.getMinutes(); return mm >= 11 * 60 + 45 && mm <= 13 * 60 + 30; };
const OLVIDO = 10;   // minutos pasado del límite: ahí se pregunta si ya regresó y se olvidó marcarlo
// cuánto lleva pasado del límite el receso/almuerzo que tiene abierto (minutos; 0 si no se pasó)
function pasadoAbierto(w) { const r = recesoAbierto(w.id); if (!r) return 0;
  const alm = esAlmuerzo(r), lim = alm ? LIMITE_ALMUERZO : limiteReceso(), usado = alm ? almuerzoHoy(w.id) : recesoTurno(w.id, turnoDe(r.inicio));
  return Math.max(0, m(usado) - lim); }
// la hora en que se cumplió su tiempo (para "regresó a tiempo, se me olvidó marcarlo")
function finALaHora(w) { const r = recesoAbierto(w.id), alm = esAlmuerzo(r), lim = alm ? LIMITE_ALMUERZO : limiteReceso();
  const usado = alm ? almuerzoHoy(w.id) : recesoTurno(w.id, turnoDe(r.inicio)), ahoraP = Date.now() - ms(r.inicio);
  return ms(r.inicio) + Math.max(60000, lim * 60000 - (usado - ahoraP)); }   // tipo: qué hace un toque (receso o almuerzo)
const NOMBRE_TURNO = { manana: "Mañana", tarde: "Tarde", almuerzo: "Almuerzo" };
const fechaISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const m = (msec) => Math.round(msec / 60000);

// Totales desde una fecha: resumen guardado (días anteriores) + hoy en vivo
function acumulado(desde) {
  const tot = {}, fila = (id) => (tot[id] ||= { min: 0, exceso: 0, alm: 0, n: 0, dias: new Set() });
  for (const r of S.resumen) if (r.fecha >= desde) { const t = fila(r.trabajador_id); t.min += r.minutos; t.alm += r.min_almuerzo || 0;
    t.exceso += (r.exceso || 0) + (r.exceso_almuerzo || 0); t.n += r.cantidad; t.dias.add(r.fecha); }
  for (const w of S.trabajadores) {
    const hoyMin = m(recesoTurno(w.id, "manana") + recesoTurno(w.id, "tarde")), hoyAlm = m(almuerzoHoy(w.id));
    if (hoyMin > 0 || hoyAlm > 0) { const t = fila(w.id); t.min += hoyMin; t.alm += hoyAlm; t.exceso += Math.round(excesoHoy(w.id) + excesoAlmuerzo(w.id));
      t.n += S.recesos.filter((r) => r.trabajador_id === w.id && !esAlmuerzo(r)).length; t.dias.add("hoy"); }
  }
  return tot;
}

// Barrita de un turno: "Mañana 3 de 15" (o "se pasó 4 min"); t = "manana", "tarde" o "almuerzo"
function turno(w, t) {
  const alm = t === "almuerzo", lim = alm ? LIMITE_ALMUERZO : limiteReceso(), usado = alm ? almuerzoHoy(w.id) : recesoTurno(w.id, t), r = recesoAbierto(w.id);
  const activo = r && (alm ? esAlmuerzo(r) : !esAlmuerzo(r) && turnoDe(r.inicio) === t);
  const pct = Math.min(100, (usado / (lim * 60000)) * 100), pasado = m(usado) > lim;
  // si está corriendo, el reloj arranca desde lo que ya llevaba en ese turno
  const reloj = activo ? `<b class="num" data-desde="${ms(r.inicio) - (usado - (Date.now() - ms(r.inicio)))}" data-limite="${lim}"></b>` : `<b class="num">${m(usado)}</b>`;
  return `<div class="turno ${pasado ? "pasado" : ""} ${activo ? "activo" : ""} ${alm ? "almuerzo" : ""}"><span>${NOMBRE_TURNO[t]}</span>${reloj}<small>de ${lim}${pasado ? ` · se pasó ${m(usado) - lim}` : ""}</small>
    <div class="bar"><i style="width:${pct}%"></i></div></div>`;
}

function pregunta() {
  const p = ui.pregunta, w = p && trabajador(p.w); if (!w) return "";
  if (p.que === "almuerzo") return `<div class="pregunta-r" role="dialog" aria-label="¿Receso o almuerzo?"><p>Ya es hora de almuerzo 🍽️ ¿<b>${esc(w.nombre)}</b> va a almorzar o a su receso?</p>
    <div class="acts"><button class="btn primary" data-resp="almuerzo">A almorzar</button><button class="btn" data-resp="receso">A receso</button><button class="btn small" data-resp="no">Cancelar</button></div></div>`;
  const r = recesoAbierto(w.id), alm = esAlmuerzo(r), a = new Date(finALaHora(w)).toISOString();
  return `<div class="pregunta-r" role="dialog" aria-label="¿Ya regresó?"><p><b>${esc(w.nombre)}</b> lleva ${pasadoAbierto(w)} min más de su ${alm ? "almuerzo" : "receso"}. ¿Ya había regresado?</p>
    <div class="acts"><button class="btn primary" data-resp="atiempo">Sí, regresó a las ${hhmm(a)} (a tiempo)</button><button class="btn" data-resp="otra">Regresó a otra hora</button><button class="btn" data-resp="ahora">Regresa ahorita</button><button class="btn small" data-resp="no">Sigue en ${alm ? "almuerzo" : "receso"}</button></div></div>`;
}

export function render(V, { hacer, redibujar }) {
  // a la hora del almuerzo (todos salen a las 12) el toque manda a ALMORZAR, salvo que ella escoja "receso" a mano
  const almHora = horaAlmuerzo(); ui.tipo = ui.tipoElegido && ui.tipoElegido.dia === new Date().toDateString() && ui.tipoElegido.alm === almHora ? ui.tipoElegido.tipo : almHora ? "almuerzo" : "receso";
  const admin = S.perfil?.rol === "admin", lim = limiteReceso(), ahoraT = turnoActual();
  const enRec = S.trabajadores.filter((w) => recesoAbierto(w.id));
  const hoy = new Date(), lunes = new Date(hoy); lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
  const desde = ui.periodo === "semana" ? fechaISO(lunes) : fechaISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const acu = acumulado(desde), filasP = S.trabajadores.filter((w) => acu[w.id]).map((w) => ({ w, ...acu[w.id] })).sort((a, b) => b.exceso - a.exceso || b.min - a.min);
  const perdido = filasP.reduce((a, f) => a + f.exceso, 0), totalMin = filasP.reduce((a, f) => a + f.min, 0);
  const excesoHoyTotal = Math.round(S.trabajadores.reduce((a, w) => a + excesoHoy(w.id) + excesoAlmuerzo(w.id), 0));
  const registro = S.recesos.filter((r) => r.fin).slice().reverse().slice(0, 30);

  V.innerHTML = `<h2>Receso</h2>
  <div class="seg seg-ico" role="group" aria-label="Al tocar a alguien" style="margin-bottom:12px"><button data-tipo="receso" aria-pressed="${ui.tipo === "receso"}"><svg class="ico-seg" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M3 21h14"/><path d="M8 3.5c-.8 1 .8 1.8 0 3M12 3.5c-.8 1 .8 1.8 0 3"/></svg>Mandar a receso</button><button data-tipo="almuerzo" class="almuerzo" aria-pressed="${ui.tipo === "almuerzo"}"><svg class="ico-seg" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2 1-3 4-3 7h3"/></svg>Mandar a almorzar</button></div>
  ${almHora && ui.tipo === "almuerzo" ? `<p class="aviso-alm almuerzo">🍽️ Es hora de almuerzo: al tocar a alguien lo manda a <b>almorzar</b>.</p>
    ${S.trabajadores.some((w) => !recesoAbierto(w.id) && !almuerzoHoy(w.id)) ? `<button class="btn big" id="todosAlm" style="margin-bottom:12px">Todos a almorzar</button>` : ""}` : ""}
  ${enRec.length ? `<button class="btn primary big" id="fin" style="margin-bottom:12px">Todos a trabajar</button>` : ""}
  ${corregir() || pregunta()}
  ${(() => { const olv = S.trabajadores.filter((w) => pasadoAbierto(w) >= OLVIDO); return olv.length && !ui.pregunta ? `<div class="pregunta-r olvido" role="status">⏰ <b>${olv.map((w) => esc(w.nombre)).join(", ")}</b> ${olv.length === 1 ? "sigue" : "siguen"} en pausa desde hace rato. Si ya ${olv.length === 1 ? "regresó" : "regresaron"}, tócal${olv.length === 1 ? "o" : "os"} para regresar${olv.length === 1 ? "lo" : "los"} a trabajar.</div>` : ""; })()}
  <div class="grid">${S.trabajadores.map((w) => { const r = recesoAbierto(w.id);
    const exc = Math.round(excesoHoy(w.id) + excesoAlmuerzo(w.id)), olvido = pasadoAbierto(w) >= OLVIDO;
    return `<button class="card receso-card ${r ? "on-break" : ""} ${esAlmuerzo(r) ? "almuerzo" : ""} ${olvido ? "olvido" : ""}" data-w="${w.id}" aria-pressed="${!!r}">
      <span class="fila"><span class="av">${cara(w)}</span><span class="who"><b>${esc(w.nombre)}</b><small>${r ? (esAlmuerzo(r) ? "Almorzando" : "En receso") + (olvido ? " · ¿ya regresó?" : "") : "Trabajando"}</small>${exc >= 1 ? `<span class="sello-exc" data-corregir title="Tocar para corregir la hora de regreso">⏱ +${exc} min ✎</span>` : ""}</span></span>
      ${turno(w, "manana")}${turno(w, "almuerzo")}${turno(w, "tarde")}</button>`; }).join("")}</div>

  <div class="section"><div class="titulo-fila"><p class="eyebrow" style="margin:0">Datos por persona</p>
    <div class="seg mini" role="group" aria-label="Periodo"><button data-periodo="semana" aria-pressed="${ui.periodo === "semana"}">Esta semana</button><button data-periodo="mes" aria-pressed="${ui.periodo === "mes"}">Este mes</button></div></div>
    <div class="stats">
      <div class="stat"><b>${minutos(totalMin * 60000)}</b><span>de receso en total</span></div>
      <div class="stat ${perdido ? "rojo" : "w"}"><b>${minutos(perdido * 60000)}</b><span>tiempo perdido (exceso)</span></div>
      <div class="stat"><b>${filasP.filter((f) => f.exceso > 0).length}</b><span>${filasP.filter((f) => f.exceso > 0).length === 1 ? "persona se pasó" : "personas se pasaron"}</span></div></div>
    <div class="list">${filasP.length ? filasP.map((f) => `<div class="li"><div class="grow"><b>${esc(f.w.nombre)}</b>
        <small>${minutos(f.min * 60000)} de receso en ${f.dias.size} ${f.dias.size === 1 ? "día" : "días"} · promedio ${Math.round(f.min / f.dias.size)} de ${lim * 2} min${f.alm ? ` · almuerzo promedio ${Math.round(f.alm / f.dias.size)} de ${LIMITE_ALMUERZO} min` : ""}</small>
        <div class="bar"><i style="width:${Math.min(100, (f.min / f.dias.size / (lim * 2)) * 100)}%;${f.exceso ? "background:var(--lost)" : ""}"></i></div></div>
        ${f.exceso ? `<span class="pill lost">+${f.exceso} min</span>` : `<span class="pill ok">Al día</span>`}</div>`).join("")
      : `<div class="empty">Aún no hay recesos en ${ui.periodo === "semana" ? "esta semana" : "este mes"}.</div>`}</div>
    <p class="note">“Tiempo perdido” es lo que se pasaron de los ${lim} min de cada receso y de la hora de almuerzo.</p></div>

  <div class="section"><p class="eyebrow">Registro de hoy</p><div class="list">
    ${registro.length ? registro.map((r) => `<div class="li tocable" data-corregir-r="${r.id}" role="button" tabindex="0" title="Tocar para corregir la hora"><div class="grow"><b>${esc(trabajador(r.trabajador_id).nombre)}</b><small>${esAlmuerzo(r) ? "Almuerzo" : NOMBRE_TURNO[turnoDe(r.inicio)]} · ${hhmm(r.inicio)} → ${hhmm(r.fin)}</small></div><span class="num">${dur(ms(r.fin) - ms(r.inicio))}</span><span class="lapiz-c" aria-hidden="true">✎</span></div>`).join("")
      : `<div class="empty">Aquí aparece cada receso terminado, con hora de salida y regreso.</div>`}
  </div>
  ${admin ? (ui.borrar
    ? `<div class="confirm" style="margin-top:10px"><span class="note" style="margin:0">¿Borrar todos los recesos de hoy? No se puede deshacer.</span><button class="btn small danger" id="borrarSi">Sí, borrar</button><button class="btn small" id="borrarNo">No</button></div>`
    : `<div class="acts" style="margin-top:10px"><button class="btn small danger" id="borrar">Borrar registros de hoy</button></div>`) : ""}
  <p class="note">El detalle de cada día se borra solo en la madrugada; quedan guardados los minutos de mañana, tarde, almuerzo y exceso de cada persona.</p></div>`;

  V.querySelectorAll(".receso-card").forEach((b) => (b.onclick = (ev) => {
    const w = trabajador(b.dataset.w), r = recesoAbierto(w.id);
    if (ev.target.closest("[data-corregir]")) { const q = paraCorregir(w.id); if (q) { abrirCorregir(q); redibujar(); return verArriba(); } }
    // si está en pausa, tocarlo SIEMPRE lo regresa a trabajar (si regresó antes, se corrige con ⏱)
    // a la hora del almuerzo, "receso" puede ser almuerzo → preguntar
    if (!r && ui.tipo === "receso" && horaAlmuerzo() && !almuerzoHoy(w.id)) { ui.corrige = null; ui.pregunta = { w: w.id, que: "almuerzo" }; redibujar(); return verArriba(); }
    mandar(w.id, ui.tipo, r && pasadoAbierto(w) >= OLVIDO);
  }));
  function verArriba() { V.querySelector(".pregunta-r")?.scrollIntoView({ block: "center", behavior: "smooth" }); }
  function mandar(wid, tipo = ui.tipo, tarde = false) {
    ui.pregunta = null; ui.corrige = null;
    // La primera vez que mandas a alguien a receso, el celular pide permiso para avisarte cada 5 min mientras siga en receso
    if (!recesoAbierto(wid) && tipo === "receso" && estadoAvisos() === "preguntar") activarAvisos({ saludo: true }).catch(() => {});
    hacer(async () => {
      const r = recesoAbierto(wid), sale = await cambiarReceso(wid, r ? r.tipo || "receso" : tipo);
      return `${trabajador(wid).nombre} ${sale ? (tipo === "almuerzo" ? "almorzando" : "en receso") : "regresó a trabajar" + (tarde ? " · si regresó antes, toca su ⏱ para poner la hora" : "")}`;
    });
  }
  V.querySelectorAll("[data-resp]").forEach((b) => (b.onclick = () => { const p = ui.pregunta; if (!p) return; const w = trabajador(p.w), v = b.dataset.resp;
    if (v === "no") { ui.pregunta = null; return redibujar(); }
    if (v === "almuerzo" || v === "receso") return mandar(p.w, v);
    if (v === "ahora") return mandar(p.w);
    if (v === "otra") { abrirCorregir(recesoAbierto(p.w)); return redibujar(); }
    if (v === "atiempo") { ui.pregunta = null; hacer(async () => { await regresarEn(p.w, finALaHora(w)); return `${w.nombre} regresó a las ${hhmm(new Date(finALaHora(w)).toISOString())}`; }); }
  }));
  V.querySelectorAll("[data-corregir-r]").forEach((e) => (e.onclick = () => { const r = S.recesos.find((x) => String(x.id) === e.dataset.corregirR); if (r) { abrirCorregir(r); redibujar(); V.querySelector(".corrige")?.scrollIntoView({ block: "center", behavior: "smooth" }); } }));
  on2("[data-cancelar-c]", () => { ui.corrige = null; redibujar(); });
  on2("[data-guardar-c]", () => { const c = ui.corrige, r = S.recesos.find((x) => x.id === c.id), w = trabajador(r.trabajador_id);
    const a = V.querySelector("#hIni").value, b = V.querySelector("#hFin").value, err = V.querySelector("#errC");
    const enHoy = (v, base) => { const d = new Date(base); const [h, mi] = v.split(":").map(Number); d.setHours(h, mi, 0, 0); return d.getTime(); };
    if (!a || !b) { err.textContent = "Escribe la hora en que regresó a trabajar."; err.hidden = false; return; }
    const ini = enHoy(a, r.inicio), fin = enHoy(b, r.inicio);
    if (fin <= ini) { err.textContent = "La hora de regreso tiene que ser después de la salida."; err.hidden = false; return; }
    if (fin > Date.now()) { err.textContent = "Esa hora todavía no ha pasado."; err.hidden = false; return; }
    ui.corrige = null; hacer(async () => { await ponerHoras(c.id, ini, fin); return `${w.nombre}: salió ${a}, regresó ${b}`; }); });
  V.querySelectorAll("[data-tipo]").forEach((b) => (b.onclick = () => { ui.tipoElegido = { tipo: b.dataset.tipo, dia: new Date().toDateString(), alm: horaAlmuerzo() }; redibujar(); }));
  on2("#todosAlm", () => hacer(async () => { const ws = S.trabajadores.filter((w) => !recesoAbierto(w.id) && !almuerzoHoy(w.id));
    for (const w of ws) await cambiarReceso(w.id, "almuerzo"); return `${ws.length} a almorzar`; }));
  V.querySelectorAll("[data-periodo]").forEach((b) => (b.onclick = () => { ui.periodo = b.dataset.periodo; redibujar(); }));
  function on2(id, f) { const e = V.querySelector(id); if (e) e.onclick = f; }
  const on = (id, f) => { const e = V.querySelector(id); if (e) e.onclick = f; };
  on("#borrar", () => { ui.borrar = true; redibujar(); });
  on("#borrarNo", () => { ui.borrar = false; redibujar(); });
  on("#borrarSi", () => { ui.borrar = false; hacer(async () => { await borrarRecesosHoy(); return "Registros de hoy borrados"; }); });
  on("#fin", () => hacer(async () => { await terminarReceso("receso"); await terminarReceso("almuerzo"); return "Todos a trabajar"; }));
}
