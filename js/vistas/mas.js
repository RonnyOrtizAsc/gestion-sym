// Vista "Más": planificador, trabajadores, usuarios (admin) y cuenta.
import { S, agregarTrabajador, editarTrabajador, editarPerfil, sb } from "../datos.js";
import { esc } from "../util.js";
import { PLANIFICADOR_URL } from "../config.js";

const ui = { editando: null, quitar: null };

export function render(V, { hacer, redibujar }) {
  const admin = S.perfil?.rol === "admin";
  const pendientes = S.perfiles.filter((p) => !p.aprobado);

  V.innerHTML = `<p class="eyebrow">Empresa</p><h2>Más</h2>
  <div class="step"><h3>Planificador de obra</h3><p class="note" style="margin-top:0">Tu planificador sigue funcionando aparte. Más adelante quedará dentro de Gestión SYM.</p>
    <a class="btn primary" href="${PLANIFICADOR_URL}" target="_blank" rel="noopener">Abrir planificador</a></div>

  <div class="section"><p class="eyebrow">Trabajadores (${S.trabajadores.length})</p><div class="list">
    ${S.trabajadores.map((w) => ui.editando === w.id
      ? `<form class="li" data-form="${w.id}"><div class="grow">
          <div class="field"><label for="n-${w.id}">Nombre</label><input id="n-${w.id}" value="${esc(w.nombre)}" required></div>
          <div class="field"><label for="p-${w.id}">Puesto</label><input id="p-${w.id}" value="${esc(w.puesto || "")}"></div>
          <div class="field"><label for="h-${w.id}">Habilidades (separadas por coma)</label><input id="h-${w.id}" value="${esc((w.habilidades || []).join(", "))}" placeholder="Ej. repello, armado de hierro, soldadura"></div>
          <div class="acts"><button class="btn small primary">Guardar</button><button type="button" class="btn small" data-cancelar>Cancelar</button>
          ${ui.quitar === w.id ? `<button type="button" class="btn small danger" data-quitar-si="${w.id}">Sí, quitar de la lista</button>` : `<button type="button" class="btn small danger" data-quitar="${w.id}">Quitar</button>`}</div></div></form>`
      : `<div class="li"><div class="grow"><b>${esc(w.nombre)}</b><small>${esc(w.puesto || "Sin puesto")}${(w.habilidades || []).length ? " · " + esc(w.habilidades.join(", ")) : ""}</small></div><button class="btn small" data-editar="${w.id}">Editar</button></div>`).join("")}
  </div>
  <div class="step section"><h3>Agregar trabajador</h3><form class="addrow" id="addW">
    <input id="wn" placeholder="Nombre" aria-label="Nombre" required><input id="wp" placeholder="Puesto" aria-label="Puesto">
    <button class="btn primary">Agregar</button></form></div></div>

  ${admin ? `<div class="section"><p class="eyebrow">Usuarios de la app</p><div class="list">
    ${S.perfiles.map((p) => `<div class="li"><div class="grow"><b>${esc(p.nombre || p.email)}</b><small>@${esc(p.usuario || "")} · ${esc(p.email || "")} · ${p.rol === "admin" ? "Administrador" : "Encargado"}</small></div>
      ${p.id === S.perfil.id ? `<span class="pill ok">Tú</span>`
        : p.aprobado ? `<span class="pill ok">Con acceso</span><button class="btn small danger" data-revocar="${p.id}">Quitar acceso</button>`
        : `<span class="pill out">Esperando</span><button class="btn small primary" data-aprobar="${p.id}">Dar acceso</button>`}</div>`).join("")}
  </div><p class="note">${pendientes.length ? `Hay ${pendientes.length} persona(s) esperando acceso.` : "Para sumar un encargado: que abra la app, toque “Crear cuenta” y luego tú le das acceso aquí."}</p></div>` : ""}

  <div class="section"><p class="eyebrow">Tu cuenta</p><div class="list"><div class="li"><div class="grow"><b>${esc(S.perfil?.nombre || "")}</b><small>Usuario: ${esc(S.perfil?.usuario || "")} · ${esc(S.usuario?.email || "")}</small></div><button class="btn small" id="salir">Cerrar sesión</button></div></div>
  <p class="note">Para instalarla en el celular: en Chrome toca ⋮ → “Agregar a pantalla de inicio”; en iPhone, en Safari toca Compartir → “Agregar a inicio”.</p></div>`;

  const $$ = (s) => V.querySelectorAll(s);
  $$("[data-editar]").forEach((b) => (b.onclick = () => { ui.editando = b.dataset.editar; ui.quitar = null; redibujar(); }));
  $$("[data-cancelar]").forEach((b) => (b.onclick = () => { ui.editando = null; ui.quitar = null; redibujar(); }));
  $$("[data-quitar]").forEach((b) => (b.onclick = () => { ui.quitar = b.dataset.quitar; redibujar(); }));
  $$("[data-quitar-si]").forEach((b) => (b.onclick = () => hacer(async () => { await editarTrabajador(b.dataset.quitarSi, { activo: false }); ui.editando = null; return "Quitado de la lista"; })));
  $$("[data-form]").forEach((f) => (f.onsubmit = (e) => { e.preventDefault(); const id = f.dataset.form;
    const cambios = { nombre: V.querySelector(`#n-${id}`).value.trim(), puesto: V.querySelector(`#p-${id}`).value.trim(),
      habilidades: V.querySelector(`#h-${id}`).value.split(",").map((s) => s.trim()).filter(Boolean) };
    hacer(async () => { await editarTrabajador(id, cambios); ui.editando = null; return "Guardado"; });
  }));
  V.querySelector("#addW").onsubmit = (e) => { e.preventDefault();
    const n = V.querySelector("#wn").value.trim(), p = V.querySelector("#wp").value.trim();
    if (n) hacer(async () => { await agregarTrabajador(n, p, []); return `${n} agregado`; });
  };
  $$("[data-aprobar]").forEach((b) => (b.onclick = () => hacer(async () => { await editarPerfil(b.dataset.aprobar, { aprobado: true }); return "Acceso dado"; })));
  $$("[data-revocar]").forEach((b) => (b.onclick = () => hacer(async () => { await editarPerfil(b.dataset.revocar, { aprobado: false }); return "Acceso quitado"; })));
  V.querySelector("#salir").onclick = () => sb.auth.signOut();
}
