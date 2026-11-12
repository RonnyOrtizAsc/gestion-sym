// Gestión SYM: arranque, ingreso, navegación y tiempo real.
import { sb, S, cargarPerfil, cargarTodo, enReceso, nuevoGrupo } from "./datos.js";
import { esc, dur, pad, toast } from "./util.js";
import * as obra from "./vistas/obra.js";
import * as recesos from "./vistas/recesos.js";
import * as herramientas from "./vistas/herramientas.js";
import * as mas from "./vistas/mas.js";
import * as anticipos from "./vistas/anticipos.js";

const V = document.getElementById("view");
const VISTAS = { obra, recesos, herramientas, anticipos, mas };
const caminando = new Set();
let canal = null, ocupado = false;

const tabActual = () => (VISTAS[location.hash.slice(1)] ? location.hash.slice(1) : "obra");

// ---------- Dibujar ----------
function redibujar() {
  if (!S.perfil?.aprobado) return;
  const tab = tabActual();
  document.querySelectorAll("nav.tabs a").forEach((a) => a.setAttribute("aria-current", a.dataset.tab === tab ? "page" : "false"));
  const n = enReceso().length, b = document.getElementById("bBadge");
  b.hidden = !n; b.textContent = n;
  VISTAS[tab].render(V, ctx);
  reloj();
}

// Ejecuta una acción, recarga los datos y avisa el resultado
// Las acciones se forman en fila: si tocas rápido, ninguna se pierde
let cola = Promise.resolve();
function hacer(accion) { cola = cola.then(() => { nuevoGrupo(); return ejecutar(accion); }); return cola; }
async function ejecutar(accion) {
  ocupado = true;
  try { const msg = await accion(); await cargarTodo(); redibujar(); if (msg) toast(msg); }
  catch (e) { toast(e.message || "Algo salió mal. Intenta de nuevo."); await cargarTodo().catch(() => {}); redibujar(); }
  finally { ocupado = false; }
}
const ctx = { hacer, redibujar, caminando };

function reloj() {
  const ahora = Date.now(), d = new Date();
  document.querySelector("#live span").textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  document.querySelectorAll("[data-desde]").forEach((el) => {
    const t = ahora - +el.dataset.desde; el.textContent = dur(t);
    if (el.dataset.limite) el.closest(".turno, .tok")?.classList.toggle("pasado", t > +el.dataset.limite * 60000);
  });
}
setInterval(reloj, 1000);

// ---------- Tiempo real: si otro celular cambia algo, se ve aquí ----------
let tRecarga;
function escucharCambios() {
  if (canal) return;
  canal = sb.channel("cambios")
    .on("postgres_changes", { event: "*", schema: "public" }, () => {
      clearTimeout(tRecarga);
      tRecarga = setTimeout(async () => { if (!ocupado) { await cargarTodo().catch(() => {}); redibujar(); } }, 300);
    })
    .subscribe((estado) => document.getElementById("live").classList.toggle("on", estado === "SUBSCRIBED"));
}
function dejarDeEscuchar() { if (canal) { sb.removeChannel(canal); canal = null; } }

// Al volver a la app (por ejemplo, desbloquear el cel) se refrescan los datos
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "visible" && S.perfil?.aprobado) { await cargarTodo().catch(() => {}); redibujar(); }
});

// ---------- Ingreso ----------
function mostrarApp(visible) {
  document.getElementById("top").hidden = !visible;
  document.getElementById("tabs").hidden = !visible;
}

function pantallaIngreso(modo = "entrar", aviso = "") {
  mostrarApp(false);
  const crear = modo === "crear";
  V.innerHTML = `<div class="auth"><div class="logo">SYM</div>
    <p class="eyebrow">Gestión SYM</p><h2>${crear ? "Crear cuenta" : "Entrar"}</h2>
    <p class="lead">${crear ? "Después de crearla, el administrador te da acceso." : "Obra en vivo, recesos y herramientas de tu empresa."}</p>
    <form id="f">
      ${crear ? `<div class="field"><label for="usuario">Usuario</label><input id="usuario" autocomplete="username" autocapitalize="none" spellcheck="false" pattern="[a-zA-Z0-9._]{3,30}" placeholder="Ej. leonardo" required>
        <small class="note" style="margin:0">Letras, números, punto o guion bajo. Con esto también puedes entrar.</small></div>
      <div class="field"><label for="email">Correo</label><input id="email" type="email" autocomplete="email" required></div>`
      : `<div class="field"><label for="email">Usuario o correo</label><input id="email" autocomplete="username" autocapitalize="none" spellcheck="false" required></div>`}
      <div class="field"><label for="clave">Contraseña</label><input id="clave" type="password" minlength="6" autocomplete="${crear ? "new-password" : "current-password"}" required></div>
      <button class="btn primary big">${crear ? "Crear cuenta" : "Entrar"}</button>
      <p class="err" id="err" ${aviso ? "" : "hidden"}>${esc(aviso)}</p>
    </form>
    <p class="note">${crear ? "¿Ya tienes cuenta?" : "¿Primera vez?"} <button class="linkbtn" id="cambiar">${crear ? "Entrar" : "Crear cuenta"}</button></p></div>`;
  V.querySelector("#cambiar").onclick = () => pantallaIngreso(crear ? "entrar" : "crear");
  V.querySelector("#f").onsubmit = async (e) => {
    e.preventDefault();
    const err = V.querySelector("#err"), btn = V.querySelector("button.big");
    let email = V.querySelector("#email").value.trim(); const password = V.querySelector("#clave").value;
    btn.disabled = true; err.hidden = true;
    try {
      if (crear) {
        const usuario = V.querySelector("#usuario").value.trim().toLowerCase();
        const { data: libre, error: e1 } = await sb.rpc("usuario_disponible", { p_usuario: usuario });
        if (e1) throw e1;
        if (!libre) throw new Error("usuario_ocupado");
        const { data, error } = await sb.auth.signUp({ email, password,
          options: { data: { nombre: usuario.charAt(0).toUpperCase() + usuario.slice(1), usuario }, emailRedirectTo: location.origin + location.pathname } });
        if (error) throw error;
        if (!data.session) return pantallaMensaje("Revisa tu correo", `Te enviamos un enlace a <b>${esc(email)}</b> para confirmar tu cuenta. Ábrelo y luego entra con tu usuario <b>${esc(usuario)}</b> o tu correo.`, true);
      } else {
        // Si escribió un nombre de usuario (sin @), se busca su correo
        if (!email.includes("@")) {
          const { data, error } = await sb.rpc("correo_de_usuario", { p_usuario: email });
          if (error) throw error;
          if (!data) throw new Error("Invalid login");
          email = data;
        }
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (x) {
      const m = x.message || "";
      err.textContent = /Invalid login/.test(m) ? "Usuario, correo o contraseña incorrectos."
        : /usuario_ocupado/.test(m) ? "Ese nombre de usuario ya existe. Elige otro."
        : /Email not confirmed/.test(m) ? "Primero confirma tu correo con el enlace que te enviamos."
        : /already registered/.test(m) ? "Ese correo ya tiene cuenta. Toca “Entrar”."
        : /Password should/.test(m) ? "La contraseña debe tener al menos 6 caracteres."
        : m || "No se pudo. Revisa tu conexión.";
      err.hidden = false; btn.disabled = false;
    }
  };
}

function pantallaMensaje(titulo, texto, volver = false) {
  mostrarApp(false);
  V.innerHTML = `<div class="auth"><div class="logo">SYM</div><h2>${titulo}</h2><p class="lead">${texto}</p>
    <div class="acts">${volver ? `<button class="btn primary" id="volver">Ir a entrar</button>`
      : `<button class="btn primary" id="refrescar">Ya me dieron acceso</button><button class="btn" id="salir">Cerrar sesión</button>`}</div></div>`;
  const v = V.querySelector("#volver"); if (v) v.onclick = () => pantallaIngreso("entrar");
  const r = V.querySelector("#refrescar"); if (r) r.onclick = () => entrar(S.usuario);
  const s = V.querySelector("#salir"); if (s) s.onclick = () => sb.auth.signOut();
}

async function entrar(usuario) {
  S.usuario = usuario;
  try {
    await cargarPerfil();
    if (!S.perfil?.aprobado) { dejarDeEscuchar(); return pantallaMensaje("Esperando acceso", `Tu cuenta (${esc(usuario.email)}) ya está creada. El administrador tiene que darte acceso desde la sección “Más”.`); }
    document.getElementById("who").textContent = `${S.perfil.nombre} · ${S.perfil.rol === "admin" ? "Administrador" : "Encargado"}`;
    await cargarTodo();
    mostrarApp(true);
    escucharCambios();
    redibujar();
  } catch (e) {
    V.innerHTML = `<div class="auth"><h2>No se pudo cargar</h2><p class="lead">${esc(e.message)}</p><button class="btn primary" id="re">Reintentar</button></div>`;
    V.querySelector("#re").onclick = () => entrar(usuario);
  }
}

let usuarioActual = null;
sb.auth.onAuthStateChange((evento, sesion) => {
  const u = sesion?.user || null;
  if (u && u.id === usuarioActual) return;   // misma persona (refresco de token)
  usuarioActual = u?.id || null;
  if (u) setTimeout(() => entrar(u), 0);
  else { dejarDeEscuchar(); S.perfil = null; pantallaIngreso(); }
});

window.addEventListener("hashchange", () => { redibujar(); window.scrollTo(0, 0); });

// App instalable (funciona como app en el celular)
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

// Compu con pantalla baja (laptop con escala de Windows o zoom del navegador): achica toda la app para que quepa más.
// En celular y tablet (dedo) no se toca.
function ajustarEscala() {
  const compu = matchMedia("(pointer:fine)").matches && innerWidth >= 700;
  const z = compu ? Math.max(0.7, Math.min(1, innerHeight / 900)) : 1;
  document.body.style.zoom = z === 1 ? "" : String(z);   // en body (no en html) para que el menú de abajo quede pegado al borde
}
ajustarEscala();
addEventListener("resize", ajustarEscala);
