// Vista 3D de la obra: el mapa dibujado como piso, los edificios levantados
// y cada trabajador como un muñequito con casco que camina a su área (o a la bodega en el receso).
import * as THREE from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import { ANCHO, ALTO, PIEZAS, CAJAS, estadoPieza, piezaEn, grupoDe, segmentos, puntas, gruesoPared } from "./mapa-svg.js";

const ESC = 0.1;                                   // unidades del plano → metros de la escena
const VERDE = 0x2b9a57, NARANJA = 0xee8420, LIMA = 0xc4ee4a;

let E = null;   // la escena vive mientras la app esté abierta; se reutiliza al cambiar de vista

const aEscena = (x, y) => new THREE.Vector3((x - ANCHO / 2) * ESC, 0, (y - ALTO / 2) * ESC);

function crear() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcfe3ef);
  scene.fog = new THREE.Fog(0xcfe3ef, 260, 520);
  const camera = new THREE.PerspectiveCamera(42, 1, 1, 1200);
  camera.position.set(-35, 120, 135);
  // Se mueve como un mapa: arrastrar = desplazar, dos dedos / clic derecho = girar, pellizcar / rueda = acercar hacia donde apuntas
  const controls = new MapControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.12; controls.maxPolarAngle = 1.32; controls.minDistance = 12; controls.maxDistance = 360;
  controls.zoomToCursor = true; controls.screenSpacePanning = false; controls.panSpeed = 1.2; controls.rotateSpeed = 0.6;
  renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());
  controls.target.set(0, 0, 5);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f7a, 1.15));
  const sol = new THREE.DirectionalLight(0xffffff, 1.6);
  sol.position.set(-80, 160, 60); sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -100, right: 100, top: 100, bottom: -100, near: 10, far: 400 });
  scene.add(sol);

  // Terreno alrededor del lote
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshLambertMaterial({ color: 0xb7c99a }));
  suelo.rotation.x = -Math.PI / 2; suelo.position.y = -1.64 * 1.6 * ESC / 0.056 - 0.05; suelo.receiveShadow = true; scene.add(suelo);

  const piso = new THREE.Mesh(new THREE.PlaneGeometry(ANCHO * ESC, ALTO * ESC), new THREE.MeshLambertMaterial({ color: 0xffffff }));
  piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; scene.add(piso);

  const edificios = new THREE.Group(); scene.add(edificios);
  const gente = new THREE.Group(); scene.add(gente);
  const hover = new THREE.Group(), marcado = new THREE.Group(), asas = new THREE.Group(); scene.add(hover, marcado, asas);
  const tip = document.createElement("div"); tip.className = "tip"; tip.hidden = true;

  E = { renderer, scene, camera, controls, piso, edificios, gente, hover, marcado, asas, tip, figuras: new Map(), clave: "", corriendo: false, reloj: new THREE.Clock(),
    editar: false, hovKey: "", selKey: "" };

  // Editar plano: qué pieza hay bajo el puntero (pared, grada, puerta…), o -1
  const puntoBajo = (cx, cy) => {
    const r = renderer.domElement.getBoundingClientRect();
    p.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(p, camera);
    const visible = (o) => { for (; o; o = o.parent) if (!o.visible || o.userData.techo) return false; return true; };
    const golpe = ray.intersectObjects([piso, ...edificios.children], true).find((h) => !h.object.isSprite && visible(h.object));
    return golpe ? [golpe.point.x / ESC + ANCHO / 2, golpe.point.z / ESC + ALTO / 2] : null;
  };
  const piezaBajo = (cx, cy) => {
    const r = renderer.domElement.getBoundingClientRect();
    p.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(p, camera);
    const visible = (o) => { for (; o; o = o.parent) if (!o.visible || o.userData.techo) return false; return true; };
    const golpe = ray.intersectObjects([piso, ...edificios.children], true).find((h) => !h.object.isSprite && visible(h.object));
    if (!golpe) return -1;
    return piezaEn(golpe.point.x / ESC + ANCHO / 2, golpe.point.z / ESC + ALTO / 2, 10);
  };
  // Agarraderas: se arrastran para alargar la pared (la cámara no se mueve mientras tanto)
  let arrastre = null; const plano = new THREE.Plane(), golpeP = new THREE.Vector3();
  const alPlano = (e) => { const r = renderer.domElement.getBoundingClientRect();
    p.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(p, camera);
    return ray.ray.intersectPlane(plano, golpeP) ? [golpeP.x / ESC + ANCHO / 2, golpeP.z / ESC + ALTO / 2] : null; };
  renderer.domElement.addEventListener("pointerdown", (e) => {
    if (!asas.children.length) return;
    const r = renderer.domElement.getBoundingClientRect();
    p.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(p, camera);
    const h = ray.intersectObjects(asas.children.filter((o) => o.userData.asa !== undefined))[0]; if (!h) return;
    e.stopImmediatePropagation(); try { renderer.domElement.setPointerCapture(e.pointerId); } catch (_) {}
    arrastre = { idx: h.object.userData.asa, fin: null }; plano.set(new THREE.Vector3(0, 1, 0), -h.object.position.y);
  }, { capture: true });
  renderer.domElement.addEventListener("pointermove", (e) => {
    if (!arrastre) return; e.stopImmediatePropagation();
    const q = alPlano(e); if (!q) return; const m = E.handlers?.asaMueve?.(arrastre.idx, q[0], q[1]); if (!m) return;
    arrastre.fin = q; ponerAsas(m.ab);
    const r = renderer.domElement.getBoundingClientRect(); tip.innerHTML = `<b>${m.texto}</b>`; tip.hidden = false;
    tip.style.left = e.clientX - r.left + 16 + "px"; tip.style.top = e.clientY - r.top + 16 + "px";
  }, { capture: true });
  const soltar = (e) => { if (!arrastre) return; e.stopImmediatePropagation(); const a = arrastre; arrastre = null; tip.hidden = true;
    if (a.fin) E.handlers?.asaSuelta?.(a.idx, a.fin[0], a.fin[1]); };
  renderer.domElement.addEventListener("pointerup", soltar, { capture: true });
  renderer.domElement.addEventListener("pointercancel", soltar, { capture: true });

  let pendiente = null;
  renderer.domElement.addEventListener("pointermove", (e) => {
    if (!E.editar || e.pointerType !== "mouse") return;
    if (e.buttons) { tip.hidden = true; return; }                // arrastrando: no resaltar
    const ev = { x: e.clientX, y: e.clientY };
    if (pendiente) { pendiente = ev; return; }
    pendiente = ev;
    requestAnimationFrame(() => {
      const { x, y } = pendiente; pendiente = null;
      const i = piezaBajo(x, y), grupo = i < 0 ? null : grupoDe(i);
      renderer.domElement.style.cursor = grupo ? "pointer" : "";
      resaltar(E.hover, grupo, "hovKey", 0xc4ee4a, 0.5);
      if (!grupo) { tip.hidden = true; return; }
      const r = renderer.domElement.getBoundingClientRect();
      tip.innerHTML = E.handlers?.textoPieza?.(grupo) || ""; tip.hidden = !tip.innerHTML;
      tip.style.left = x - r.left + 14 + "px"; tip.style.top = y - r.top + 14 + "px";
    });
  });
  renderer.domElement.addEventListener("pointerleave", () => { tip.hidden = true; resaltar(E.hover, null, "hovKey"); });

  // Tocar (sin arrastrar) = seleccionar persona o área
  const ray = new THREE.Raycaster(), p = new THREE.Vector2(); let ini = null;
  renderer.domElement.addEventListener("pointerdown", (e) => (ini = [e.clientX, e.clientY]));
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (!ini || Math.hypot(e.clientX - ini[0], e.clientY - ini[1]) > 8) return; ini = null;
    const r = renderer.domElement.getBoundingClientRect();
    p.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    if (E.editar) {
      const q = puntoBajo(e.clientX, e.clientY);
      if (q && E.handlers?.pared?.(q[0], q[1])) { tip.hidden = true; return; }
      const i = piezaBajo(e.clientX, e.clientY); if (i >= 0) { tip.hidden = true; return E.handlers?.pieza?.(i); }
    }
    ray.setFromCamera(p, camera);
    const golpe = ray.intersectObjects(gente.children, true)[0];
    if (golpe) { let o = golpe.object; while (o && !o.userData.id) o = o.parent; if (o) return E.handlers?.persona(o.userData.id); }
    const enPiso = ray.intersectObject(piso)[0];
    if (enPiso) E.handlers?.punto(((enPiso.point.x / ESC + ANCHO / 2) / ANCHO) * 100, ((enPiso.point.z / ESC + ALTO / 2) / ALTO) * 100);
  });

  new ResizeObserver(() => ajustar()).observe(document.body);
}

function ajustar() {
  const c = E.renderer.domElement.parentElement; if (!c) return;
  const w = c.clientWidth, h = c.clientHeight; if (!w || !h) return;
  E.renderer.setSize(w, h, false); E.camera.aspect = w / h; E.camera.updateProjectionMatrix();
}

function ponerPiso(svg) {
  const img = new Image(), k = 1.4;
  const s = svg.replace('<svg class="mundo"', `<svg class="mundo" width="${ANCHO * k}" height="${ALTO * k}"`);
  img.onload = () => {
    const cv = document.createElement("canvas"); cv.width = ANCHO * k; cv.height = ALTO * k;
    cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = E.renderer.capabilities.getMaxAnisotropy();
    E.piso.material.map = t; E.piso.material.needsUpdate = true;
  };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
}

// ---------- Niveles (según secciones AR-08 / G-05) ----------
// Metros sobre el nivel de abajo (N 868.96). Calle ≈ 867.32.
const BASE_N = 868.96, CALLE = -1.64, EXAGERA = 1.6;   // los desniveles se exageran un poco para que se noten
const esRampa = (a) => a.tipo === "rampa";
const caja = (a) => ({ x0: (a.x / 100) * ANCHO, y0: (a.y / 100) * ALTO, x1: ((+a.x + +a.w) / 100) * ANCHO, y1: ((+a.y + +a.h) / 100) * ALTO });
// Tres plataformas (confirmadas en obra):
//  abajo  N 868.96: taller, rebalse técnico, todo GWM y Marca 4, comedor
//  medio  N 870.00: Chery y Nissan (salas, oficinas, exhibición)
//  arriba N 871.92: patio de maniobras, rebalse, empleados, entrega de vehículos, café
//  la bodega está abajo y la casa de encima queda al nivel de arriba
const ABAJO = 0, MEDIO = 1.04, ARRIBA = 2.96;
function nivelFijo(a) {
  const n = a.nombre || "";
  if (a.es_receso) return ABAJO;                   // bodega: abajo, al nivel del rebalse técnico
  if (/t[eé]cnico|taller|gwm|marca 4|comedor|lockers/i.test(n)) return ABAJO;
  if (/patio|rebalse|empleados|entrega de veh|caf[eé]|atenci|lavado/i.test(n)) return ARRIBA;   // el lavado va al nivel del patio de maniobras
  return MEDIO;
}
// Rampa del lado del lavado (franja este del plano): baja del patio de maniobras al nivel del taller
const RAMPA_ESTE = { c: { x0: 1264, y0: 710, x1: 1337, y1: 1312 }, eje: "y", n: [ABAJO, ARRIBA] };
// Rampa Chery (AR-01: "Rampa Chery 12%, a verificar"): solo la franja junto a las jardineras; el resto (carros demo) es plano.
// Baja hacia la calle (oeste) y sube hacia el proyecto (este, nivel Chery).
const RAMPA_CHERY = { c: { x0: 140, y0: 748, x1: 325, y1: 813 }, eje: "x", n: [ABAJO, MEDIO] };
// Lado del boulevard (AR-01), más bajo que el proyecto; lo separa un murito con barandal:
//  carril "RAMPA" pegado a la cerca: N 868.97 junto a Marca 4 → N 868.15 a medio camino → N 868.32 abajo, junto a Exhibición exterior
//  Exhibición exterior (3) a N 868.32; "Rampa existente" de Carros demo Nissan sube de N 868.32 a Entrega de vehículos (N 869.95)
const LADO_BOULEVARD = [
  { c: { x0: 87, y0: 735, x1: 140, y1: 1063 }, eje: "y", n: [0.01, -0.81] },
  { c: { x0: 87, y0: 1063, x1: 140, y1: 1338 }, eje: "y", n: [-0.81, -0.64] },
  { c: { x0: 85, y0: 1310, x1: 282, y1: 1446 }, eje: "y", n: [-0.64, -0.64] },
  { c: { x0: 282, y0: 1322, x1: 455, y1: 1446 }, eje: "x", n: [-0.64, 0.99] },
];
// Prepara la función de altura del terreno: cada área a su nivel; las rampas suben de un nivel al otro
function prepararNiveles(areas) {
  const planas = areas.filter((a) => !esRampa(a)).map((a) => ({ a, c: caja(a), n: nivelFijo(a) }));
  const fuera = (x, y) => x < 0.06 * ANCHO || y > 0.955 * ALTO;   // calle y acera
  const plano = (x, y) => {
    if (fuera(x, y)) return CALLE;
    let mejor = null, d = Infinity;
    for (const p of planas) {
      const dx = Math.max(p.c.x0 - x, 0, x - p.c.x1), dy = Math.max(p.c.y0 - y, 0, y - p.c.y1), dd = 25 * dx * dx + dy * dy;   // fuera de las áreas manda la que está arriba/abajo: los cortes salen rectos, no en diagonal
      if (dd < d || (dd === d && dd === 0 && p.n > mejor.n)) { d = dd; mejor = p; }
    }
    return mejor ? mejor.n : 0;
  };
  const rampas = areas.filter(esRampa).map((a) => {
    const c = caja(a), mx = (c.x0 + c.x1) / 2, my = (c.y0 + c.y1) / 2, m = 12;
    const ex = [plano(c.x0 - m, my), plano(c.x1 + m, my)], ey = [plano(mx, c.y0 - m), plano(mx, c.y1 + m)];
    const dx = Math.abs(ex[1] - ex[0]), dy = Math.abs(ey[1] - ey[0]);
    // sube por el lado que cambia de nivel; si los dos cambian igual, por lo largo de la rampa
    const eje = Math.abs(dx - dy) < 0.3 ? (c.x1 - c.x0 >= c.y1 - c.y0 ? "x" : "y") : dx > dy ? "x" : "y";
    return { a, c, eje, n: eje === "x" ? ex : ey };
  });
  rampas.unshift(RAMPA_ESTE, RAMPA_CHERY, ...LADO_BOULEVARD);
  E.altura = (x, y) => EXAGERA * alturaReal(x, y);
  const alturaReal = (x, y) => {
    for (const r of rampas) if (x >= r.c.x0 && x <= r.c.x1 && y >= r.c.y0 && y <= r.c.y1) {
      const t = r.eje === "x" ? (x - r.c.x0) / (r.c.x1 - r.c.x0) : (y - r.c.y0) / (r.c.y1 - r.c.y0);
      return r.n[0] + (r.n[1] - r.n[0]) * t;
    }
    return plano(x, y);
  };
  E.niveles = { planas, rampas };
}
const M = ESC / 0.056;                                         // metros → unidades de la escena
const hEscena = (sx, sz) => E.altura(sx / ESC + ANCHO / 2, sz / ESC + ALTO / 2) * M;

// Terreno: una malla que sube y baja con los niveles; los desniveles se ven como taludes grises
function ponerTerreno() {
  const nx = 230, ny = 252, g = new THREE.PlaneGeometry(ANCHO * ESC, ALTO * ESC, nx, ny);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3), hs = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) { hs[i] = hEscena(pos.getX(i), pos.getZ(i)); pos.setY(i, hs[i]); }
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const k = j * (nx + 1) + i, h = hs[k];
    const v = [i > 0 ? hs[k - 1] : h, i < nx ? hs[k + 1] : h, j > 0 ? hs[k - nx - 1] : h, j < ny ? hs[k + nx + 1] : h];
    const salto = Math.max(...v.map((o) => Math.abs(o - h))), c = salto > 1.2 ? 0.5 : 1;
    col.set([c, c, c * 0.98], k * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  E.piso.geometry.dispose(); E.piso.geometry = g; E.piso.rotation.x = 0;
  E.piso.material.vertexColors = true;
  // En los taludes (caras casi verticales) no se pinta el plano: si no, sus líneas se estiran hacia abajo como rayas
  E.piso.material.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying float vNY;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvNY = normal.y;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vNY;")
      .replace("#include <map_fragment>", "#ifdef USE_MAP\nvec4 sampledDiffuseColor = vNY < 0.55 ? vec4(0.8, 0.79, 0.76, 1.0) : texture2D(map, vMapUv);\ndiffuseColor *= sampledDiffuseColor;\n#endif");
  };
  E.piso.material.needsUpdate = true;
}

// ---------- Paredes y columnas del plano (cada pieza con su estado: hecho, en construcción o falta) ----------
const ALTO_MURO = { sala: 6, taller: 7, oficinas: 3.2, servicio: 3.2, receso: 4.74 };   // receso = ARRIBA × EXAGERA (la bodega llega al nivel de arriba)   // metros
function tipoEn(areas, x, y) {
  const a = areas.filter((a) => { const c = caja(a); return x >= c.x0 && x <= c.x1 && y >= c.y0 && y <= c.y1; }).sort((p, q) => p.w * p.h - q.w * q.h)[0];
  return a ? (a.es_receso ? "receso" : a.tipo) : null;
}
function polilineas(d) {
  const t = d.match(/[MLCZ]|-?\d+\.?\d*/g) || [], out = []; let cur = null, i = 0;
  while (i < t.length) {
    const c = t[i++];
    if (c === "M") { cur = [[+t[i], +t[i + 1]]]; out.push(cur); i += 2; }
    else if (c === "L") { cur.push([+t[i], +t[i + 1]]); i += 2; }
    else if (c === "C") { cur.push([+t[i + 4], +t[i + 5]]); i += 6; }
    else if (c === "Z") { if (cur) cur.push(cur[0]); }
    else { cur?.push([+c, +t[i]]); i += 1; }
  }
  return out;
}
const MAT = {
  existe: new THREE.MeshStandardMaterial({ color: 0xd5cfc3, roughness: 0.9 }),
  en_proceso: new THREE.MeshStandardMaterial({ color: 0xc98a2c, roughness: 0.8 }),
  falta: new THREE.MeshStandardMaterial({ color: 0x6f93b8, transparent: true, opacity: 0.2, depthWrite: false }),
};
function ponerParedes(areas, piezas) {
  const lista = { existe: [], en_proceso: [], falta: [] };
  PIEZAS.forEach(([clase, , , d], i) => {
    if (clase !== "muro" && clase !== "columna") return;
    const est = estadoPieza(i, piezas), c = CAJAS[i], cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2;
    if (!lista[est]) return;   // "no va"
    const tipo = tipoEn(areas, cx, cy), base = E.altura(cx, cy) * M;
    if (clase === "columna") {
      const alto = (ALTO_MURO[tipo] || 4.5) * M * (est === "en_proceso" ? 0.5 : 1), lado = Math.max(0.7, Math.min(2.5, c.largo * ESC));
      lista[est].push([cx, cy, lado, lado, 0, base, alto]); return;
    }
    const alto = (ALTO_MURO[tipo] || 1.1) * M * (est === "en_proceso" ? 0.5 : 1);
    for (const pl of polilineas(d)) for (let k = 1; k < pl.length; k++) {
      const [x0, y0] = pl[k - 1], [x1, y1] = pl[k], L = Math.hypot(x1 - x0, y1 - y0);
      if (L < 1.5) continue;
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      lista[est].push([mx, my, L * ESC + 0.35, 0.38, Math.atan2(y1 - y0, x1 - x0), E.altura(mx, my) * M, alto]);
    }
  });
  ponerLamina(piezas, lista);
  const geo = new THREE.BoxGeometry(1, 1, 1), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eje = new THREE.Vector3(0, 1, 0);
  for (const [est, items] of Object.entries(lista)) {
    if (!items.length) continue;
    const im = new THREE.InstancedMesh(geo, MAT[est], items.length);
    items.forEach(([x, y, largo, grueso, ang, base, alto], k) => {
      const p = aEscena(x, y); p.y = base + alto / 2; q.setFromAxisAngle(eje, -ang);
      im.setMatrixAt(k, m4.compose(p, q, new THREE.Vector3(largo, alto, grueso)));
    });
    im.castShadow = est !== "falta"; im.receiveShadow = true; E.edificios.add(im);
  }
}

// Paredes del taller de murito de block con lámina encima (como en obra). Lo que falta o está en construcción va con el estilo de siempre.
const MURITO = 1.2, ALTO_LAMINA = 6;   // metros
const MAT_MURITO = new THREE.MeshStandardMaterial({ color: 0xd8c48c, roughness: 0.95 });
const MAT_LAMINA = new THREE.MeshStandardMaterial({ color: 0x8b949b, roughness: 0.55, metalness: 0.45 });
function ponerLamina(piezas, lista) {
  const murito = [], lamina = [];
  PIEZAS.forEach(([clase, , , d], i) => {
    if (clase !== "lamina") return;
    const est = estadoPieza(i, piezas);
    if (est === "quitado") return;
    for (const pl of polilineas(d)) for (let k = 1; k < pl.length; k++) {
      const [x0, y0] = pl[k - 1], [x1, y1] = pl[k], L = Math.hypot(x1 - x0, y1 - y0);
      if (L < 1.5) continue;
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, base = E.altura(mx, my) * M, ang = Math.atan2(y1 - y0, x1 - x0), largo = L * ESC + 0.2;
      if (est !== "existe") { lista[est].push([mx, my, largo, 0.38, ang, base, ALTO_LAMINA * M * (est === "en_proceso" ? 0.5 : 1)]); continue; }
      murito.push([mx, my, largo, 0.5, ang, base, MURITO * M]);
      lamina.push([mx, my, largo, 0.18, ang, base + MURITO * M, (ALTO_LAMINA - MURITO) * M]);
    }
  });
  const geo = new THREE.BoxGeometry(1, 1, 1), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eje = new THREE.Vector3(0, 1, 0);
  for (const [items, mat] of [[murito, MAT_MURITO], [lamina, MAT_LAMINA]]) {
    if (!items.length) continue;
    const im = new THREE.InstancedMesh(geo, mat, items.length);
    items.forEach(([x, y, largo, grueso, ang, base, alto], k) => {
      const p = aEscena(x, y); p.y = base + alto / 2; q.setFromAxisAngle(eje, -ang);
      im.setMatrixAt(k, m4.compose(p, q, new THREE.Vector3(largo, alto, grueso)));
    });
    im.castShadow = true; im.receiveShadow = true; E.edificios.add(im);
  }
}

// ---------- Gradas: escalones de verdad, de un nivel al otro, con pasamanos ----------
function ponerGradas(piezas) {
  PIEZAS.forEach(([clase, , , d], i) => {
    if (clase !== "grada") return;
    const est = estadoPieza(i, piezas), lineas = polilineas(d).filter((l) => l.length === 2);
    if (!MAT[est]) return;
    // los escalones son las rayas cortas paralelas; las largas son los lados y el pasamanos
    const horiz = lineas.filter(([a, b]) => Math.abs(a[1] - b[1]) < 1), vert = lineas.filter(([a, b]) => Math.abs(a[0] - b[0]) < 1);
    const largo = (l) => Math.hypot(l[1][0] - l[0][0], l[1][1] - l[0][1]);
    const ejeY = horiz.length >= vert.length;                  // escalones horizontales → se sube en Y
    const pasos = (ejeY ? horiz : vert).filter((l) => largo(l) < 40);
    if (pasos.length < 2) return;
    const c = CAJAS[i], k = ejeY ? 1 : 0, o = 1 - k;
    const pos = pasos.map((l) => l[0][k]).sort((a, b) => a - b);
    const ancho0 = Math.min(...pasos.map((l) => Math.min(l[0][o], l[1][o]))), ancho1 = Math.max(...pasos.map((l) => Math.max(l[0][o], l[1][o])));
    const paso = (pos[pos.length - 1] - pos[0]) / (pos.length - 1);
    const ini = pos[0] - paso, fin = pos[pos.length - 1] + paso, mid = (ancho0 + ancho1) / 2;
    const punto = (t, extra = 0) => (ejeY ? [mid, t + extra] : [t + extra, mid]);
    // el nivel se mide pasando el descanso (la grada completa, con pasamanos), no solo los escalones
    const cIni = ejeY ? c.y0 : c.x0, cFin = ejeY ? c.y1 : c.x1;
    let hIni = E.altura(...punto(cIni, -8)) * M, hFin = E.altura(...punto(cFin, 8)) * M;
    if (Math.abs(hFin - hIni) < 0.5) hIni = hFin + 0.6 * EXAGERA * M;   // mismo nivel: unos escalones de banqueta
    const baja = Math.min(hIni, hFin), sube = Math.abs(hFin - hIni), n = Math.max(pos.length + 1, Math.round(sube / (0.18 * EXAGERA * M)));
    const mat = MAT[est], g = new THREE.Group(), fondo = (fin - ini) / n, ancho = (ancho1 - ancho0) * ESC;
    for (let s = 0; s < n; s++) {
      const t = hFin > hIni ? ini + fondo * (s + 0.5) : fin - fondo * (s + 0.5), alto = (sube * (s + 1)) / n;
      const p = aEscena(...punto(t));
      const m = new THREE.Mesh(new THREE.BoxGeometry(ejeY ? ancho : fondo * ESC, alto, ejeY ? fondo * ESC : ancho), mat);
      m.position.set(p.x, baja + alto / 2, p.z); m.castShadow = est !== "falta"; m.receiveShadow = true; g.add(m);
    }
    // descanso arriba, a nivel del piso alto
    const [d0, d1] = hFin > hIni ? [fin, cFin] : [cIni, ini];
    if (d1 - d0 > 1) {
      const p = aEscena(...punto((d0 + d1) / 2)), largoD = (d1 - d0) * ESC;
      const m = new THREE.Mesh(new THREE.BoxGeometry(ejeY ? ancho : largoD, sube, ejeY ? largoD : ancho), mat);
      m.position.set(p.x, baja + sube / 2, p.z); m.castShadow = est !== "falta"; m.receiveShadow = true; g.add(m);
    }
    // pasamanos a los dos lados
    const largoRun = (fin - ini) * ESC, inc = Math.hypot(largoRun, sube), barra = 0.9 * M;
    const matP = new THREE.MeshStandardMaterial({ color: est === "falta" ? 0x6f93b8 : 0x3b4046, transparent: est === "falta", opacity: est === "falta" ? 0.3 : 1, metalness: 0.5 });
    for (const lado of [ancho0, ancho1]) {
      const centro = aEscena(...(ejeY ? [lado, (ini + fin) / 2] : [(ini + fin) / 2, lado]));
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, inc), matP);
      r.position.set(centro.x, baja + sube / 2 + barra, centro.z);
      const ang = Math.atan2(sube, largoRun) * (hFin > hIni ? -1 : 1);
      if (ejeY) r.rotation.x = ang; else { r.rotation.order = "YXZ"; r.rotation.y = Math.PI / 2; r.rotation.x = ang; }
      g.add(r);
      for (const t of [ini, fin]) {
        const q = aEscena(...(ejeY ? [lado, t] : [t, lado])), hq = (t === ini) === (hFin > hIni) ? baja : baja + sube;
        const poste = new THREE.Mesh(new THREE.BoxGeometry(0.15, barra, 0.15), matP); poste.position.set(q.x, hq + barra / 2, q.z); g.add(poste);
      }
    }
    E.edificios.add(g);
  });
}

// ---------- Techos: dos aguas en salas y taller, planos en oficinas ----------
function techo(a, base, alto) {
  const c = caja(a), w = (c.x1 - c.x0) * ESC, h = (c.y1 - c.y0) * ESC, ctr = aEscena((c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2);
  const op = a.estado === "falta" ? 0.1 : a.estado === "en_proceso" ? 0.3 : 0.45;
  const mat = new THREE.MeshStandardMaterial({ color: a.estado === "falta" ? 0x6f93b8 : 0xaab3bb, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false, metalness: 0.3, roughness: 0.6 });
  const g = new THREE.Group(), y = base + alto;
  if (a.tipo === "sala" || a.tipo === "taller") {
    const sube = 1.4 * M, largoX = w >= h, ancho = (largoX ? h : w) / 2, inc = Math.atan2(sube, ancho), lado = Math.hypot(ancho, sube);
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(largoX ? w : lado, largoX ? lado : h), mat);
      m.rotation.x = -Math.PI / 2;
      if (largoX) { m.rotation.x += s * -inc; m.position.set(ctr.x, y + sube / 2, ctr.z + s * ancho / 2); }
      else { m.rotation.y = s * inc; m.position.set(ctr.x + s * ancho / 2, y + sube / 2, ctr.z); }
      g.add(m);
    }
  } else { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, h), mat); m.position.set(ctr.x, y + 0.15, ctr.z); g.add(m); }
  const borde = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, 0.3, h)), new THREE.LineBasicMaterial({ color: 0x3b4046, transparent: true, opacity: a.estado === "falta" ? 0.25 : 0.6 }));
  borde.position.set(ctr.x, y + 0.15, ctr.z); g.add(borde);
  return g;
}

// Techo existente a conservar (AR-01, líneas de "proyección de techo"): estructura metálica amarilla con lámina,
// sobre carros demo, Chery, clientes y sala Nissan. Columnas grandes del plano cada 14 m (x 333 y 713; y 739, 988, 1237).
const TECHO_EXISTENTE = [{ x0: 194, y0: 718, x1: 725, y1: 1011 }, { x0: 238, y0: 1011, x1: 725, y1: 1256 }];
const ALTO_TECHO_EXISTENTE = 7;   // metros sobre el piso de la sala (N 870.00)
function techoExistente() {
  const g = new THREE.Group(); g.userData.techo = true;
  const y = (MEDIO * EXAGERA + ALTO_TECHO_EXISTENTE) * M;
  const lamina = new THREE.MeshStandardMaterial({ color: 0xb9c0c6, metalness: 0.5, roughness: 0.45, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
  const amarillo = new THREE.MeshStandardMaterial({ color: 0xe8b81f, roughness: 0.6, metalness: 0.3 });
  for (const c of TECHO_EXISTENTE) {
    const w = (c.x1 - c.x0) * ESC, h = (c.y1 - c.y0) * ESC, p = aEscena((c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.15, h), lamina); m.position.set(p.x, y, p.z); m.receiveShadow = true; g.add(m);
    // vigas de celosía (amarillas) a lo ancho, cada ~6 m, y la orilla
    const paso = 6 * M, n = Math.max(1, Math.round(h / paso));
    for (let k = 0; k <= n; k++) { const v = new THREE.Mesh(new THREE.BoxGeometry(w, 0.9, 0.35), amarillo); v.position.set(p.x, y - 0.55, p.z - h / 2 + (h * k) / n); v.castShadow = true; g.add(v); }
    for (const s of [-1, 1]) { const v = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.9, h), amarillo); v.position.set(p.x + (s * w) / 2, y - 0.55, p.z); g.add(v); }
  }
  // columnas existentes hasta el techo
  for (const cx of [333, 713]) for (const cy of [739, 988, 1237]) {
    const base = E.altura(cx, cy) * M, alto = y - base, v = aEscena(cx, cy);
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.9, alto, 0.9), amarillo); col.position.set(v.x, base + alto / 2, v.z); col.castShadow = true; g.add(col);
  }
  return g;
}

// La bodega (edificación de block existente) con la otra construcción encima
function bodega(a, base) {
  const c = caja(a), w = (c.x1 - c.x0) * ESC, h = (c.y1 - c.y0) * ESC, ctr = aEscena((c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2);
  const g = new THREE.Group(), piso1 = Math.max(3 * M, ARRIBA * EXAGERA * M - base), piso2 = 3.2 * M;
  const losa = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.5, h + 0.6), new THREE.MeshStandardMaterial({ color: 0xbfb8aa }));
  losa.position.set(ctr.x, base + piso1, ctr.z); losa.castShadow = true;
  const arriba = new THREE.Mesh(new THREE.BoxGeometry(w, piso2, h), new THREE.MeshStandardMaterial({ color: 0x9aa3ab, transparent: true, opacity: 0.55, metalness: 0.4, roughness: 0.5, depthWrite: false }));
  arriba.position.set(ctr.x, base + piso1 + piso2 / 2 + 0.25, ctr.z);
  const lineas = new THREE.LineSegments(new THREE.EdgesGeometry(arriba.geometry), new THREE.LineBasicMaterial({ color: 0x3b4046 }));
  lineas.position.copy(arriba.position);
  const cubierta = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.3, h + 1), new THREE.MeshStandardMaterial({ color: 0x8b949c, metalness: 0.4 }));
  cubierta.position.set(ctr.x, base + piso1 + piso2 + 0.4, ctr.z); cubierta.rotation.z = 0.06; cubierta.castShadow = true;
  // franja naranja = aquí es el receso
  const franja = new THREE.Mesh(new THREE.BoxGeometry(w + 0.7, 0.6, h + 0.7), new THREE.MeshStandardMaterial({ color: NARANJA }));
  franja.position.set(ctr.x, base + piso1 - 0.4, ctr.z);
  g.add(losa, arriba, lineas, cubierta, franja);
  return g;
}

// Rótulos de nivel ("N 871.92") sobre la plataforma más grande de cada nivel, y en las rampas
function rotulosNivel() {
  const porNivel = new Map();
  for (const p of E.niveles.planas) { const area = (p.c.x1 - p.c.x0) * (p.c.y1 - p.c.y0), o = porNivel.get(p.n); if (!o || area > o.area) porNivel.set(p.n, { p, area }); }
  const poner = (texto, x, y, n) => { const s = etiqueta(texto, "#24435e"); s.scale.set(17, 2.1, 1); const v = aEscena(x, y); s.position.set(v.x, EXAGERA * n * M + 3, v.z); E.edificios.add(s); };
  for (const [n, { p }] of porNivel) poner(`N ${(BASE_N + n).toFixed(2)}`, (p.c.x0 + p.c.x1) / 2, p.c.y0 + 18, n);
  for (const r of E.niveles.rampas) {
    const sube = r.n[1] - r.n[0];
    if (Math.abs(sube) > 0.3) poner(`Rampa ${Math.abs(sube).toFixed(1)} m`, (r.c.x0 + r.c.x1) / 2, (r.c.y0 + r.c.y1) / 2, Math.max(...r.n));
  }
}

// Pared dibujada a mano: block, lámina (con murito) o ventanal (murito + vidrio), con su alto y grueso
const MAT_VIDRIO = new THREE.MeshStandardMaterial({ color: 0x9fd0ee, transparent: true, opacity: 0.38, metalness: 0.2, roughness: 0.1, depthWrite: false });
function paredDibujada(e, areas) {
  const [[x0, y0], [x1, y1]] = puntas(e.trazo), L = Math.hypot(x1 - x0, y1 - y0), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const g = new THREE.Group(); g.userData.elemento = e.id; if (L < 1) return g;
  const mat = e.material || "block", altoM = +e.alto || (mat === "lamina" ? ALTO_LAMINA : ALTO_MURO[tipoEn(areas, mx, my)] || 3);
  const grueso = gruesoPared(e) * M, largo = L * ESC + grueso, base = E.altura(mx, my) * M;
  const caja = (desde, alto, material, gr = grueso) => { const m = new THREE.Mesh(new THREE.BoxGeometry(largo, alto, gr), material);
    m.position.set(0, desde + alto / 2, 0); m.castShadow = material !== MAT.falta && material !== MAT_VIDRIO; m.receiveShadow = true; g.add(m); };
  if (e.estado === "falta") caja(0, altoM * M, MAT.falta);
  else if (e.estado === "en_proceso") caja(0, altoM * M * 0.5, MAT.en_proceso);
  else if (mat === "lamina") { caja(0, MURITO * M, MAT_MURITO, grueso * 1.4); caja(MURITO * M, (altoM - MURITO) * M, MAT_LAMINA, grueso * 0.6); }
  else if (mat === "ventanal") { const ant = Math.min(0.9, altoM / 2); caja(0, ant * M, MAT.existe); caja(ant * M, (altoM - ant) * M, MAT_VIDRIO, grueso * 0.5); }
  else caja(0, altoM * M, MAT.existe);
  const p = aEscena(mx, my); g.position.set(p.x, base, p.z); g.rotation.y = -Math.atan2(y1 - y0, x1 - x0);
  return g;
}

function ponerEdificios(areas, elementos = [], piezas = {}) {
  E.edificios.clear(); E.areas = areas;
  ponerParedes(areas, piezas);
  ponerGradas(piezas);
  for (const a of areas) {
    const c = caja(a), base = E.altura((c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2) * M;
    if (a.es_receso) { E.edificios.add(bodega(a, base)); continue; }
    if (ALTO_MURO[a.tipo]) { const t = techo(a, base, ALTO_MURO[a.tipo] * M * (a.estado === "en_proceso" ? 0.5 : 1)); t.userData.techo = true; E.edificios.add(t); }
  }
  E.edificios.add(techoExistente());
  rotulosNivel();
  // Elementos agregados (gradas, jardineras, baños…)
  const ALTO_EL = { grada: 2.2, jardinera: 1.2, bano: 3, muro: 3.5, puerta: 3, columna: 6, bodega: 4, otro: 2 };
  const COL_EL = { grada: 0x8a8f96, jardinera: 0x5f9a45, bano: 0x4f9fd0, muro: 0x3b4046, puerta: 0x6c5a3d, columna: 0x3b4046, bodega: 0xee8420, otro: 0x7d6bb3 };
  for (const e of elementos) {
    if (e.trazo) { E.edificios.add(paredDibujada(e, areas)); continue; }
    const X = (e.x / 100) * ANCHO, Y = (e.y / 100) * ALTO, W = Math.max(2, (e.w / 100) * ANCHO), H = Math.max(2, (e.h / 100) * ALTO);
    const alto = (ALTO_EL[e.tipo] || 2) * (e.estado === "en_proceso" ? 0.5 : 1), c = aEscena(X + W / 2, Y + H / 2);
    const m = new THREE.Mesh(new THREE.BoxGeometry(W * ESC, alto, H * ESC), new THREE.MeshStandardMaterial({
      color: e.estado === "en_proceso" ? 0xc98a2c : COL_EL[e.tipo] || 0x7d6bb3, transparent: e.estado === "falta", opacity: e.estado === "falta" ? 0.18 : 1 }));
    m.position.set(c.x, E.altura(X + W / 2, Y + H / 2) * M + alto / 2, c.z); m.castShadow = e.estado !== "falta"; m.receiveShadow = true; E.edificios.add(m);
  }
  // Árboles del boulevard (a nivel de calle)
  const tronco = new THREE.MeshLambertMaterial({ color: 0x7a5a3a }), copa = new THREE.MeshLambertMaterial({ color: 0x5f8f3e }), yc = CALLE * M;
  for (let i = 0; i < 12; i++) {
    const p = aEscena(45, 120 + i * 112), t = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 4), tronco);
    t.position.set(p.x, yc + 2, p.z); const c = new THREE.Mesh(new THREE.SphereGeometry(3.2 + (i % 3) * 0.5, 10, 8), copa);
    c.position.set(p.x, yc + 6, p.z); c.castShadow = true; t.castShadow = true; E.edificios.add(t, c);
  }
}

// Dos esferas verdes en las puntas de la pared elegida y una línea entre ellas
const MAT_ASA = new THREE.MeshBasicMaterial({ color: 0x9fd400, depthTest: false });
const MAT_LINEA = new THREE.MeshBasicMaterial({ color: 0xc4ee4a, transparent: true, opacity: 0.8, depthTest: false });
function ponerAsas(ab) {
  E.asas.children.forEach((o) => o.geometry?.dispose()); E.asas.clear();
  if (!ab) return;
  const pts = ab.map(([x, y]) => { const v = aEscena(x, y); v.y = E.altura(x, y) * M + 0.6; return v; });
  pts.forEach((v, i) => { const s = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 12), MAT_ASA); s.position.copy(v); s.renderOrder = 10; s.userData.asa = i; E.asas.add(s); });
  const L = pts[0].distanceTo(pts[1]); if (L < 0.1) return;
  const l = new THREE.Mesh(new THREE.BoxGeometry(L, 0.25, 0.25), MAT_LINEA); l.position.copy(pts[0]).add(pts[1]).multiplyScalar(0.5);
  l.rotation.y = -Math.atan2(pts[1].z - pts[0].z, pts[1].x - pts[0].x); l.renderOrder = 9; E.asas.add(l);
}

// Resalta en verde las piezas de un grupo (hover o seleccionada): paredes a su altura, lo demás como franja en el piso
function resaltar(capa, grupo, llave, color = 0x9fd400, opacidad = 0.8) {
  const k = grupo ? grupo.join(",") : "";
  if (E[llave] === k) return; E[llave] = k;
  capa.children.forEach((m) => m.geometry?.dispose()); capa.clear();
  if (!grupo) return;
  const items = [];
  for (const i of grupo) {
    const clase = PIEZAS[i][0], c = CAJAS[i], pared = clase === "muro" || clase === "columna" || clase === "lamina";
    const alto = clase === "lamina" ? ALTO_LAMINA * M : pared ? (ALTO_MURO[tipoEn(E.areas || [], (c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2)] || (clase === "columna" ? 4.5 : 1.1)) * M : 0.35;
    for (const [[x0, y0], [x1, y1]] of segmentos(i)) {
      const L = Math.hypot(x1 - x0, y1 - y0); if (L < 0.5) continue;
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      items.push([mx, my, L * ESC + 0.5, pared ? 0.6 : 0.7, Math.atan2(y1 - y0, x1 - x0), E.altura(mx, my) * M + (pared ? 0 : 0.05), alto + (pared ? 0.15 : 0)]);
    }
  }
  if (!items.length) return;
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: opacidad, depthWrite: false });
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, items.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eje = new THREE.Vector3(0, 1, 0);
  items.forEach(([x, y, largo, grueso, ang, base, alto], n) => {
    const p = aEscena(x, y); p.y = base + alto / 2; q.setFromAxisAngle(eje, -ang);
    im.setMatrixAt(n, m4.compose(p, q, new THREE.Vector3(largo, alto, grueso)));
  });
  im.renderOrder = 5; capa.add(im);
}

function etiqueta(texto, fondo = "rgba(255,255,255,.92)", tinta) {
  const W = 512, cv = document.createElement("canvas"), ctx = cv.getContext("2d"); cv.width = W; cv.height = 64;
  ctx.font = "800 32px Manrope, Arial, sans-serif";
  let t = texto; while (ctx.measureText(t).width > W - 40 && t.length > 4) t = t.slice(0, -2);
  if (t !== texto) t = t.trimEnd() + "…";
  const w = ctx.measureText(t).width + 28;
  ctx.fillStyle = fondo; ctx.beginPath(); ctx.roundRect((W - w) / 2, 8, w, 48, 12); ctx.fill();
  ctx.fillStyle = tinta || (fondo.startsWith("#") ? "#fff" : "#1d2125"); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(t, W / 2, 33);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false }));
  s.scale.set(14, 1.75, 1); s.position.y = 6.6; s.renderOrder = 10; s.userData.texto = texto; return s;
}

function figura(p) {
  const g = new THREE.Group(); g.userData.id = p.id;
  const ropa = new THREE.MeshStandardMaterial({ color: VERDE, roughness: 0.7 });
  const cuerpo = new THREE.Mesh(new THREE.CapsuleGeometry(0.9, 1.8, 4, 10), ropa); cuerpo.position.y = 1.8; cuerpo.castShadow = true;
  const cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 10), new THREE.MeshStandardMaterial({ color: 0xc89b74 })); cabeza.position.y = 4; cabeza.castShadow = true;
  const casco = new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.4 }));
  casco.position.y = 4.15;
  const aro = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.9, 24), new THREE.MeshBasicMaterial({ color: LIMA, side: THREE.DoubleSide }));
  aro.rotation.x = -Math.PI / 2; aro.position.y = 0.08; aro.visible = false;
  // Área tocable más grande que el muñequito
  const toque = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 6), new THREE.MeshBasicMaterial({ visible: false })); toque.position.y = 3;
  const et = etiqueta(p.nombre);
  g.add(cuerpo, cabeza, casco, aro, toque, et);
  Object.assign(g.userData, { ropa, aro, cuerpo, et });
  // tamaño real: ~1.75 m de alto según la escala del plano; el rótulo y el área para tocar se mantienen grandes
  g.scale.setScalar(ESCALA_P); toque.scale.setScalar(2.4); aro.scale.setScalar(1.6); ajustarEtiqueta(et);
  const pos = aEscena(p.x, p.y); pos.y = E.altura(p.x, p.y) * M; g.position.copy(pos); g.userData.destino = pos.clone();
  return g;
}

const ESCALA_P = (1.75 * (ESC / 0.056)) / 4.9;   // el muñequito mide 4.9 unidades sin escalar
function ajustarEtiqueta(et) { const k = 1.15 / ESCALA_P; et.scale.set(14 * k, 1.75 * k, 1); et.position.y = 5.2 + 1.2 * k; }

function ponerPersonas(personas) {
  const vistos = new Set();
  for (const p of personas) {
    vistos.add(p.id);
    let f = E.figuras.get(p.id);
    if (!f) { f = figura(p); E.figuras.set(p.id, f); E.gente.add(f); }
    f.userData.destino = aEscena(p.x, p.y); f.userData.destino.y = E.altura(p.x, p.y) * M;
    if (f.userData.et.userData.texto !== p.nombre) {   // cambió la actividad: nueva etiqueta
      f.remove(f.userData.et); f.userData.et.material.map.dispose(); f.userData.et.material.dispose();
      f.userData.et = etiqueta(p.nombre); ajustarEtiqueta(f.userData.et); f.add(f.userData.et);
    }
    f.userData.ropa.color.setHex(p.almuerzo ? 0x2f7fc4 : p.receso ? NARANJA : VERDE);
    f.userData.aro.visible = !!p.sel;
  }
  for (const [id, f] of E.figuras) if (!vistos.has(id)) { E.gente.remove(f); E.figuras.delete(id); }
}

function animar() {
  if (!E.renderer.domElement.isConnected) { E.corriendo = false; return; }
  requestAnimationFrame(animar);
  const dt = Math.min(0.05, E.reloj.getDelta()), t = E.reloj.elapsedTime;
  for (const f of E.figuras.values()) {
    const d = f.userData.destino, falta = d.clone().sub(f.position); falta.y = 0;
    const dist = falta.length();
    if (dist > 0.05) {
      const paso = Math.min(dist, 22 * dt); f.position.add(falta.normalize().multiplyScalar(paso)); f.position.y = hEscena(f.position.x, f.position.z);
      f.rotation.y = Math.atan2(falta.x, falta.z); f.userData.cuerpo.position.y = 1.8 + Math.abs(Math.sin(t * 14)) * 0.35;
    } else { f.userData.cuerpo.position.y = 1.8; f.position.y = d.y; }
  }
  // que la cámara no se vaya lejos del lote
  const tg = E.controls.target, bx = (ANCHO * ESC) / 2 + 10, bz = (ALTO * ESC) / 2 + 10;
  const cx = Math.max(-bx, Math.min(bx, tg.x)), cz = Math.max(-bz, Math.min(bz, tg.z));
  if (cx !== tg.x || cz !== tg.z) { E.camera.position.x += cx - tg.x; E.camera.position.z += cz - tg.z; tg.x = cx; tg.z = cz; }
  E.controls.update(); E.renderer.render(E.scene, E.camera);
}

// Pone la escena dentro del contenedor y la actualiza con los datos actuales
export function montar(contenedor, { svg, clave, areas, elementos, piezas, personas, handlers, editar = false, seleccion = null, asas = null }) {
  if (!E) crear();
  E.handlers = handlers;
  contenedor.appendChild(E.renderer.domElement); contenedor.appendChild(E.tip); E.tip.hidden = true;
  ajustar();
  if (E.clave !== clave) { E.clave = clave; E.hovKey = E.selKey = "-"; prepararNiveles(areas); ponerTerreno(); ponerPiso(svg); ponerEdificios(areas, elementos, piezas); }
  // Editando: sin techos (para ver las paredes) y con la pieza elegida resaltada
  E.editar = editar; E.gente.visible = !editar; E.renderer.domElement.style.cursor = "";
  E.edificios.children.forEach((o) => { if (o.userData.techo) o.visible = !editar; });
  resaltar(E.hover, null, "hovKey");
  resaltar(E.marcado, editar && seleccion?.length ? seleccion : null, "selKey");
  ponerAsas(asas);
  ponerPersonas(personas);
  if (!E.corriendo) { E.corriendo = true; E.reloj.getDelta(); animar(); }
}

export function vistaInicial() { if (!E) return; E.camera.position.set(-35, 120, 135); E.controls.target.set(0, 0, 5); }

// Acerca la cámara a un punto del plano (unidades del mapa)
export function enfocar(x, y, dist = 30) {
  if (!E) return; const p = aEscena(x, y); p.y = E.altura(x, y) * M;
  E.controls.target.copy(p); E.camera.position.set(p.x - dist * 0.6, p.y + dist * 0.7, p.z + dist);
}
