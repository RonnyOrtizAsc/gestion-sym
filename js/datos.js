// Conexión con Supabase: carga de datos y acciones que guardan en la base.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_KEY, VAPID_PUBLIC } from "./config.js";
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
  anticipos: [],      // pendientes de descontar + los descontados de los últimos 120 días
  resumen: [],        // minutos de receso por persona y día (últimos 62 días)
  actividades: [],    // plan de obra: actividades con fechas y avance real
  planListo: false,   // false = la tabla "actividades" todavía no existe en la base (falta aplicar la migración)         // estado marcado a mano de cada pieza del plano: { idx: estado }
};

const ok = ({ data, error }) => { if (error) throw new Error(traducir(error)); return data; };
function traducir(e) {
  const m = e.message || String(e);
  if (/duplicate key.*una_sesion_abierta/.test(m)) return "Ya hay un receso abierto.";
  if (/duplicate key.*un_receso_abierto/.test(m)) return "Esa persona ya está en receso.";
  if (/row-level security/.test(m)) return "Tu usuario no tiene permiso para esto.";
  if (/elementos_tipo_check|column "?forma"?|'forma' column/.test(m)) return "Falta activar las figuras nuevas en la base de datos (migración 20261117_figuras).";
  if (/Failed to fetch|NetworkError/.test(m)) return "Sin conexión a internet. Intenta de nuevo.";
  return m;
}

export async function cargarPerfil() {
  S.perfil = ok(await sb.from("perfiles").select("*").eq("id", S.usuario.id).maybeSingle());
  return S.perfil;
}

export async function cargarTodo() {
  const hoy = inicioDelDia().toISOString();
  const [t, s, r, h, p, o, a, el, pz, rs, an] = await Promise.all([
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
    sb.from("anticipos").select("*").or(`descontado_en.is.null,descontado_en.gte.${new Date(Date.now() - 120 * 864e5).toISOString()}`).order("dado_en", { ascending: false }),
  ]);
  S.trabajadores = ok(t); S.sesiones = ok(s); S.recesos = ok(r); S.herramientas = ok(h); S.prestamos = ok(p);
  S.obra = ok(o); S.areas = ok(a).filter((x) => !S.obra || x.obra_id === S.obra.id);
  S.elementos = ok(el).filter((x) => !S.obra || x.obra_id === S.obra.id);
  S.resumen = ok(rs); S.anticipos = ok(an);
  S.piezas = Object.fromEntries(ok(pz).filter((x) => !S.obra || x.obra_id === S.obra.id).map((x) => [x.idx, x.estado]));
  FOTO.el = new Map(S.elementos.map((e) => [e.id, structuredClone(e)])); FOTO.pz = { ...S.piezas }; FOTO.ar = new Map(S.areas.map((a) => [a.id, structuredClone(a)]));
  if (S.perfil?.rol === "admin") S.perfiles = ok(await sb.from("perfiles").select("*").order("creado_en"));
  await cargarPlan();
}

// El plan se carga aparte: si la tabla todavía no existe, el resto de la app sigue funcionando
async function cargarPlan() {
  const { data, error } = await sb.from("actividades").select("*").order("inicio").order("nombre");
  S.planListo = !error;
  S.actividades = error ? [] : data.filter((x) => !S.obra || !x.obra_id || x.obra_id === S.obra.id);
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
// Regresa a alguien con una hora dada (cuando se olvidó marcarlo a tiempo)
export async function regresarEn(wid, fin) {
  const abierto = recesoAbierto(wid); if (!abierto) return;
  ok(await sb.from("recesos").update({ fin: new Date(Math.max(ms(abierto.inicio) + 60000, Math.min(Date.now(), fin))).toISOString() }).eq("id", abierto.id));
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
  const actividad = (texto || "").trim() || null, cambios = { actividad, actividad_desde: actividad ? ahora() : null };
  // Si escribe algo distinto a la actividad del plan que tenía, deja de contar para esa actividad
  const w = S.trabajadores.find((x) => x.id === wid), del = w?.actividad_id && actividadPlan(w.actividad_id);
  if (S.planListo && w?.actividad_id && (!del || del.nombre !== actividad)) cambios.actividad_id = null;
  ok(await sb.from("trabajadores").update(cambios).eq("id", wid));
}

// ---------- Plan de obra (Dashboard) ----------
export const actividadPlan = (id) => S.actividades.find((a) => a.id === id) || null;
export const asignados = (aid) => S.trabajadores.filter((w) => w.actividad_id === aid);
const sello = () => ({ actualizado_en: ahora(), actualizado_por: yo() });

// datos = { nombre, fase, area_id, inicio, fin, cantidad, unidad, encargado }
export async function guardarActividad(datos, id = null) {
  if (id) ok(await sb.from("actividades").update({ ...datos, ...sello() }).eq("id", id));
  else ok(await sb.from("actividades").insert({ ...datos, obra_id: S.obra?.id || null }));
}
export async function borrarActividad(id) {
  ok(await sb.from("actividades").delete().eq("id", id));
}
// Avance: cantidad hecha hasta hoy (o % si no tiene cantidad). Al llegar al total queda terminada.
export async function ponerAvance(id, hecho) {
  const a = actividadPlan(id); if (!a) return;
  const total = a.cantidad ? +a.cantidad : 100, h = Math.max(0, Math.min(total, +hecho || 0));
  const estado = h >= total ? "terminada" : h > 0 && a.estado === "pendiente" ? "en_proceso" : a.estado === "terminada" ? "en_proceso" : a.estado;
  ok(await sb.from("actividades").update({ hecho: h, estado, motivo: estado === "detenida" ? a.motivo : null, ...sello() }).eq("id", id));
  if (estado === "terminada") await soltarAsignados(id);
}
// estado = "pendiente" | "en_proceso" | "detenida" | "terminada"; motivo solo para "detenida"
export async function cambiarEstadoActividad(id, estado, motivo = null) {
  const a = actividadPlan(id), cambios = { estado, motivo: estado === "detenida" ? motivo : null, ...sello() };
  if (estado === "terminada" && a) cambios.hecho = a.cantidad || 100;
  ok(await sb.from("actividades").update(cambios).eq("id", id));
  if (estado === "terminada") await soltarAsignados(id);
}
// Quien estaba en una actividad terminada queda "sin actividad" (para que se le dé la siguiente)
async function soltarAsignados(aid) {
  if (!asignados(aid).length) return;
  ok(await sb.from("trabajadores").update({ actividad_id: null, actividad: null, actividad_desde: null }).eq("actividad_id", aid));
}
// Pone a un trabajador en una actividad del plan (o en ninguna con aid = null).
// También escribe el nombre en "actividad" para que se vea en el plano, y si la actividad
// tiene área, lo mueve a esa área.
export async function asignarActividad(wid, aid) {
  const a = aid ? actividadPlan(aid) : null, w = S.trabajadores.find((x) => x.id === wid);
  const cambios = { actividad_id: a?.id || null, actividad: a?.nombre || null, actividad_desde: a ? ahora() : null };
  if (a?.area_id && w?.area_id !== a.area_id) Object.assign(cambios, { area_id: a.area_id, pos_x: null, pos_y: null });
  ok(await sb.from("trabajadores").update(cambios).eq("id", wid));
  if (a && a.estado === "pendiente") ok(await sb.from("actividades").update({ estado: "en_proceso", ...sello() }).eq("id", a.id));
}
// Importa (o actualiza) actividades del Planificador. Al actualizar no toca el avance ni el estado.
export async function importarActividades(filas) {
  const obra_id = S.obra?.id || null, ya = new Map(S.actividades.filter((a) => a.origen).map((a) => [a.origen, a]));
  const nuevas = filas.filter((f) => !ya.has(f.origen)).map((f) => ({ ...f, obra_id }));
  if (nuevas.length) ok(await sb.from("actividades").insert(nuevas));
  const cambiadas = filas.filter((f) => ya.has(f.origen));
  for (const f of cambiadas) ok(await sb.from("actividades").update({ ...f, ...sello() }).eq("id", ya.get(f.origen).id));
  return { nuevas: nuevas.length, actualizadas: cambiadas.length };
}

export const area = (id) => S.areas.find((a) => a.id === id) || null;
export const enArea = (aid) => S.trabajadores.filter((w) => w.area_id === aid);
// pos = [x, y] en % del plano: el lugar exacto dentro del área (baños, gradas, una esquina…).
// Sin pos, la persona se acomoda sola dentro del área.
export async function moverTrabajador(wid, areaId, pos = null) {
  const cambios = { area_id: areaId, pos_x: pos ? +pos[0].toFixed(2) : null, pos_y: pos ? +pos[1].toFixed(2) : null };
  const w = S.trabajadores.find((x) => x.id === wid); if (w) Object.assign(w, cambios);   // se ve al instante
  ok(await sb.from("trabajadores").update(cambios).eq("id", wid));
}

// ---------- Anticipos: efectivo adelantado que se resta del pago ----------
export const anticiposPendientes = (wid) => S.anticipos.filter((x) => !x.descontado_en && (!wid || x.trabajador_id === wid));
export const debeAnticipo = (wid) => anticiposPendientes(wid).reduce((s, x) => s + +x.monto, 0);
export async function darAnticipo(wid, monto, nota) {
  ok(await sb.from("anticipos").insert({ trabajador_id: wid, monto, nota: (nota || "").trim() || null }));
}
// Marca como ya descontados del pago todos los anticipos pendientes de una persona
export async function descontarAnticipos(wid) {
  const ids = anticiposPendientes(wid).map((x) => x.id); if (!ids.length) return;
  ok(await sb.from("anticipos").update({ descontado_en: ahora(), descontado_por: S.usuario.id }).in("id", ids));
}
// Por si se marcó por error: los de ese mismo descuento vuelven a quedar pendientes
export async function deshacerDescuento(wid, descontadoEn) {
  ok(await sb.from("anticipos").update({ descontado_en: null, descontado_por: null }).eq("trabajador_id", wid).eq("descontado_en", descontadoEn));
}
export async function borrarAnticipo(id) {
  const { data, error } = await sb.from("anticipos").delete().eq("id", id).select("id");
  if (error) throw new Error(traducir(error));
  if (!data?.length) throw new Error("Solo puedes borrar los anticipos que tú anotaste (el administrador puede borrar cualquiera).");
}

// ---------- Plano: estados y elementos ----------
export const ESTADOS = { existe: "Hecho", en_proceso: "En construcción", falta: "Falta" };
export const NOMBRE_ESTADO = { ...ESTADOS, quitado: "No va" };   // "quitado" = pieza del plano que no va (no se dibuja ni se levanta)
export const TIPOS_ELEMENTO = { grada: "Gradas", jardinera: "Jardinera", bano: "Baño", muro: "Pared", puerta: "Puerta", columna: "Columna", bodega: "Bodega", techo: "Techo", otro: "Otro",
  hoyo: "Hoyo / zanja", monticulo: "Montón de tierra", losa: "Bloque / losa", inodoro: "Inodoro", lavamanos: "Lavamanos", mueble: "Mueble / mesa" };
export async function estadoArea(id, estado) {
  ok(await sb.from("areas").update({ estado }).eq("id", id));
}
// Áreas: se agregan, se estiran, se dividen y se borran desde "Editar plano". El nombre puede quedar vacío.
// Colores de lo dibujado en 3D (estantes, columnas, casetas…): { clave: "#rrggbb" } en la obra. color null = el original.
export async function guardarColor(clave, color) {
  const colores = { ...(S.obra.colores || {}) }; if (color) colores[clave] = color; else delete colores[clave];
  S.obra.colores = colores;
  ok(await sb.from("obras").update({ colores }).eq("id", S.obra.id));
}
export const agregarArea = (a) => arInsertar({ tipo: "patio", estado: "existe", nombre: "", ...a, obra_id: S.obra.id, orden: 50 });   // 50 = zona agregada (ver ORDEN_ZONA en figuras.js)
export const editarArea = (id, cambios) => arCambiar(id, cambios);
// Al borrar un área, la gente que estaba ahí se queda en el mismo lugar del plano (sin área)
export async function borrarArea(id) {
  ok(await sb.from("trabajadores").update({ area_id: null }).eq("area_id", id));
  ok(await sb.from("areas").delete().eq("id", id));
}
// Marcar piezas del plano (una o muchas a la vez)
// ---------- Deshacer y rehacer (plano) ----------
// FOTO = cómo está guardado (no lo que se ve, que a veces se cambia antes de guardar). Cada cambio del plano anota
// cómo regresarse; lo que se hace en una sola acción (p. ej. una pared que se une con otras) se deshace junto.
// Deshacer corre esas notas; cada una, al correr, anota a su vez cómo volver a hacerse (eso es "rehacer").
const FOTO = { el: new Map(), pz: {}, ar: new Map() };
const PILA = [], REHACER = [];   // [{ grupo, fn }]
let grupoActual = 0, destino = null, grupoForzado = null;
export const nuevoGrupo = () => ++grupoActual;
export const puedeDeshacer = () => PILA.length > 0;
export const puedeRehacer = () => REHACER.length > 0;
const anotar = (fn) => {
  const pila = destino || PILA; pila.push({ grupo: grupoForzado ?? grupoActual, fn }); if (pila.length > 60) pila.shift();
  if (!destino) REHACER.length = 0;   // un cambio nuevo borra lo que se podía rehacer
};
async function correr(desde, hacia) {
  if (!desde.length) return false;
  const g = desde[desde.length - 1].grupo; destino = hacia; grupoForzado = g;
  try { while (desde.length && desde[desde.length - 1].grupo === g) await desde.pop().fn(); }
  finally { destino = null; grupoForzado = null; }
  return true;
}
export const deshacer = () => correr(PILA, REHACER);
export const rehacer = () => correr(REHACER, PILA);
const quitarDeS = (lista, id) => lista.filter((q) => q.id !== id);

// Elementos (paredes, figuras)
async function elInsertar(fila, enS = false) {
  const n = ok(await sb.from("elementos").insert(fila).select().single());
  FOTO.el.set(n.id, structuredClone(n));
  if (enS && !S.elementos.some((q) => q.id === n.id)) S.elementos.push(structuredClone(n));
  anotar(() => elBorrar(n.id, true));
  return n;
}
async function elBorrar(id, enS = false) {
  const viejo = FOTO.el.get(id);
  ok(await sb.from("elementos").delete().eq("id", id));
  FOTO.el.delete(id); if (enS) S.elementos = quitarDeS(S.elementos, id);
  if (viejo) anotar(() => elInsertar(viejo, true));
}
async function elCambiar(id, cambios, enS = false) {
  const viejo = FOTO.el.get(id), antes = viejo ? Object.fromEntries(Object.keys(cambios).map((k) => [k, viejo[k] ?? null])) : null;
  ok(await sb.from("elementos").update({ ...cambios, actualizado_en: ahora(), actualizado_por: yo() }).eq("id", id));
  if (viejo) Object.assign(viejo, structuredClone(cambios));
  if (enS) { const e = S.elementos.find((q) => q.id === id); if (e) Object.assign(e, structuredClone(cambios)); }
  if (antes) anotar(() => elCambiar(id, antes, true));
}
export const agregarElemento = (e) => elInsertar({ ...e, obra_id: S.obra.id, actualizado_por: yo() });
export const editarElemento = (id, cambios) => elCambiar(id, cambios);
export const borrarElemento = (id) => elBorrar(id);

// Piezas del plano (estado null = como venía en el plano)
const filaPieza = (idx, estado) => ({ obra_id: S.obra.id, idx, estado, actualizado_en: ahora(), actualizado_por: yo() });
async function piezasPoner(indices, estado) {
  if (!indices.length) return;
  const antes = indices.map((i) => [i, FOTO.pz[i] ?? null]);
  if (estado === null) { ok(await sb.from("piezas").delete().eq("obra_id", S.obra.id).in("idx", indices)); indices.forEach((i) => { delete FOTO.pz[i]; delete S.piezas[i]; }); }
  else {
    const filas = indices.map((idx) => filaPieza(idx, estado));
    for (let i = 0; i < filas.length; i += 500) ok(await sb.from("piezas").upsert(filas.slice(i, i + 500), { onConflict: "obra_id,idx" }));
    indices.forEach((i) => { FOTO.pz[i] = estado; S.piezas[i] = estado; });
  }
  anotar(async () => {
    const porEstado = new Map(); for (const [i, e] of antes) (porEstado.get(e) || porEstado.set(e, []).get(e)).push(i);
    for (const [e, lista] of porEstado) await piezasPoner(lista, e);
  });
}
// Marcar piezas del plano (una o muchas a la vez)
export const estadoPiezas = (indices, estado) => piezasPoner(indices, estado);

// Áreas (zonas): agregar y cambiar también se deshacen
async function arInsertar(fila, enS = false) {
  const n = ok(await sb.from("areas").insert(fila).select().single());
  FOTO.ar.set(n.id, structuredClone(n));
  if (enS && !S.areas.some((q) => q.id === n.id)) S.areas.push(structuredClone(n));
  anotar(async () => { ok(await sb.from("areas").delete().eq("id", n.id)); FOTO.ar.delete(n.id); S.areas = quitarDeS(S.areas, n.id);
    anotar(() => arInsertar(n, true)); });
  return n;
}
async function arCambiar(id, cambios, enS = false) {
  const viejo = FOTO.ar.get(id), antes = viejo ? Object.fromEntries(Object.keys(cambios).map((k) => [k, viejo[k] ?? null])) : null;
  ok(await sb.from("areas").update(cambios).eq("id", id));
  if (viejo) Object.assign(viejo, structuredClone(cambios));
  if (enS) { const a = S.areas.find((q) => q.id === id); if (a) Object.assign(a, structuredClone(cambios)); }
  if (antes) anotar(() => arCambiar(id, antes, true));
}

export async function editarPerfil(id, cambios) {
  ok(await sb.from("perfiles").update(cambios).eq("id", id));
}

// ---------- Categorías de herramientas ----------
// Se ponen solas por el nombre; se pueden cambiar en Inventario (queda guardada).
export const CATEGORIAS = [
  ["electricas", "Máquinas", /taladr|pulidor|esmeril|rotomart|martillo dem|sierra(?! copa)|caladora|router|lijador|atornillad|compresor|planta|extensi[oó]n|sold|aparato|cortadora|plasma|guillotin/],
  ["manuales", "Manuales", /tenaza|llave|stilson|martill|desarmador|destornill|alicate|pinza|sargento|prensa|cincel|serrucho|cuchilla|navaja|tijera|remachad|pala|piocha|carretill|cuchara|llana|barra|cubeta|balde|azad|rastrillo|codal|cinta m|metro|nivel|escuadra|plomada|tiralinea/],
  ["accesorios", "Accesorios", /broca|disco|diacamer|cubo magn|punta|adaptador|copa|lija|hoja|electrod|plum[oó]n|l[aá]piz|marcador|cray[oó]n|tornillo|clavo/],
  ["seguridad", "Seguridad", /guante|lente|casco|chaleco|arn[eé]s|tap[oó]n|bota|mascarilla|respirador|tapaboca|faja|careta|conos?\b|cinta de seg/],
  ["otros", "Otros", /$^/],
];
// categorías viejas → nuevas (si alguna quedó guardada)
const VIEJAS = { soldadura: "electricas", medicion: "manuales", obra: "manuales" };
const sinTilde = (t) => (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
export const textoBusqueda = sinTilde;
export function categoriaDe(h) {
  const guardada = VIEJAS[h.categoria] || h.categoria;
  if (guardada && CATEGORIAS.some(([k]) => k === guardada)) return guardada;
  const n = (h.nombre || "").toLowerCase();
  return (CATEGORIAS.find(([, , re]) => re.test(n) || re.test(sinTilde(n))) || ["otros"])[0];
}
export const nombreCategoria = (k) => (CATEGORIAS.find(([c]) => c === k) || [, "Otros"])[1];
export async function cambiarCategoria(hid, categoria) {
  ok(await sb.from("herramientas").update({ categoria }).eq("id", hid));
  const h = S.herramientas.find((x) => x.id === hid); if (h) h.categoria = categoria;
}

// ---------- Avisos de receso al celular ----------
// "no" = este celular no puede (en iPhone hay que instalar la app primero), "bloqueado" = se negó el permiso
export function estadoAvisos() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "no";
  return Notification.permission === "granted" ? "si" : Notification.permission === "denied" ? "bloqueado" : "preguntar";
}
const llave = (b64) => { const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };
// Guarda este celular para recibir avisos (pide permiso solo si hace falta)
export async function activarAvisos({ preguntar = true, saludo = false } = {}) {
  if (estadoAvisos() === "no") return false;
  if (Notification.permission === "default" && preguntar) await Notification.requestPermission();
  if (Notification.permission !== "granted") return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: llave(VAPID_PUBLIC) }));
  const j = sub.toJSON();
  ok(await sb.from("push_suscripciones").upsert({ usuario_id: S.usuario.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: "endpoint" }));
  if (saludo) reg.showNotification("Avisos de receso activados", { body: "Te avisaremos cuando a alguien se le acabe el receso.", icon: "icons/icon-192.png", tag: "receso" });
  return true;
}
export async function desactivarAvisos() {
  if (estadoAvisos() === "no") return;
  const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription(); if (!sub) return;
  await sb.from("push_suscripciones").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}
export async function avisosActivos() {
  if (estadoAvisos() !== "si") return false;
  return !!(await (await navigator.serviceWorker.ready).pushManager.getSubscription());
}
