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
  sesion: null,       // receso abierto (o null)
  recesos: [],        // recesos de hoy + los que siguen abiertos
  herramientas: [],
  prestamos: [],      // activos y perdidos
  perfiles: [],       // solo para el admin
  obra: null,         // obra activa (con sus planos)
  areas: [],          // áreas de la obra sobre el plano
  elementos: [],      // gradas, jardineras, baños… con su estado
  piezas: {},         // estado marcado a mano de cada pieza del plano: { idx: estado }
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
  const [t, s, r, h, p, o, a, el, pz] = await Promise.all([
    sb.from("trabajadores").select("*").eq("activo", true).order("nombre"),
    sb.from("sesiones_receso").select("*").is("fin", null).maybeSingle(),
    sb.from("recesos").select("*").or(`inicio.gte.${hoy},fin.is.null`).order("inicio"),
    sb.from("herramientas").select("*").order("nombre"),
    sb.from("prestamos").select("*").in("estado", ["activo", "perdido"]).order("prestado_en", { ascending: false }),
    sb.from("obras").select("*").eq("activa", true).order("creado_en").limit(1).maybeSingle(),
    sb.from("areas").select("*").order("orden"),
    sb.from("elementos").select("*").order("creado_en"),
    sb.from("piezas").select("idx, estado, obra_id"),
  ]);
  S.trabajadores = ok(t); S.sesion = ok(s); S.recesos = ok(r); S.herramientas = ok(h); S.prestamos = ok(p);
  S.obra = ok(o); S.areas = ok(a).filter((x) => !S.obra || x.obra_id === S.obra.id);
  S.elementos = ok(el).filter((x) => !S.obra || x.obra_id === S.obra.id);
  S.piezas = Object.fromEntries(ok(pz).filter((x) => !S.obra || x.obra_id === S.obra.id).map((x) => [x.idx, x.estado]));
  if (S.perfil?.rol === "admin") S.perfiles = ok(await sb.from("perfiles").select("*").order("creado_en"));
}

// ---------- Consultas sobre el estado ----------
export const trabajador = (id) => S.trabajadores.find((w) => w.id === id) || { nombre: "(ya no está)", puesto: "" };
export const herramienta = (id) => S.herramientas.find((h) => h.id === id) || { nombre: "(borrada)", cantidad: 0 };
export const recesoAbierto = (wid) => S.recesos.find((r) => r.trabajador_id === wid && !r.fin);
export const enReceso = () => S.recesos.filter((r) => !r.fin);
export function recesoHoy(wid) {
  const ini = inicioDelDia().getTime(), ahora = Date.now();
  return S.recesos.filter((r) => r.trabajador_id === wid)
    .reduce((a, r) => a + ((r.fin ? ms(r.fin) : ahora) - Math.max(ms(r.inicio), ini)), 0);
}
export const prestamosActivos = () => S.prestamos.filter((p) => p.estado === "activo");
const suma = (arr) => arr.reduce((a, p) => a + p.cantidad, 0);
export const prestadas = (hid) => suma(prestamosActivos().filter((p) => p.herramienta_id === hid));
export const perdidas = (hid) => suma(S.prestamos.filter((p) => p.herramienta_id === hid && p.estado === "perdido"));
export const disponibles = (h) => h.cantidad - prestadas(h.id) - perdidas(h.id);

// ---------- Acciones ----------
const yo = () => S.usuario?.id;
const ahora = () => new Date().toISOString();

export async function iniciarReceso() {
  S.sesion = ok(await sb.from("sesiones_receso").insert({ iniciado_por: yo() }).select().single());
}
export async function cambiarReceso(wid) {
  if (!S.sesion) await iniciarReceso();   // si no hay receso abierto, se abre solo
  const abierto = recesoAbierto(wid);
  if (abierto) ok(await sb.from("recesos").update({ fin: ahora() }).eq("id", abierto.id));
  else ok(await sb.from("recesos").insert({ trabajador_id: wid, sesion_id: S.sesion.id, registrado_por: yo() }));
  return !abierto;
}
export async function terminarReceso() {
  const t = ahora();
  ok(await sb.from("recesos").update({ fin: t }).is("fin", null));
  if (S.sesion) ok(await sb.from("sesiones_receso").update({ fin: t }).eq("id", S.sesion.id));
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
export async function cambiarCantidad(hid, cantidad) {
  ok(await sb.from("herramientas").update({ cantidad }).eq("id", hid));
}

export async function agregarTrabajador(nombre, puesto, habilidades) {
  ok(await sb.from("trabajadores").insert({ nombre, puesto, habilidades }));
}
export async function editarTrabajador(id, cambios) {
  ok(await sb.from("trabajadores").update(cambios).eq("id", id));
}
export const area = (id) => S.areas.find((a) => a.id === id) || null;
export const enArea = (aid) => S.trabajadores.filter((w) => w.area_id === aid);
export async function moverTrabajador(wid, areaId) {
  ok(await sb.from("trabajadores").update({ area_id: areaId }).eq("id", wid));
}

// ---------- Plano: estados y elementos ----------
export const ESTADOS = { existe: "Existe", en_proceso: "En construcción", falta: "Falta" };
export const TIPOS_ELEMENTO = { grada: "Gradas", jardinera: "Jardinera", bano: "Baño", muro: "Muro", puerta: "Puerta", columna: "Columna", bodega: "Bodega", otro: "Otro" };
export async function estadoArea(id, estado) {
  ok(await sb.from("areas").update({ estado }).eq("id", id));
}
// Marcar piezas del plano (una o muchas a la vez)
export async function estadoPiezas(indices, estado) {
  if (!indices.length) return;
  const filas = indices.map((idx) => ({ obra_id: S.obra.id, idx, estado, actualizado_en: ahora(), actualizado_por: yo() }));
  for (let i = 0; i < filas.length; i += 500) ok(await sb.from("piezas").upsert(filas.slice(i, i + 500), { onConflict: "obra_id,idx" }));
}
export async function agregarElemento(e) {
  return ok(await sb.from("elementos").insert({ ...e, obra_id: S.obra.id, actualizado_por: yo() }).select().single());
}
export async function editarElemento(id, cambios) {
  ok(await sb.from("elementos").update({ ...cambios, actualizado_en: ahora(), actualizado_por: yo() }).eq("id", id));
}
export async function borrarElemento(id) {
  ok(await sb.from("elementos").delete().eq("id", id));
}

export async function editarPerfil(id, cambios) {
  ok(await sb.from("perfiles").update(cambios).eq("id", id));
}
