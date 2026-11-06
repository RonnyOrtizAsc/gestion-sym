// Vista "Receso": dos turnos por día (mañana y tarde) con su límite de minutos.
// Cada turno suma todos los pedazos de receso; si alguien se pasa, se marca en rojo y cuenta como tiempo perdido.
import { S, recesoAbierto, cambiarReceso, terminarReceso, trabajador, borrarRecesosHoy,
  limiteReceso, turnoDe, turnoActual, recesoTurno, excesoHoy, esAlmuerzo, almuerzoHoy, excesoAlmuerzo, LIMITE_ALMUERZO, enReceso } from "../datos.js";
import { cara } from "./fotos.js";
import { esc, minutos, dur, hhmm, ms } from "../util.js";

const ui = { periodo: "semana", borrar: false, tipo: "receso" };   // tipo: qué hace un toque (receso o almuerzo)
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

export function render(V, { hacer, redibujar }) {
  const admin = S.perfil?.rol === "admin", lim = limiteReceso(), ahoraT = turnoActual();
  const enRec = S.trabajadores.filter((w) => recesoAbierto(w.id));
  const hoy = new Date(), lunes = new Date(hoy); lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
  const desde = ui.periodo === "semana" ? fechaISO(lunes) : fechaISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const acu = acumulado(desde), filasP = S.trabajadores.filter((w) => acu[w.id]).map((w) => ({ w, ...acu[w.id] })).sort((a, b) => b.exceso - a.exceso || b.min - a.min);
  const perdido = filasP.reduce((a, f) => a + f.exceso, 0), totalMin = filasP.reduce((a, f) => a + f.min, 0);
  const excesoHoyTotal = Math.round(S.trabajadores.reduce((a, w) => a + excesoHoy(w.id) + excesoAlmuerzo(w.id), 0));
  const registro = S.recesos.filter((r) => r.fin).slice().reverse().slice(0, 30);

  V.innerHTML = `<p class="eyebrow">Tiempos · receso ${lim} min mañana y ${lim} min tarde · almuerzo ${LIMITE_ALMUERZO} min</p><h2>Receso</h2>
  <p class="lead">Toca a cualquiera para mandarlo o regresarlo. Si lo toma en varios pedazos, se van sumando.</p>
  <div class="seg" role="group" aria-label="Al tocar a alguien" style="margin-bottom:12px"><button data-tipo="receso" aria-pressed="${ui.tipo === "receso"}">Mandar a receso</button><button data-tipo="almuerzo" aria-pressed="${ui.tipo === "almuerzo"}">Mandar a almorzar</button></div>
  <div class="stats">
    <div class="stat b"><b>${enRec.length}</b><span>${enRec.some((w) => esAlmuerzo(recesoAbierto(w.id))) ? "en pausa ahora" : "en receso ahora"}</span></div>
    <div class="stat"><b>${NOMBRE_TURNO[ahoraT]}</b><span>turno actual</span></div>
    <div class="stat ${excesoHoyTotal ? "rojo" : "w"}"><b>${excesoHoyTotal} min</b><span>excedidos hoy</span></div></div>
  ${enRec.length ? `<button class="btn primary big" id="fin" style="margin-bottom:12px">Todos a trabajar</button>` : ""}
  <div class="grid">${S.trabajadores.map((w) => { const r = recesoAbierto(w.id);
    return `<button class="card receso-card ${r ? "on-break" : ""} ${esAlmuerzo(r) ? "almuerzo" : ""} ${excesoHoy(w.id) + excesoAlmuerzo(w.id) >= 1 ? "con-exceso" : ""}" data-w="${w.id}" aria-pressed="${!!r}">
      <span class="fila"><span class="av">${cara(w)}</span><span class="who"><b>${esc(w.nombre)}</b><small>${r ? (esAlmuerzo(r) ? "Almorzando" : "En receso") : "Trabajando"}</small></span></span>
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
    ${registro.length ? registro.map((r) => `<div class="li"><div class="grow"><b>${esc(trabajador(r.trabajador_id).nombre)}</b><small>${esAlmuerzo(r) ? "Almuerzo" : NOMBRE_TURNO[turnoDe(r.inicio)]} · ${hhmm(r.inicio)} → ${hhmm(r.fin)}</small></div><span class="num">${dur(ms(r.fin) - ms(r.inicio))}</span></div>`).join("")
      : `<div class="empty">Aquí aparece cada receso terminado, con hora de salida y regreso.</div>`}
  </div>
  ${admin ? (ui.borrar
    ? `<div class="confirm" style="margin-top:10px"><span class="note" style="margin:0">¿Borrar todos los recesos de hoy? No se puede deshacer.</span><button class="btn small danger" id="borrarSi">Sí, borrar</button><button class="btn small" id="borrarNo">No</button></div>`
    : `<div class="acts" style="margin-top:10px"><button class="btn small danger" id="borrar">Borrar registros de hoy</button></div>`) : ""}
  <p class="note">El detalle de cada día se borra solo en la madrugada; quedan guardados los minutos de mañana, tarde, almuerzo y exceso de cada persona.</p></div>`;

  V.querySelectorAll(".receso-card").forEach((b) => (b.onclick = () => hacer(async () => {
    const r = recesoAbierto(b.dataset.w), sale = await cambiarReceso(b.dataset.w, r ? r.tipo || "receso" : ui.tipo);
    return `${trabajador(b.dataset.w).nombre} ${sale ? (ui.tipo === "almuerzo" ? "almorzando" : "en receso") : "regresó a trabajar"}`;
  })));
  V.querySelectorAll("[data-tipo]").forEach((b) => (b.onclick = () => { ui.tipo = b.dataset.tipo; redibujar(); }));
  V.querySelectorAll("[data-periodo]").forEach((b) => (b.onclick = () => { ui.periodo = b.dataset.periodo; redibujar(); }));
  const on = (id, f) => { const e = V.querySelector(id); if (e) e.onclick = f; };
  on("#borrar", () => { ui.borrar = true; redibujar(); });
  on("#borrarNo", () => { ui.borrar = false; redibujar(); });
  on("#borrarSi", () => { ui.borrar = false; hacer(async () => { await borrarRecesosHoy(); return "Registros de hoy borrados"; }); });
  on("#fin", () => hacer(async () => { await terminarReceso("receso"); await terminarReceso("almuerzo"); return "Todos a trabajar"; }));
}
