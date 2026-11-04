// Vista "Recesos": tarjetas de cada trabajador, resumen y registro de hoy.
import { S, recesoAbierto, recesoHoy, cambiarReceso, iniciarReceso, terminarReceso, trabajador } from "../datos.js";
import { esc, iniciales, minutos, dur, hhmm, ms, esHoy } from "../util.js";

export function render(V, { hacer }) {
  const filas = S.trabajadores.map((w) => ({
    w, t: recesoHoy(w.id),
    n: S.recesos.filter((r) => r.trabajador_id === w.id && (esHoy(r.inicio) || !r.fin)).length,
  })).filter((f) => f.t > 0).sort((a, b) => b.t - a.t);
  const max = Math.max(1, ...filas.map((f) => f.t));
  const registro = S.recesos.filter((r) => r.fin).slice().reverse().slice(0, 20);

  V.innerHTML = `<p class="eyebrow">Tiempos de receso</p><h2>Recesos</h2>
  <p class="lead">Naranja es receso, verde es trabajando. Cada toque cambia el estado y el tiempo queda guardado.</p>
  ${S.sesion
    ? `<div class="session"><div><div class="lbl">Receso abierto desde ${hhmm(S.sesion.inicio)}</div><div class="t" data-desde="${ms(S.sesion.inicio)}"></div></div><button class="btn primary" id="fin">Terminar receso</button></div>`
    : `<button class="btn break big" id="ini" style="margin-bottom:14px">Iniciar receso</button>`}
  <div class="grid">${S.trabajadores.map((w) => {
    const r = recesoAbierto(w.id);
    return `<button class="card ${r ? "on-break" : ""}" data-w="${w.id}" ${S.sesion ? "" : "disabled"} aria-pressed="${!!r}">
      <span class="av">${esc(iniciales(w.nombre))}</span><span class="who"><b>${esc(w.nombre)}</b><small>${esc(w.puesto || "")}</small>
      <span class="st">${r ? `<span data-desde="${ms(r.inicio)}"></span> en receso` : `Trabajando · hoy ${minutos(recesoHoy(w.id))}`}</span></span></button>`;
  }).join("")}</div>
  <div class="section"><p class="eyebrow">Resumen de hoy</p><div class="list">
    ${filas.length ? filas.map((f) => `<div class="li"><div class="grow"><b>${esc(f.w.nombre)}</b><small>${f.n} ${f.n === 1 ? "receso" : "recesos"}</small><div class="bar"><i style="width:${(f.t / max) * 100}%"></i></div></div><span class="num">${minutos(f.t)}</span></div>`).join("")
      : `<div class="empty">Todavía no hay recesos hoy.</div>`}
  </div></div>
  <div class="section"><p class="eyebrow">Registro de hoy</p><div class="list">
    ${registro.length ? registro.map((r) => `<div class="li"><div class="grow"><b>${esc(trabajador(r.trabajador_id).nombre)}</b><small>${hhmm(r.inicio)} → ${hhmm(r.fin)}</small></div><span class="num">${dur(ms(r.fin) - ms(r.inicio))}</span></div>`).join("")
      : `<div class="empty">Aquí aparece cada receso terminado, con hora de salida y regreso.</div>`}
  </div></div>`;

  V.querySelectorAll(".card").forEach((b) => (b.onclick = () => hacer(async () => {
    const sale = await cambiarReceso(b.dataset.w);
    return `${trabajador(b.dataset.w).nombre} ${sale ? "en receso" : "regresó a trabajar"}`;
  })));
  const ini = V.querySelector("#ini"); if (ini) ini.onclick = () => hacer(async () => { await iniciarReceso(); return "Receso iniciado"; });
  const fin = V.querySelector("#fin"); if (fin) fin.onclick = () => hacer(async () => { await terminarReceso(); return "Receso cerrado, todos a trabajar"; });
}
