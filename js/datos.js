// Conexión con Supabase: carga de datos y acciones que guardan en la base.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";
import { inicioDelDia, ms } from "./util.js";

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// Estado de la app en memoria
export const S = {
  usuario: null,      // usuario de Supabase Auth
  perfil: null,       // fila de "perfiles" (rol, aprobado)
  trabajadores: [],
  sesiones: [],      // pausas abiertas: una de receso y/o una de almuerzo
  recesos: [],        // recesos de hoy + los que siguen abiertos
  herramientas: [],
  prestamos: [],      // activos y perdidos
  perfiles: [],       // solo para el admin
  obra: null,         // obra activa (con sus planos)
  areas: [],          // áreas de la obra sobre el plano
  elementos: [],      // gradas, jardineras, baños… con su estado
  piezas: {},
  resumen: [],        // minutos de receso por persona y día (últimos 62 días)         // estado marcado a mano de cada pieza del plano: { idx: estado }
};

const ok = ({ data, error }) => { if (error) throw new Error(traducir(error)); return data; };
function traducir(e) {
  const m = e.message || String(e);
  if (/duplicate key.*una_sesion_abierta/.test(m)) return "Ya hay un receso abierto.";
  if (/duplicate key.*un_receso_abierto/.test(m)) return "Esa persona ya está en receso.";
  if (/row-level security/.test(m)) return "Tu usuario no tiene permiso para esto.";
  if (/Failed to fetch|NetworkError/.test(m)) return "Sin conexión a internet. Intenta de nuevo.";
  return m;
}

export async function cargarPerfil() {
  S.perfil = ok(await sb.from("perfiles").select("*").eq("id", S.usuario.id).maybeSingle());
  return S.perfil;
}

export async function cargarTodo() {
  const hoy = inicioDelDia().toISOString();
  const [t, s, r, h, p, o, a, el, pz, rs] = await Promise.all([
    sb.from("trabajadores").select("*").eq("activo", true).order("nombre"),
    sb.from("sesiones_receso").select("*").is("fin", null),
    sb.from("recesos").select("*").or(`inicio.gte.${hoy},fin.is.null`).order("inicio"),
    sb.from("herramientas").select("*").order("nombre"),
    sb.from("prestamos").select("*").in("estado", ["activo", "perdido"]).order("prestado_en", { ascending: false }),
    sb.from("obras").select("*").eq("activa", true).order("creado_en").limit(1).maybeSingle(),
    sb.from("areas").select("*").order("orden"),
    sb.from("elementos").select("*").order("creado_en"),
    sb.from("piezas").select("idx, estado, obra_id"),
    sb.from("resumen_recesos").select("*").gte("fecha", new Date(Date.now() - 62 * 864e5).toISOString().slice(0, 10)),
  ]);
  S.trabajadores = ok(t); S.sesiones = ok(s); S.recesos = ok(r); S.herramientas = ok(h); S.prestamos = ok(p);
  S.obra = ok(o); S.areas = ok(a).filter((x) => !S.obra || x.obra_id === S.obra.id);
  S.elementos = ok(el).filter((x) => !S.obra || x.obra_id === S.obra.id);
  S.resumen = ok(rs);
  S.piezas = Object.fromEntries(ok(pz).filter((x) => !S.obra || x.obra_id === S.obra.id).map((x) => [x.idx, x.estado]));
  FOTO.el = new Map(S.elementos.map((e) => [e.id, structuredClone(e)])); FOTO.pz = { ...S.piezas };
  if (S.perfil?.rol === "admin") S.perfiles = ok(await sb.from("perfiles").select("*").order("creado_en"));
}

// ---------- Consultas sobre el estado ----------
export const trabajador = (id) => S.trabajadores.find((w) => w.id === id) || { nombre: "(ya no está)", puesto: "" };
export const herramienta = (id) => S.herramientas.find((h) => h.id === id) || { nombre: "(borrada)", cantidad: 0 };
export const recesoAbierto = (wid) => S.recesos.find((r) => r.trabajador_id === wid && !r.fin);
export const esAlmuerzo = (r) => r?.tipo === "almuerzo";
export const enReceso = () => S.recesos.filter((r) => !r.fin);
export function recesoHoy(wid) {
  const ini = inicioDelDia().getTime(), ahora = Date.now();
  return S.recesos.filter((r) => r.trabajador_id === wid)
    .reduce((a, r) => a + ((r.fin ? ms(r.fin) : ahora) - Math.max(ms(r.inicio), ini)), 0);
}
// ---------- Almuerzo: una hora al día (puede empezar 12:00, 12:05, 12:15…; se suma aunque sea en pedazos) ----------
export const LIMITE_ALMUERZO = 60;
export function almuerzoHoy(wid) {
  const ini = inicioDelDia().getTime(), now = Date.now();
  return S.recesos.filter((r) => r.trabajador_id === wid && esAlmuerzo(r) && ms(r.inicio) >= ini)
    .reduce((a, r) => a + ((r.fin ? ms(r.fin) : now) - ms(r.inicio)), 0);
}
export const excesoAlmuerzo = (wid) => Math.max(0, almuerzoHoy(wid) / 60000 - LIMITE_ALMUERZO);
// ---------- Receso por turno (mañana / tarde) ----------
// Dos recesos fijos al día: 15 min en la mañana y 15 en la tarde (la tarde empieza a las 12:00)
export const limiteReceso = () => 15;
const corteMin = () => 12 * 60;
export const turnoDe = (t) => { const d = new Date(t); return d.getHours() * 60 + d.getMinutes() < corteMin() ? "manana" : "tarde"; };
export const turnoActual = () => turnoDe(Date.now());
// Milisegundos de receso de hoy en un turno (suma todos los pedazos, incluido el que está corriendo)
export function recesoTurno(wid, turno) {
  const ini = inicioDelDia().getTime(), now = Date.now();
  return S.recesos.filter((r) => r.trabajador_id === wid && !esAlmuerzo(r) && turnoDe(r.inicio) === turno && ms(r.inicio) >= ini)
    .reduce((a, r) => a + ((r.fin ? ms(r.fin) : now) - ms(r.inicio)), 0);
}
// Minutos que se pasó hoy (sumando los dos turnos)
export const excesoHoy = (wid) => ["manana", "tarde"].reduce((a, t) => a + Math.max(0, recesoTurno(wid, t) / 60000 - limiteReceso()), 0);

export const prestamosActivos = () => S.prestamos.filter((p) => p.estado === "activo");
const suma = (arr) => arr.reduce((a, p) => a + p.cantidad, 0);
export const prestadas = (hid) => suma(prestamosActivos().filter((p) => p.herramienta_id === hid));
export const perdidas = (hid) => suma(S.prestamos.filter((p) => p.herramienta_id === hid && p.estado === "perdido"));
export const disponibles = (h) => h.cantidad - prestadas(h.id) - perdidas(h.id);

// ---------- Acciones ----------
const yo = () => S.usuario?.id;
const ahora = () => new Date().toISOString();

// tipo = "receso" o "almuerzo"
const sesionDe = (tipo) => S.sesiones.find((s) => (s.tipo || "receso") === tipo);
export async function iniciarReceso(tipo = "receso") {
  const s = ok(await sb.from("sesiones_receso").insert({ iniciado_por: yo(), tipo }).select().single());
  S.sesiones.push(s); return s;
}
// Toca a una persona: sale a receso/almuerzo o regresa. Si estaba en la otra pausa, pasa a esta.
export async function cambiarReceso(wid, tipo = "receso") {
  const abierto = recesoAbierto(wid);
  if (abierto) ok(await sb.from("recesos").update({ fin: ahora() }).eq("id", abierto.id));
  if (abierto && (abierto.tipo || "receso") === tipo) return false;
  const s = sesionDe(tipo) || (await iniciarReceso(tipo));
  ok(await sb.from("recesos").insert({ trabajador_id: wid, sesion_id: s.id, registrado_por: yo(), tipo }));
  return true;
}
// Terminar: todos los que están en ese tipo de pausa regresan a trabajar
export async function terminarReceso(tipo = "receso") {
  const t = ahora();
  ok(await sb.from("recesos").update({ fin: t }).is("fin", null).eq("tipo", tipo));
  ok(await sb.from("sesiones_receso").update({ fin: t }).is("fin", null).eq("tipo", tipo));
  S.sesiones = S.sesiones.filter((s) => (s.tipo || "receso") !== tipo);
}

export async function prestar(hid, wid, cantidad) {
  const h = herramienta(hid);
  if (cantidad > disponibles(h)) throw new Error(`Solo quedan ${disponibles(h)} en bodega.`);
  ok(await sb.from("prestamos").insert({ herramienta_id: hid, trabajador_id: wid, cantidad, registrado_por: yo() }));
}
export async function cerrarPrestamo(id, estado) {
  ok(await sb.from("prestamos").update({ estado, cerrado_en: ahora() }).eq("id", id));
}
export async function agregarHerramienta(nombre, cantidad) {
  return ok(await sb.from("herramientas").insert({ nombre, cantidad, obra_id: S.obra?.id || null }).select().single());
}
// Prestar desde la barra de mando: si la herramienta es nueva, se crea con la cantidad que se presta
export async function prestarRapido({ herramientaId, nombreNuevo, trabajadorId, cantidad }) {
  let hid = herramientaId;
  if (!hid) {
    const nombre = nombreNuevo.trim();
    const existe = S.herramientas.find((h) => h.nombre.toLowerCase() === nombre.toLowerCase());
    if (existe) hid = existe.id;
    else { hid = (await agregarHerramienta(nombre, cantidad)).id; S.herramientas.push({ id: hid, nombre, cantidad }); }
  }
  await prestar(hid, trabajadorId, cantidad);
  return herramienta(hid).nombre;
}
// Escala del plano: 1 unidad del mapa ≈ 0.056 m (el lote mide ~70 × 80.6 m, igual que los 5,667 m² del plano)
export const METROS_POR_UNIDAD = 0.056;
export async function usarComoBodega(areaId) {
  const actual = S.areas.find((a) => a.es_receso);
  if (actual && actual.id !== areaId) ok(await sb.from("areas").update({ es_receso: false, uso_actual: null }).eq("id", actual.id));
  ok(await sb.from("areas").update({ es_receso: true, uso_actual: "Bodega (receso)", estado: "existe" }).eq("id", areaId));
}
// Foto de una herramienta: se achica en el cel (máx. 900 px) para que suba rápido aunque la señal esté mala
async function achicar(file, max = 900) {
  const img = await createImageBitmap(file).catch(() => null);
  if (!img) return file;
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const cv = document.createElement("canvas"); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
  cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
  return await new Promise((r) => cv.toBlob((b) => r(b || file), "image/jpeg", 0.82));
}
// tabla = "herramientas" o "trabajadores" (cada una tiene su carpeta de fotos con el mismo nombre)
export async function subirFoto(tabla, id, file) {
  const blob = await achicar(file), ruta = `${id}.jpg`;
  const { error } = await sb.storage.from(tabla).upload(ruta, blob, { upsert: true, contentType: "image/jpeg" });
  if (error) throw new Error(traducir(error));
  const url = sb.storage.from(tabla).getPublicUrl(ruta).data.publicUrl + "?v=" + Date.now();
  ok(await sb.from(tabla).update({ foto: url }).eq("id", id));
}
export const subirFotoHerramienta = (hid, file) => subirFoto("herramientas", hid, file);

// Receso: borrar lo de hoy (pruebas). Los días anteriores pasan solos al resumen cada madrugada.
export async function borrarRecesosHoy() {
  ok(await sb.rpc("borrar_recesos_de_hoy"));
}

// Borrar una herramienta del inventario (no se puede si alguien la tiene prestada)
export async function borrarHerramienta(hid) {
  const fuera = prestadas(hid);
  if (fuera > 0) throw new Error(`No se puede borrar: hay ${fuera} prestada${fuera > 1 ? "s" : ""}. Primero márcala como devuelta o perdida.`);
  ok(await sb.from("herramientas").delete().eq("id", hid));
  await sb.storage.from("herramientas").remove([`${hid}.jpg`]).catch(() => {});
}

export async function cambiarCantidad(hid, cantidad) {
  ok(await sb.from("herramientas").update({ cantidad }).eq("id", hid));
}

export async function agregarTrabajador(nombre, puesto, habilidades) {
  ok(await sb.from("trabajadores").insert({ nombre, puesto, habilidades }));
}
export async function editarTrabajador(id, cambios) {
  ok(await sb.from("trabajadores").update(cambios).eq("id", id));
}
// Actividad que está haciendo un trabajador ahora (texto libre; vacío = sin actividad)
export async function ponerActividad(wid, texto) {
  const actividad = (texto || "").trim() || null;
  ok(await sb.from("trabajadores").update({ actividad, actividad_desde: actividad ? ahora() : null }).eq("id", wid));
}

export const area = (id) => S.areas.find((a) => a.id === id) || null;
export const enArea = (aid) => S.trabajadores.filter((w) => w.area_id === aid);
export async function moverTrabajador(wid, areaId) {
  ok(await sb.from("trabajadores").update({ area_id: areaId }).eq("id", wid));
}

// ---------- Plano: estados y elementos ----------
export const ESTADOS = { existe: "Hecho", en_proceso: "En construcción", falta: "Falta" };
export const NOMBRE_ESTADO = { ...ESTADOS, quitado: "No va" };   // "quitado" = pieza del plano que no va (no se dibuja ni se levanta)
export const TIPOS_ELEMENTO = { grada: "Gradas", jardinera: "Jardinera", bano: "Baño", muro: "Pared", puerta: "Puerta", columna: "Columna", bodega: "Bodega", techo: "Techo", otro: "Otro" };
export async function estadoArea(id, estado) {
  ok(await sb.from("areas").update({ estado }).eq("id", id));
}
// Marcar piezas del plano (una o muchas a la vez)
// ---------- Deshacer (plano) ----------
// FOTO = cómo está guardado (no lo que se ve, que a veces se cambia antes de guardar). Cada cambio del plano guarda
// cómo deshacerse; lo que se hace en una sola acción (p. ej. una pared que se une con otras) se deshace junto.
const FOTO = { el: new Map(), pz: {} };
const PILA = [];   // [{ grupo, deshacer }]
let grupoActual = 0;
export const nuevoGrupo = () => ++grupoActual;
export const puedeDeshacer = () => PILA.length > 0;
const anotar = (deshacer) => { PILA.push({ grupo: grupoActual, deshacer }); if (PILA.length > 60) PILA.shift(); };
export async function deshacer() {
  if (!PILA.length) return false;
  const g = PILA[PILA.length - 1].grupo;
  while (PILA.length && PILA[PILA.length - 1].grupo === g) await PILA.pop().deshacer();
  return true;
}
const filaPieza = (idx, estado) => ({ obra_id: S.obra.id, idx, estado, actualizado_en: ahora(), actualizado_por: yo() });
async function guardarPiezas(indices, estado) {
  const filas = indices.map((idx) => filaPieza(idx, estado));
  for (let i = 0; i < filas.length; i += 500) ok(await sb.from("piezas").upsert(filas.slice(i, i + 500), { onConflict: "obra_id,idx" }));
  for (const i of indices) FOTO.pz[i] = estado;
}
// Marcar piezas del plano (una o muchas a la vez)
export async function estadoPiezas(indices, estado) {
  if (!indices.length) return;
  const antes = indices.map((i) => [i, FOTO.pz[i] ?? null]);
  await guardarPiezas(indices, estado);
  anotar(async () => {
    const porEstado = {}; for (const [i, e] of antes) (porEstado[e] ||= []).push(i);
    for (const [e, lista] of Object.entries(porEstado)) {
      if (e === "null") { ok(await sb.from("piezas").delete().eq("obra_id", S.obra.id).in("idx", lista)); lista.forEach((i) => { delete FOTO.pz[i]; delete S.piezas[i]; }); }
      else { await guardarPiezas(lista, e); lista.forEach((i) => (S.piezas[i] = e)); }
    }
  });
}
export async function agregarElemento(e) {
  const n = ok(await sb.from("elementos").insert({ ...e, obra_id: S.obra.id, actualizado_por: yo() }).select().single());
  FOTO.el.set(n.id, structuredClone(n));
  anotar(async () => { ok(await sb.from("elementos").delete().eq("id", n.id)); FOTO.el.delete(n.id); S.elementos = S.elementos.filter((q) => q.id !== n.id); });
  return n;
}
export async function editarElemento(id, cambios) {
  const viejo = FOTO.el.get(id), antes = viejo ? Object.fromEntries(Object.keys(cambios).map((k) => [k, viejo[k] ?? null])) : null;
  ok(await sb.from("elementos").update({ ...cambios, actualizado_en: ahora(), actualizado_por: yo() }).eq("id", id));
  if (viejo) Object.assign(viejo, structuredClone(cambios));
  if (antes) anotar(async () => {
    ok(await sb.from("elementos").update({ ...antes, actualizado_en: ahora(), actualizado_por: yo() }).eq("id", id));
    Object.assign(FOTO.el.get(id) || {}, antes); const e = S.elementos.find((q) => q.id === id); if (e) Object.assign(e, antes);
  });
}
export async function borrarElemento(id) {
  const viejo = FOTO.el.get(id);
  ok(await sb.from("elementos").delete().eq("id", id));
  FOTO.el.delete(id);
  if (viejo) anotar(async () => { const n = ok(await sb.from("elementos").insert(viejo).select().single()); FOTO.el.set(n.id, structuredClone(n)); S.elementos.push(n); });
}

export async function editarPerfil(id, cambios) {
  ok(await sb.from("perfiles").update(cambios).eq("id", id));
}
