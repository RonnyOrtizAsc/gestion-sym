// Vista "Obra": plano en vivo con cada trabajador en su zona.
import { S, recesoAbierto, enReceso, prestamosActivos, disponibles, cambiarReceso, iniciarReceso, terminarReceso, trabajador } from "../datos.js";
import { esc, iniciales, primerNombre, ms } from "../util.js";

export function resumen() {
  const nb = enReceso().length, nl = prestamosActivos().reduce((a, p) => a + p.cantidad, 0);
  return `<div class="stats">
    <div class="stat w"><b>${S.trabajadores.length - nb}</b><span>trabajando</span></div>
    <div class="stat b"><b>${nb}</b><span>en receso</span></div>
    <div class="stat"><b>${nl}</b><span>herramientas prestadas</span></div></div>`;
}

export function render(V, { hacer, caminando }) {
  const conHerr = {};
  prestamosActivos().forEach((p) => (conHerr[p.trabajador_id] = (conHerr[p.trabajador_id] || 0) + p.cantidad));
  const trabajando = S.trabajadores.filter((w) => !recesoAbierto(w.id));
  const descansando = S.trabajadores.filter((w) => recesoAbierto(w.id));
  const pos = {};
  // Área de trabajo: 3 columnas; zona de receso: 2 columnas
  trabajando.forEach((w, i) => { const c = i % 3, f = Math.floor(i / 3); pos[w.id] = [3 + 60 * (0.2 + c * 0.3), 4 + 92 * (0.13 + f * (0.8 / Math.max(3, Math.ceil(trabajando.length / 3))))]; });
  descansando.forEach((w, i) => { const c = i % 2, f = Math.floor(i / 2); pos[w.id] = [66 + 31 * (0.3 + c * 0.42), 4 + 50 * (0.3 + f * (0.62 / Math.max(2, Math.ceil(descansando.length / 2))))]; });
  const libres = S.herramientas.reduce((a, h) => a + Math.max(0, disponibles(h)), 0);
  const total = S.herramientas.reduce((a, h) => a + h.cantidad, 0);

  V.innerHTML = `<p class="eyebrow">Vista en vivo</p><h2>¿Quién está dónde?</h2>
  <p class="lead">${S.sesion ? "Receso abierto: toca a un trabajador para mandarlo a descansar o devolverlo a la obra." : "Toca “Iniciar receso” y luego toca a cada trabajador que sale a descansar."}</p>
  ${resumen()}
  <div class="site">
    <div class="zone work"><span class="zl">Área de trabajo</span></div>
    <div class="zone rest"><span class="zl">Zona de receso</span></div>
    <div class="zone store"><span class="zl">Bodega</span><div class="inv"><b>${libres}/${total}</b>herramientas disponibles</div></div>
    ${S.trabajadores.map((w) => {
      const [x, y] = pos[w.id], r = recesoAbierto(w.id);
      return `<button class="tok ${r ? "on-break" : ""} ${caminando.has(w.id) ? "walking" : ""}" data-w="${w.id}" style="left:${x}%;top:${y}%" aria-label="${esc(w.nombre)}, ${r ? "en receso" : "trabajando"}">
        ${r ? `<span class="bub" data-desde="${ms(r.inicio)}"></span>` : ""}
        <span class="av">${esc(iniciales(w.nombre))}</span>${conHerr[w.id] ? `<span class="tl" title="Herramientas prestadas">${conHerr[w.id]}</span>` : ""}
        <span class="nm">${esc(primerNombre(w.nombre))}</span></button>`;
    }).join("")}
  </div>
  <div class="legend"><span><i class="dot" style="background:var(--work)"></i>Trabajando</span><span><i class="dot" style="background:var(--break)"></i>En receso, con su tiempo</span><span><i class="dot" style="background:var(--ink)"></i>Número: herramientas que tiene</span></div>
  <div class="section">${S.sesion
    ? `<button class="btn primary big" id="fin">Terminar receso (todos a trabajar)</button>`
    : `<button class="btn break big" id="ini">Iniciar receso</button>`}</div>`;

  V.querySelectorAll(".tok").forEach((b) => (b.onclick = () => {
    const id = b.dataset.w;
    hacer(async () => { caminando.add(id); setTimeout(() => caminando.delete(id), 1200);
      const sale = await cambiarReceso(id); return `${trabajador(id).nombre} ${sale ? "en receso" : "regresó a trabajar"}`; });
  }));
  const ini = V.querySelector("#ini"); if (ini) ini.onclick = () => hacer(async () => { await iniciarReceso(); return "Receso iniciado: toca a quien sale a descansar"; });
  const fin = V.querySelector("#fin"); if (fin) fin.onclick = () => hacer(async () => { await terminarReceso(); return "Receso cerrado, todos a trabajar"; });
}
