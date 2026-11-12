// Vista "Anticipos": efectivo que se adelanta a un trabajador (5, 10 dólares…) y que se resta de su pago.
// La app no calcula el pago: solo dice cuánto hay que descontarle a cada quien.
// Al pagar, "Ya lo desconté" deja esos anticipos en el historial y la cuenta vuelve a cero.
import { S, trabajador, anticiposPendientes, debeAnticipo, darAnticipo, descontarAnticipos, deshacerDescuento, borrarAnticipo } from "../datos.js";
import { cara, avatares } from "./fotos.js";
import { esc, primerNombre, hhmm, fecha } from "../util.js";

const RAPIDOS = [5, 10, 15, 20];
const ui = { w: null, monto: "", nota: "", abierto: null, confirmar: null, borrar: null, historial: false };
const dinero = (n) => "$" + (+n).toLocaleString("es-SV", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function render(V, { hacer, redibujar }) {
  const admin = S.perfil?.rol === "admin";
  const pendientes = anticiposPendientes(), total = pendientes.reduce((s, x) => s + +x.monto, 0);
  const deudores = [...new Set(pendientes.map((x) => x.trabajador_id))].map((id) => ({ id, w: trabajador(id), debe: debeAnticipo(id), lista: anticiposPendientes(id) }))
    .sort((a, b) => b.debe - a.debe);
  const monto = parseFloat(ui.monto), listo = ui.w && monto > 0;

  // Historial: un renglón por cada vez que se descontó a alguien
  const grupos = {};
  S.anticipos.filter((x) => x.descontado_en).forEach((x) => { const k = x.trabajador_id + "|" + x.descontado_en;
    (grupos[k] ||= { wid: x.trabajador_id, en: x.descontado_en, total: 0, n: 0 }); grupos[k].total += +x.monto; grupos[k].n++; });
  const historial = Object.values(grupos).sort((a, b) => (a.en < b.en ? 1 : -1));

  V.innerHTML = `<div class="ant">
  <div class="ant-hero"><p class="ant-marca">Servicios y Más · Efectivo</p><h2>Anticipos</h2>
    <div class="ant-total"><span>Por descontar en pagos</span><b>${dinero(total)}</b>
      <small>${deudores.length ? `${deudores.length} ${deudores.length === 1 ? "persona debe" : "personas deben"}` : "Nadie debe nada"}</small></div></div>

  <div class="step ant-dar"><h3>Dar anticipo</h3>
    <p class="note" style="margin:0 0 6px">¿A quién?</p>
    ${avatares(S.trabajadores, { attr: "data-aw", seleccionado: ui.w })}
    <p class="note" style="margin:12px 0 6px">¿Cuánto?</p>
    <div class="chips">${RAPIDOS.map((m) => `<button class="chip" data-rapido="${m}" aria-pressed="${monto === m}">$${m}</button>`).join("")}</div>
    <form class="addrow" id="fAnt">
      <input id="aMonto" type="number" inputmode="decimal" step="0.01" min="0.01" placeholder="Otro monto" value="${esc(ui.monto)}" aria-label="Monto en dólares" style="flex:0 0 120px">
      <input id="aNota" placeholder="Nota (opcional)" value="${esc(ui.nota)}" maxlength="80" aria-label="Nota" autocomplete="off">
      <button class="btn primary ant-btn" id="aOk" style="flex:1 1 100%" ${listo ? "" : "disabled"}>${listo ? `Anotar ${dinero(monto)} a ${esc(primerNombre(trabajador(ui.w).nombre))}` : "Anotar anticipo"}</button>
    </form>
    <p class="note" id="aDebe" style="margin:8px 0 0" ${ui.w && debeAnticipo(ui.w) ? "" : "hidden"}>${ui.w && debeAnticipo(ui.w) ? `${esc(primerNombre(trabajador(ui.w).nombre))} ya debe ${dinero(debeAnticipo(ui.w))}.` : ""}</p>
  </div>

  <div class="section"><p class="eyebrow">Por descontar en el pago</p><div class="list ant-lista">
    ${deudores.length ? deudores.map(({ id, w, debe, lista }) => `
      <div class="li ant-fila" data-abrir="${id}" role="button" aria-expanded="${ui.abierto === id}">
        <span class="avatar chico">${cara(w)}</span>
        <div class="grow"><b>${esc(w.nombre)}</b><small>${lista.length} anticipo${lista.length > 1 ? "s" : ""} · desde ${fecha(lista.map((x) => x.dado_en).sort()[0])}</small></div>
        <b class="ant-monto">−${dinero(debe)}</b></div>
      ${ui.abierto === id ? `<div class="ant-detalle">
        ${lista.map((x) => `<div class="ant-item ant-vale"><span>${fecha(x.dado_en)} · ${hhmm(x.dado_en)}${x.nota ? ` · ${esc(x.nota)}` : ""}</span><b>${dinero(x.monto)}</b>
          ${admin || x.registrado_por === S.usuario?.id ? ui.borrar === x.id
            ? `<span class="acts"><button class="btn small danger" data-borrar-si="${x.id}">Sí, borrar</button><button class="btn small" data-borrar-no>No</button></span>`
            : `<button class="linkbtn" data-borrar="${x.id}">Borrar</button>` : ""}</div>`).join("")}
        <div class="acts" style="margin-top:10px">${ui.confirmar === id
          ? `<button class="btn primary ant-btn" data-descontar-si="${id}">Sí, ya le desconté ${dinero(debe)}</button><button class="btn" data-descontar-no>No</button>`
          : `<button class="btn ant-btn-sec" data-descontar="${id}">Ya lo desconté del pago</button>`}</div>
      </div>` : ""}`).join("")
      : `<div class="empty">Nadie tiene anticipos pendientes.</div>`}
  </div></div>

  ${historial.length ? `<div class="section"><button class="linkbtn" id="verHist">${ui.historial ? "Ocultar ya descontados ▴" : `Ya descontados (${historial.length}) ▾`}</button>
    ${ui.historial ? `<div class="list" style="margin-top:8px">${historial.map((g) => `<div class="li"><span class="avatar chico">${cara(trabajador(g.wid))}</span>
      <div class="grow"><b>${esc(trabajador(g.wid).nombre)}</b><small>Descontado el ${fecha(g.en)} · ${g.n} anticipo${g.n > 1 ? "s" : ""}</small></div>
      <b class="ant-monto pagado">${dinero(g.total)} ✓</b><button class="linkbtn" data-deshacer="${g.wid}|${g.en}">Deshacer</button></div>`).join("")}</div>` : ""}</div>` : ""}
  </div>`;

  // ---- Interacción ----
  const $$ = (s) => V.querySelectorAll(s);
  const iM = V.querySelector("#aMonto"), iN = V.querySelector("#aNota"), ok = V.querySelector("#aOk");
  const refrescarBoton = () => { const m = parseFloat(ui.monto), si = ui.w && m > 0; ok.disabled = !si;
    ok.textContent = si ? `Anotar ${dinero(m)} a ${primerNombre(trabajador(ui.w).nombre)}` : "Anotar anticipo";
    $$("[data-rapido]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.rapido === m))); };
  $$("[data-aw]").forEach((b) => (b.onclick = () => { ui.w = ui.w === b.dataset.aw ? null : b.dataset.aw;
    $$("[data-aw]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.aw === ui.w)));
    const n = V.querySelector("#aDebe"), d = ui.w && debeAnticipo(ui.w);
    n.hidden = !d; n.textContent = d ? `${primerNombre(trabajador(ui.w).nombre)} ya debe ${dinero(d)}.` : "";
    refrescarBoton(); }));
  $$("[data-rapido]").forEach((b) => (b.onclick = () => { ui.monto = b.dataset.rapido; iM.value = ui.monto; refrescarBoton(); }));
  iM.oninput = () => { ui.monto = iM.value; refrescarBoton(); };
  iN.oninput = () => { ui.nota = iN.value; };
  V.querySelector("#fAnt").onsubmit = (e) => { e.preventDefault();
    const wid = ui.w, m = Math.round(parseFloat(ui.monto) * 100) / 100, nota = ui.nota; if (!wid || !(m > 0)) return;
    ui.monto = ""; ui.nota = ""; ui.w = null;
    hacer(async () => { await darAnticipo(wid, m, nota); return `${dinero(m)} a ${primerNombre(trabajador(wid).nombre)} · debe ${dinero(debeAnticipo(wid) + m)}`; }); };
  $$("[data-abrir]").forEach((f) => (f.onclick = () => { ui.abierto = ui.abierto === f.dataset.abrir ? null : f.dataset.abrir; ui.confirmar = null; ui.borrar = null; redibujar(); }));
  $$("[data-descontar]").forEach((b) => (b.onclick = () => { ui.confirmar = b.dataset.descontar; redibujar(); }));
  $$("[data-descontar-no]").forEach((b) => (b.onclick = () => { ui.confirmar = null; redibujar(); }));
  $$("[data-descontar-si]").forEach((b) => (b.onclick = () => { const wid = b.dataset.descontarSi, d = debeAnticipo(wid); ui.confirmar = null; ui.abierto = null;
    hacer(async () => { await descontarAnticipos(wid); return `${primerNombre(trabajador(wid).nombre)}: ${dinero(d)} descontado`; }); }));
  $$("[data-borrar]").forEach((b) => (b.onclick = () => { ui.borrar = b.dataset.borrar; redibujar(); }));
  $$("[data-borrar-no]").forEach((b) => (b.onclick = () => { ui.borrar = null; redibujar(); }));
  $$("[data-borrar-si]").forEach((b) => (b.onclick = () => { const id = b.dataset.borrarSi; ui.borrar = null;
    hacer(async () => { await borrarAnticipo(id); return "Anticipo borrado"; }); }));
  const vh = V.querySelector("#verHist"); if (vh) vh.onclick = () => { ui.historial = !ui.historial; redibujar(); };
  $$("[data-deshacer]").forEach((b) => (b.onclick = () => { const [wid, en] = b.dataset.deshacer.split("|");
    hacer(async () => { await deshacerDescuento(wid, en); return `${primerNombre(trabajador(wid).nombre)}: anticipos pendientes otra vez`; }); }));
}
