// Vista "Receso": tarjetas de cada trabajador, resumen de hoy, de la semana y del mes, y registro de hoy.
import { S, recesoAbierto, recesoHoy, cambiarReceso, iniciarReceso, terminarReceso, trabajador, borrarRecesosHoy } from "../datos.js";
import { cara } from "./fotos.js";

const ui = { periodo: "semana", borrar: false };

// Suma minutos del resumen guardado (días anteriores) + lo de hoy, desde una fecha
function acumulado(desde) {
  const tot = {};
  for (const r of S.resumen) if (r.fecha >= desde) { const t = (tot[r.trabajador_id] ||= { min: 0, n: 0, dias: new Set() }); t.min += r.minutos; t.n += r.cantidad; t.dias.add(r.fecha); }
  for (const w of S.trabajadores) { const m = Math.round(recesoHoy(w.id) / 60000); if (m > 0) { const t = (tot[w.id] ||= { min: 0, n: 0, dias: new Set() }); t.min += m; t.n += S.recesos.filter((r) => r.trabajador_id === w.id).length; t.dias.add("hoy"); } }
  return tot;
}
const fechaISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
import { esc, iniciales, minutos, dur, hhmm, ms, esHoy } from "../util.js";

export function render(V, { hacer, redibujar }) {
  const admin = S.perfil?.rol === "admin";
  const hoy = new Date(), lunes = new Date(hoy); lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
  const desde = ui.periodo === "semana" ? fechaISO(lunes) : fechaISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const acu = acumulado(desde), filasP = S.trabajadores.filter((w) => acu[w.id]).map((w) => ({ w, ...acu[w.id] })).sort((a, b) => b.min - a.min);
  const maxP = Math.max(1, ...filasP.map((f) => f.min));
  const filas = S.trabajadores.map((w) => ({
    w, t: recesoHoy(w.id),
    n: S.recesos.filter((r) => r.trabajador_id === w.id && (esHoy(r.inicio) || !r.fin)).length,
  })).filter((f) => f.t > 0).sort((a, b) => b.t - a.t);
  const max = Math.max(1, ...filas.map((f) => f.t));
  const registro = S.recesos.filter((r) => r.fin).slice().reverse().slice(0, 20);

  V.innerHTML = `<p class="eyebrow">Tiempos de receso</p><h2>Receso</h2>
  <p class="lead">Naranja es receso, verde es trabajando. Cada toque cambia el estado y el tiempo queda guardado.</p>
  ${S.sesion
    ? `<div class="session"><div><div class="lbl">Receso abierto desde ${hhmm(S.sesion.inicio)}</div><div class="t" data-desde="${ms(S.sesion.inicio)}"></div></div><button class="btn primary" id="fin">Terminar receso</button></div>`
    : `<button class="btn break big" id="ini" style="margin-bottom:14px">Iniciar receso</button>`}
  <div class="grid">${S.trabajadores.map((w) => {
    const r = recesoAbierto(w.id);
    return `<button class="card ${r ? "on-break" : ""}" data-w="${w.id}" ${S.sesion ? "" : "disabled"} aria-pressed="${!!r}">
      <span class="av">${cara(w)}</span><span class="who"><b>${esc(w.nombre)}</b><small>${esc(w.puesto || "")}</small>
      <span class="st">${r ? `<span data-desde="${ms(r.inicio)}"></span> en receso` : `Trabajando · hoy ${minutos(recesoHoy(w.id))}`}</span></span></button>`;
  }).join("")}</div>
  <div class="section"><p class="eyebrow">Resumen de hoy</p><div class="list">
    ${filas.length ? filas.map((f) => `<div class="li"><div class="grow"><b>${esc(f.w.nombre)}</b><small>${f.n} ${f.n === 1 ? "receso" : "recesos"}</small><div class="bar"><i style="width:${(f.t / max) * 100}%"></i></div></div><span class="num">${minutos(f.t)}</span></div>`).join("")
      : `<div class="empty">Todavía no hay recesos hoy.</div>`}
  </div></div>
  <div class="section"><p class="eyebrow">Registro de hoy</p><div class="list">
    ${registro.length ? registro.map((r) => `<div class="li"><div class="grow"><b>${esc(trabajador(r.trabajador_id).nombre)}</b><small>${hhmm(r.inicio)} → ${hhmm(r.fin)}</small></div><span class="num">${dur(ms(r.fin) - ms(r.inicio))}</span></div>`).join("")
      : `<div class="empty">Aquí aparece cada receso terminado, con hora de salida y regreso.</div>`}
  </div>
  ${admin ? (ui.borrar
    ? `<div class="confirm" style="margin-top:10px"><span class="note" style="margin:0">¿Borrar todos los recesos de hoy? No se puede deshacer.</span><button class="btn small danger" id="borrarSi">Sí, borrar</button><button class="btn small" id="borrarNo">No</button></div>`
    : `<button class="btn small danger" id="borrar" style="margin-top:10px">Borrar registros de hoy</button>`) : ""}
  <p class="note">El detalle de cada día se borra solo en la madrugada y queda guardado el total de minutos de cada persona.</p></div>
  <div class="section"><div class="titulo-fila"><p class="eyebrow" style="margin:0">Total por persona</p>
    <div class="seg mini" role="group" aria-label="Periodo"><button data-periodo="semana" aria-pressed="${ui.periodo === "semana"}">Esta semana</button><button data-periodo="mes" aria-pressed="${ui.periodo === "mes"}">Este mes</button></div></div>
    <div class="list">${filasP.length ? filasP.map((f) => `<div class="li"><div class="grow"><b>${esc(f.w.nombre)}</b><small>${f.n} ${f.n === 1 ? "receso" : "recesos"} en ${f.dias.size} ${f.dias.size === 1 ? "día" : "días"} · promedio ${Math.round(f.min / f.dias.size)} min al día</small><div class="bar"><i style="width:${(f.min / maxP) * 100}%"></i></div></div><span class="num">${minutos(f.min * 60000)}</span></div>`).join("")
      : `<div class="empty">Aún no hay recesos en ${ui.periodo === "semana" ? "esta semana" : "este mes"}.</div>`}</div></div>`;

  V.querySelectorAll(".card").forEach((b) => (b.onclick = () => hacer(async () => {
    const sale = await cambiarReceso(b.dataset.w);
    return `${trabajador(b.dataset.w).nombre} ${sale ? "en receso" : "regresó a trabajar"}`;
  })));
  const ini = V.querySelector("#ini"); if (ini) ini.onclick = () => hacer(async () => { await iniciarReceso(); return "Receso iniciado"; });
  V.querySelectorAll("[data-periodo]").forEach((b) => (b.onclick = () => { ui.periodo = b.dataset.periodo; redibujar(); }));
  const bo = V.querySelector("#borrar"); if (bo) bo.onclick = () => { ui.borrar = true; redibujar(); };
  const bn = V.querySelector("#borrarNo"); if (bn) bn.onclick = () => { ui.borrar = false; redibujar(); };
  const bs = V.querySelector("#borrarSi"); if (bs) bs.onclick = () => { ui.borrar = false; hacer(async () => { await borrarRecesosHoy(); return "Registros de hoy borrados"; }); };
  const fin = V.querySelector("#fin"); if (fin) fin.onclick = () => hacer(async () => { await terminarReceso(); return "Receso cerrado, todos a trabajar"; });
}
