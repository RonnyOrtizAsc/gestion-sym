// Vista 3D de la obra: el mapa dibujado como piso, los edificios levantados
// y cada trabajador como un muñequito con casco que camina a su área (o a la bodega en el receso).
import * as THREE from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import { medidasArea, ANCHO, ALTO, PIEZAS, CAJAS, estadoPieza, piezaEn, grupoDe, segmentos, puntas, gruesoPared, tramosPared, CHICAS, RAMPAS, rampaDe } from "./mapa-svg.js";

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
    const i = piezaEn(golpe.point.x / ESC + ANCHO / 2, golpe.point.z / ESC + ALTO / 2, 10);
    return CHICAS.has(i) ? -1 : i;   // los cuadritos sueltos del plano no se tocan en 3D
  };
  const puntoSuelo = (cx, cy) => {   // punto del mapa bajo el mouse (sobre lo que se vea primero)
    const r = renderer.domElement.getBoundingClientRect();
    p.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); ray.setFromCamera(p, camera);
    const visible = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
    const golpe = ray.intersectObjects([piso, ...edificios.children], true).find((h) => !h.object.isSprite && visible(h.object));
    return golpe ? [golpe.point.x / ESC + ANCHO / 2, golpe.point.z / ESC + ALTO / 2] : null;
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
    if (e.pointerType !== "mouse") return;
    if (e.buttons) { tip.hidden = true; return; }                // arrastrando: no resaltar
    const ev = { x: e.clientX, y: e.clientY };
    if (pendiente) { pendiente = ev; return; }
    pendiente = ev;
    requestAnimationFrame(() => {
      const { x, y } = pendiente; pendiente = null;
      const q0 = E.editar ? null : puntoSuelo(x, y), i = E.editar ? piezaBajo(x, y) : q0 ? piezaEn(q0[0], q0[1], 3) : -1;
      const grupo = i < 0 || CHICAS.has(i) ? null : grupoDe(i), r = renderer.domElement.getBoundingClientRect();
      if (E.editar) { renderer.domElement.style.cursor = grupo ? "pointer" : ""; resaltar(E.hover, grupo, "hovKey", 0xc4ee4a, 0.5); }
      let html = grupo ? E.handlers?.textoPieza?.(grupo) || "" : "";
      if (!html && !E.editar) {   // sin pared bajo el mouse: el área, con sus medidas
        const p = q0, a = p && (E.areasUlt || []).filter((q) => { const X = (q.x / 100) * ANCHO, Y = (q.y / 100) * ALTO; return p[0] >= X && p[0] <= X + (q.w / 100) * ANCHO && p[1] >= Y && p[1] <= Y + (q.h / 100) * ALTO; }).sort((m, n) => m.w * m.h - n.w * n.h)[0];   // la más chica que contiene el punto
        if (a) html = `<b>${a.nombre}</b><span class="med">${medidasArea(a)}</span>`;
      }
      if (!html) { tip.hidden = true; return; }
      tip.innerHTML = html; tip.hidden = false;
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
const BASE_N = 868.96, CALLE = -1.64, EXAGERA = 1;   // alturas reales (antes se exageraban y los edificios quedaban más altos que en obra)
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
// Lado del boulevard (AR-01), más bajo que las salas; lo separa un murito con barandal en la orilla de las salas (x 330):
//  carriles, carros demo y estacionamiento de clientes: N 868.97 junto a Marca 4 → N 868.15 a medio camino → N 868.32 abajo
//  Exhibición exterior (3) a N 868.32; "Rampa existente" de Carros demo Nissan sube de N 868.32 a Entrega de vehículos (N 869.95)
const LADO_BOULEVARD = [
  { c: { x0: 85, y0: 715, x1: 330, y1: 1310 }, eje: "y", n: [0.01, -0.64], sinRotulo: true },   // baja parejo, sin hundirse en medio (no es rampa)
  { c: { x0: 85, y0: 1310, x1: 352, y1: 1446 }, eje: "y", n: [-0.64, -0.64], sinRotulo: true },
  { c: { x0: 352, y0: 1322, x1: 556, y1: 1446 }, eje: "x", n: [-0.64, 1.04] },   // G-02: rampa de la calle a la oficina
];
// Estado de una rampa del plano: el de la mayoría de sus rayas (se marcan juntas)
const rayasDe = (r) => RAMPAS.find((q) => q.c.x0 < r.c.x1 && q.c.x1 > r.c.x0 && q.c.y0 < r.c.y1 && q.c.y1 > r.c.y0);
function estadoRampa(r, piezas) {
  const q = rayasDe(r); if (!q) return "existe";
  const n = {}; for (const i of q.piezas) { const e = estadoPieza(i, piezas); n[e] = (n[e] || 0) + 1; }
  return Object.entries(n).sort((a, b) => b[1] - a[1])[0][0];
}
// Losa inclinada de una rampa (para la que falta o va a medias, y para resaltarla)
function losaRampa(r, mat, alza = 0.04) {
  const n0 = r.n[0] * EXAGERA * M, n1 = r.n[1] * EXAGERA * M, a = aEscena(r.c.x0, r.c.y0), b = aEscena(r.c.x1, r.c.y1);
  const geo = new THREE.BufferGeometry(), x = r.eje === "x";
  const h = (sx, sz) => (x ? (sx === a.x ? n0 : n1) : (sz === a.z ? n0 : n1)) + alza;
  const v = [[a.x, a.z], [b.x, a.z], [b.x, b.z], [a.x, b.z]].flatMap(([sx, sz]) => [sx, h(sx, sz), sz]);
  geo.setAttribute("position", new THREE.Float32BufferAttribute(v, 3)); geo.setIndex([0, 2, 1, 0, 3, 2]); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat); m.material.side = THREE.DoubleSide; return m;
}
// Prepara la función de altura del terreno: cada área a su nivel; las rampas suben de un nivel al otro
function prepararNiveles(areas, piezas = {}) {
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
    // los lados de la rampa llegan hasta la pared de al lado (la de la bodega): sin zanja entre la rampa y la pared
    const L = 5, cc = eje === "y" ? { ...c, x0: c.x0 - L, x1: c.x1 } : { ...c, y0: c.y0 - L, y1: c.y1 + L };
    if (/circulaci[oó]n central/i.test(a.nombre || "")) return { a, c: { ...cc, y0: 713, y1: 912 }, eje: "y", n: [ABAJO, ARRIBA] };   // fotos: sube junto a la bodega
    return { a, c: cc, eje, n: eje === "x" ? ex : ey };
  });
  const rc = areas.find((a) => /circulaci[oó]n central/i.test(a.nombre || ""));
  if (rc) { const c = caja(rc); rampas.push({ c: { x0: c.x0 - 5, x1: c.x1, y0: 912, y1: c.y1 }, eje: "y", n: [ARRIBA, ARRIBA], sinRotulo: true }); }   // arriba de la rampa: plano
  rampas.unshift(RAMPA_ESTE, ...LADO_BOULEVARD);
  if (estadoRampa(RAMPA_CHERY, piezas) === "existe") rampas.unshift(RAMPA_CHERY);   // mientras no esté hecha, esa franja queda plana
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
// Alturas del AR-08: salas 6.45 (ventanería 3.00 + franja 1.25 + 2.20 a la fascia, fachada y sección A-A),
// oficinas 3.72 (sección B-B), lavado 4.51 con techo al 8% (sección B-B). Taller: estructura propia (ver estructuraTaller).
const ALTO_MURO = { sala: 6.45, taller: 6, oficinas: 3.72, servicio: 3.72, lavado: 4.51, receso: 4.74 };   // receso = ARRIBA × EXAGERA (la bodega llega al nivel de arriba)   // metros
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
    if (CHICAS.has(i)) return;   // cuadritos sueltos del plano (bases, postes): no son paredes
    const est = estadoPieza(i, piezas), c = CAJAS[i], cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2;
    if (!lista[est]) return;   // "no va"
    const tipo = tipoEn(areas, cx, cy), base = E.altura(cx, cy) * M;
    if (enSupervisor(cx, cy) || enFilaNorte(cx, cy)) return;   // supervisor y fila norte del taller se dibujan aparte
    if (clase === "columna") {
      if (enTaller(cx, cy) || enGalera(cx, cy)) return;   // las del taller son de acero y van con su estructura (ver estructuraTaller)
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
    if (enSupervisor(...centro(i))) return;
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

// ===================== Zona del boulevard: lo existente, según fotos (10-nov), G-01 (techos) y G-02 (niveles) =====================
// Techo grande: dos aguas al 9% (cumbrera N-S en x 527) sobre las columnas x 333 y 713; cerchas de celosía BLANCAS de lado a lado,
// largueros ROJOS a lo largo, franjas de lámina traslúcida, orilla roja y, encima de las orillas sur y oeste, el marco blanco
// de la fascia vieja (sin forro; al oeste con malla). Columnas amarillas: base roja; las del muro del oeste, base azul.
// Alero (x 205–333): techo más bajo sobre la franja de abajo, cae 4% hacia el techo grande; celosías AMARILLAS, largueros rojos.
const TECHO_EXISTENTE = [{ x0: 333, y0: 718, x1: 725, y1: 1256 }];
const ALEROS = [{ x0: 205, y0: 718, x1: 333, y1: 1256 }];
const ALTO_TECHO_EXISTENTE = 7;   // metros sobre la plataforma (N 869.9); la fascia nueva va a 6.45–6.70 (AR-08)
const matE = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.25, ...extra });
function barraE(g, a, b, s, mat, s2 = s) { const v = new THREE.Vector3().subVectors(b, a), m = new THREE.Mesh(new THREE.BoxGeometry(s, s2, v.length()), mat); m.position.copy(a).addScaledVector(v, 0.5); m.lookAt(b); m.castShadow = true; g.add(m); return m; }
function panelE(g, pts, mat) { const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pts.flatMap((p) => [p.x, p.y, p.z]), 3)); geo.setIndex([0, 1, 2, 0, 2, 3]); geo.computeVertexNormals(); const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; g.add(m); return m; }
const PA = (x, y, yAbs) => { const v = aEscena(x, y); v.y = yAbs; return v; };   // punto con altura absoluta (escena)
function marcoFascia(g, a, b, alto, malla) {   // marco blanco de la fascia vieja, de a a b (puntos de la escena, abajo)
  const blanco = matE(0xf2f2ee), L = a.distanceTo(b), n = Math.max(2, Math.round(L / (1.5 * M))), up = new THREE.Vector3(0, alto, 0);
  barraE(g, a, b, 0.12, blanco); barraE(g, a.clone().add(up), b.clone().add(up), 0.12, blanco);
  for (let k = 0; k <= n; k++) { const p = a.clone().lerp(b, k / n); barraE(g, p, p.clone().add(up), 0.09, blanco); }
  if (malla) panelE(g, [a, b, b.clone().add(up), a.clone().add(up)], new THREE.MeshStandardMaterial({ color: 0x9aa0a4, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }));
}
function techoExistente() {
  const g = new THREE.Group(); g.userData.techo = true;
  const y = (MEDIO * EXAGERA + ALTO_TECHO_EXISTENTE) * M, m2 = (u) => u * 0.056 * M;
  const lamina = new THREE.MeshStandardMaterial({ color: 0xc3c8cc, metalness: 0.5, roughness: 0.45, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
  const luz = new THREE.MeshStandardMaterial({ color: 0xf3d36b, emissive: 0x4a3a08, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false });
  const blanco = matE(0xeeeeea), rojo = matE(0xb8352b), amarillo = matE(0xe8b81f), azul = matE(0x2d5fb0);
  for (const c of TECHO_EXISTENTE) {
    const XC = 527, hC = y + 0.09 * m2(XC - c.x0), yE = hC - 0.09 * m2(c.x1 - XC);
    const h = (x) => (x <= XC ? y + ((hC - y) * (x - c.x0)) / (XC - c.x0) : hC + ((yE - hC) * (x - XC)) / (c.x1 - XC));
    panelE(g, [PA(c.x0, c.y0, y), PA(XC, c.y0, hC), PA(XC, c.y1, hC), PA(c.x0, c.y1, y)], lamina);
    panelE(g, [PA(XC, c.y0, hC), PA(c.x1, c.y0, yE), PA(c.x1, c.y1, yE), PA(XC, c.y1, hC)], lamina);
    const nB = Math.max(1, Math.round((c.y1 - c.y0) / 107));   // tramos de ~6 m
    for (let k = 0; k <= nB; k++) {   // cerchas blancas de lado a lado
      const yy = c.y0 + ((c.y1 - c.y0) * k) / nB;
      celosia(g, PA(c.x0, yy, y - 0.15), PA(XC, yy, hC - 0.15), 0.8 * M, blanco, 0.1);
      celosia(g, PA(XC, yy, hC - 0.15), PA(c.x1, yy, yE - 0.15), 0.8 * M, blanco, 0.1);
      if (k < nB) for (const [t0, t1] of [[0.25, 0.4], [0.6, 0.75]]) for (const [xa, xb] of [[c.x0, XC], [XC, c.x1]]) {   // tragaluces
        const x0 = xa + (xb - xa) * t0, x1 = xa + (xb - xa) * t1, y0 = yy + 15, y1 = yy + 107 * 0.75;
        panelE(g, [PA(x0, y0, h(x0) + 0.03), PA(x1, y0, h(x1) + 0.03), PA(x1, y1, h(x1) + 0.03), PA(x0, y1, h(x0) + 0.03)], luz);
      }
    }
    for (let x = c.x0; x <= c.x1 + 0.1; x += 27) barraE(g, PA(x, c.y0, h(x) - 0.12), PA(x, c.y1, h(x) - 0.12), 0.14, rojo, 0.25);   // largueros rojos (~1.5 m)
    for (const x of [c.x0, XC, c.x1]) celosia(g, PA(x, c.y0, h(x) - 0.1), PA(x, c.y1, h(x) - 0.1), 0.8 * M, blanco, 0.1);   // vigas a lo largo
    // orilla roja y marco de la fascia vieja (sur y oeste)
    for (const yy of [c.y0, c.y1]) { barraE(g, PA(c.x0, yy, y), PA(XC, yy, hC), 0.12, rojo, 0.5 * M); barraE(g, PA(XC, yy, hC), PA(c.x1, yy, yE), 0.12, rojo, 0.5 * M); }
    for (const x of [c.x0, c.x1]) barraE(g, PA(x, c.y0, h(x)), PA(x, c.y1, h(x)), 0.5 * M, rojo, 0.12);
    marcoFascia(g, PA(c.x0, c.y1, y + 0.1), PA(XC, c.y1, hC + 0.1), 2.2 * M); marcoFascia(g, PA(XC, c.y1, hC + 0.1), PA(c.x1, c.y1, yE + 0.1), 2.2 * M);
    marcoFascia(g, PA(c.x0, c.y0, y + 0.1), PA(c.x0, c.y1, y + 0.1), 2.2 * M, true);
  }
  // alero, más bajo
  for (const c of ALEROS) {
    const hE = y - 1.4 * M, hO = hE + 0.04 * m2(c.x1 - c.x0);
    panelE(g, [PA(c.x0, c.y0, hO), PA(c.x1, c.y0, hE), PA(c.x1, c.y1, hE), PA(c.x0, c.y1, hO)], lamina);
    const nB = Math.max(1, Math.round((c.y1 - c.y0) / 107));
    for (let k = 0; k <= nB; k++) { const yy = c.y0 + ((c.y1 - c.y0) * k) / nB; celosia(g, PA(c.x0, yy, hO - 0.1), PA(c.x1, yy, hE - 0.1), 0.7 * M, amarillo, 0.1); }
    for (let x = c.x0; x <= c.x1 + 0.1; x += 26) { const hx = hO + ((hE - hO) * (x - c.x0)) / (c.x1 - c.x0); barraE(g, PA(x, c.y0, hx - 0.1), PA(x, c.y1, hx - 0.1), 0.14, rojo, 0.25); }
    celosia(g, PA(c.x0, c.y0, hO - 0.1), PA(c.x0, c.y1, hO - 0.1), 0.7 * M, amarillo, 0.1);
    barraE(g, PA(c.x0, c.y0, hO), PA(c.x0, c.y1, hO), 0.4 * M, rojo, 0.12);
    for (const cy of [739, 988, 1237]) {   // columnas del alero sobre la franja de abajo
      const base = E.altura(c.x0 + 4, cy) * M, v = aEscena(c.x0 + 4, cy), alto = hO - 0.2 - base;
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.55, alto, 0.55), amarillo); col.position.set(v.x, base + alto / 2, v.z); col.castShadow = true; g.add(col);
      const pie = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.6 * M, 0.6), azul); pie.position.set(v.x, base + 0.8 * M, v.z); g.add(pie);
    }
  }
  // columnas del techo grande
  for (const cx of [333, 713]) for (const cy of [739, 988, 1237]) {
    const base = E.altura(cx + (cx === 333 ? 4 : 0), cy) * M, alto = y - base, v = aEscena(cx, cy);
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.8, alto, 0.8), amarillo); col.position.set(v.x, base + alto / 2, v.z); col.castShadow = true; g.add(col);
    const pie = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.6 * M, 0.85), cx === 333 && cy !== 1237 ? azul : rojo); pie.position.set(v.x, base + 0.8 * M, v.z); g.add(pie);
  }
  return g;
}

// Lo de abajo del techo grande (fotos): muros de contención con mural, baranda, caseta amarilla, gradas, rótulo y valla de lámina.
function zonaBoulevard() {
  const g = new THREE.Group(), suelo = (x, y) => E.altura(x, y) * M, plat = MEDIO * EXAGERA * M;
  const concreto = matE(0xe6e5df, { roughness: 0.9, metalness: 0 }), mural = matE(0x3f7fcf, { roughness: 0.85, metalness: 0 }), mural2 = matE(0x9a7fc4, { roughness: 0.85, metalness: 0 });
  const caja = (x0, y0, x1, y1, b, t, mat) => { const a = aEscena(x0, y0), c = aEscena(x1, y1), m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.12, Math.abs(c.x - a.x)), Math.max(0.02, t - b), Math.max(0.12, Math.abs(c.z - a.z))), mat);
    m.position.set((a.x + c.x) / 2, (b + t) / 2, (a.z + c.z) / 2); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  // muro del oeste (x 330), de la franja de abajo a la plataforma; el tramo sur pintado (mural)
  for (let y0 = 718; y0 < 1316; y0 += 18) { const y1 = Math.min(1316, y0 + 18), b = suelo(322, (y0 + y1) / 2); caja(328, y0, 332, y1, b, plat + 0.3 * M, concreto); if (y0 > 1130) caja(327.5, y0, 328, y1, b, plat, mural); }
  // muro del sur (y 1316), de x 330 a 450: se va haciendo bajo porque la rampa sube hacia la oficina; con mural
  for (let x0 = 330; x0 < 450; x0 += 10) { const x1 = x0 + 10, b = suelo((x0 + x1) / 2, 1324); if (plat - b < 0.1 * M) continue;
    caja(x0, 1314, x1, 1318, b, plat + 0.3 * M, concreto); caja(x0, 1318, x1, 1318.6, b, plat, x0 < 390 ? mural : mural2); }
  // baranda sobre los muros, cerca de la caseta (gris con barrotes amarillos)
  const gris = matE(0xa9b0b5, { metalness: 0.5 }), amar = matE(0xe2b72c);
  const baranda = (pa, pb) => { const a = PA(pa[0], pa[1], plat + 0.3 * M), b = PA(pb[0], pb[1], plat + 0.3 * M), up = new THREE.Vector3(0, 1.1 * M, 0), L = a.distanceTo(b), n = Math.round(L / (0.12 * M));
    barraE(g, a.clone().add(up), b.clone().add(up), 0.09, gris); barraE(g, a.clone().addScaledVector(up, 0.1), b.clone().addScaledVector(up, 0.1), 0.07, gris);
    for (let k = 0; k <= n; k++) { const p = a.clone().lerp(b, k / n); barraE(g, p, p.clone().add(up), k % 12 ? 0.04 : 0.09, k % 12 ? amar : gris); } };
  baranda([330, 1150], [330, 1316]); baranda([330, 1316], [445, 1316]);
  // caseta (fotos 13:36): bajo el techo grande, junto a la columna amarilla de base roja (x 333, y 1237), con la baranda detrás.
  // Rectangular ~1.7 × 2.2 m, 2.4 m de alto: abajo lámina gris, franja de ventanas con marco blanco, arriba lámina amarilla con techito
  // curvo; puerta de dos hojas oscuras en la cara este.
  const lamG = cuadros("#7c8287", "#6c7277", [14, 1]), lamA = cuadros("#f2d10a", "#e3c200", [14, 1]), marco = matE(0xf4f4f0), vid = new THREE.MeshStandardMaterial({ color: 0x9fb2ba, metalness: 0.5, roughness: 0.15, transparent: true, opacity: 0.8 });
  const X0 = 343, X1 = 373, Y0 = 1214, Y1 = 1253, pc = plat;
  caja(X0, Y0, X1, Y1, pc, pc + 0.12 * M, matE(0x2f3337));
  caja(X0, Y0, X1, Y1, pc + 0.12 * M, pc + 1.15 * M, lamG);
  caja(X0, Y0, X1, Y1, pc + 1.15 * M, pc + 1.25 * M, marco);
  caja(X0 + 0.3, Y0 + 0.3, X1 - 0.3, Y1 - 0.3, pc + 1.25 * M, pc + 1.85 * M, vid);
  for (const t of [0, 0.33, 0.66, 1]) { caja(X0 + (X1 - X0) * t - 0.4, Y0 - 0.2, X0 + (X1 - X0) * t + 0.4, Y0 + 0.4, pc + 1.25 * M, pc + 1.85 * M, marco); caja(X0 - 0.2, Y0 + (Y1 - Y0) * t - 0.4, X0 + 0.4, Y0 + (Y1 - Y0) * t + 0.4, pc + 1.25 * M, pc + 1.85 * M, marco); }
  caja(X0, Y0, X1, Y1, pc + 1.85 * M, pc + 2.4 * M, lamA);
  const cur = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 16, 1, false, 0, Math.PI), matE(0xd9dad4)), ca = aEscena(X0, Y0), cb = aEscena(X1, Y1);
  cur.scale.set((cb.x - ca.x) / 2 + 0.05, cb.z - ca.z, 0.12 * M); cur.rotation.set(Math.PI / 2, 0, 0); cur.position.set((ca.x + cb.x) / 2, pc + 2.4 * M, (ca.z + cb.z) / 2); cur.castShadow = true; g.add(cur);
  caja(X1 - 0.2, Y0 + 6, X1 + 0.3, Y1 - 6, pc + 0.12 * M, pc + 2.3 * M, matE(0x24282c));   // puerta de dos hojas (este)
  // gradas de concreto (foto): pegadas al muro del mural, al lado norte de la rampa; suben hacia el este hasta la plataforma
  for (let k = 0; k < 6; k++) { const x0 = 400 + k * 9, b = suelo(x0 + 4, 1324); caja(x0, 1318, x0 + 9, 1332, b, b + Math.max(0.05, (plat - b) * (k + 1) / 6), concreto); }
  // rótulo: columna alta amarilla con base azul y marco blanco arriba (fotos 5 y 7), junto a la calle
  for (const [x, yy] of [[255, 1432]]) {
    const b = suelo(x, yy), v = aEscena(x, yy), h = 9 * M;
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.6, h, 0.6), matE(0xe8b81f)); col.position.set(v.x, b + h / 2, v.z); g.add(col);
    const pie = new THREE.Mesh(new THREE.BoxGeometry(0.65, 2 * M, 0.65), matE(0x2d5fb0)); pie.position.set(v.x, b + M, v.z); g.add(pie);
    marcoFascia(g, PA(x - 60, yy, b + h - 3 * M), PA(x + 60, yy, b + h - 3 * M), 3 * M);
  }
  // valla de lámina de la obra, por el boulevard y la calle de abajo
  const valla = matE(0xb8bec3, { metalness: 0.55, roughness: 0.4 });
  for (let y0 = 0; y0 < 1440; y0 += 24) { const b = suelo(84, y0 + 12); caja(80, y0, 82, Math.min(1446, y0 + 24), b, b + 2.4 * M, valla); }
  for (let x0 = 82; x0 < 560; x0 += 24) { const b = suelo(x0 + 12, 1442); caja(x0, 1446, x0 + 24, 1448, b, b + 2.4 * M, valla); }
  return g;
}

// Oficina existente de block (G-02 x 555–727 / y 1245–1447; fotos 13:36). Cuerpo azul marino con dos ventanales grandes al oeste.
// Al sur, el pórtico: piso levantado con zócalo de mosaico y gradas al oeste, vitrina de vidrio metida, losa con cielo blanco
// y fascia amarilla (pintura vieja) en la orilla oeste y sur, cargada por dos columnas azul marino en la esquina del pórtico.
const OFI_NISSAN = { x0: 538, x1: 722, y0: 1243, y1: 1449 };
function oficinaExistente() {
  // G-02 (cotas) + fotos 14:10. Edificio de block x 573–720 / y 1245–1447, dos oficinas (muro en y 1345) y baños al noreste.
  // Cara norte: azul marino con el ventanal grande ("VIDRIO" del plano, con persiana clara) y una ventanita.
  // Cara oeste: frente de vidrio (x 573) con dos puertas de 2.50 (y 1318–1338 y 1425–1445); delante el pasillo (x 555–573)
  // levantado con zócalo de mosaico, sus gradas en la esquina noroeste (G-02), una columna, losa con cielo blanco y la fascia
  // amarilla despintada a todo lo largo del frente. Arriba todo termina a la misma altura.
  const g = new THREE.Group(), base = MEDIO * EXAGERA * M, PL = 0.55 * M, TOP = base + PL + 3.4 * M, FAS = 0.95 * M;
  const X0 = 555, XV = 573, X1 = 720, Y0 = 1245, Y1 = 1447;
  const caja = (x0, y0, x1, y1, b, t, mat) => { const a = aEscena(x0, y0), c = aEscena(x1, y1), m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.05, Math.abs(c.x - a.x)), Math.max(0.02, t - b), Math.max(0.05, Math.abs(c.z - a.z))), mat);
    m.position.set((a.x + c.x) / 2, (b + t) / 2, (a.z + c.z) / 2); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  const marino = matE(0x434a63, { metalness: 0 }), columna = matE(0x8d93a6, { metalness: 0 }), blanco = matE(0xf4f3ef, { metalness: 0 }), amarillo = matE(0xd9b746, { metalness: 0 });
  const mosaico = cuadros("#ddd2bf", "#cbbca2", [2, 30]), piso = matE(0xe7e2d8, { metalness: 0 }), persiana = matE(0xdfe6d2, { metalness: 0 });
  const vidrio = new THREE.MeshStandardMaterial({ color: 0xa9c2cc, metalness: 0.3, roughness: 0.05, transparent: true, opacity: 0.25, depthWrite: false });
  const oscuro = new THREE.MeshStandardMaterial({ color: 0x1d2328, metalness: 0.6, roughness: 0.1 }), F = base + PL;
  // piso del edificio y pasillo (zócalo de mosaico)
  caja(X0, Y0, X1, Y1, base, F, mosaico); caja(X0, Y0, X1, Y1, F - 0.01, F, piso);
  // muros: norte, este, sur (azul marino) y el divisorio entre las dos oficinas
  caja(XV, Y0, X1, Y0 + 1.2, F, TOP, marino); caja(X1 - 1.2, Y0, X1, Y1, F, TOP, marino); caja(XV, Y1 - 1.2, X1, Y1, F, TOP, marino);
  caja(XV, 1344, 690, 1346, F, TOP - FAS, blanco);
  caja(XV, Y0, X1, Y1, TOP - FAS, TOP, marino);                                                  // tapa (losa)
  caja(590, Y0 - 0.6, 640, Y0, F + 0.7 * M, F + 2.7 * M, oscuro);                                // ventanal norte
  caja(592, Y0 - 0.9, 638, Y0 - 0.6, F + 0.8 * M, F + 2.6 * M, persiana);
  caja(700, Y0 - 0.6, 708, Y0, F + 1.9 * M, F + 2.6 * M, oscuro);                                 // ventanita
  // frente de vidrio (oeste) con parales y las dos puertas
  caja(XV, Y0 + 1, XV + 0.4, Y1 - 1, F, TOP - FAS, vidrio);
  for (let y = Y0 + 1; y <= Y1 - 1; y += 25) caja(XV - 0.3, y - 0.4, XV + 0.5, y + 0.4, F, TOP - FAS, marino);
  for (const [a, b] of [[1318, 1338], [1425, 1445]]) { caja(XV - 0.3, a, XV + 0.5, a + 0.8, F, F + 2.5 * M, marino); caja(XV - 0.3, b - 0.8, XV + 0.5, b, F, F + 2.5 * M, marino); }
  // pasillo: losa con cielo blanco, fascia amarilla, una columna
  caja(X0, Y0, XV, Y1, TOP - FAS, TOP, blanco);
  caja(X0 - 1.2, Y0 + 1, X0, Y1, TOP - FAS, TOP + 0.08 * M, amarillo);
  caja(X0 + 1, 1343, X0 + 5, 1347, F, TOP - FAS, columna);
  // gradas en la esquina noroeste (G-02): bajan del pasillo hacia el oeste
  for (let k = 0; k < 4; k++) caja(X0 - 4 * (k + 1), Y0 + 2, X0 - 4 * k, Y0 + 20, base, base + (PL * (4 - k)) / 4.4, piso);
  return g;
}

// ---------- Techos existentes del lado de GWM y Marca 4 (G-01) ----------
// Mismo sistema que el techo grande (largueros rojos, celosías blancas), sobre los pedestales del G-02.
// Los triángulos del G-01/G-02 en x 70–310 / y 480–595 y en x 275–548 / y 1316–1445 son RAMPAS, no techos.
const TECHOS_OESTE = [
  { c: { x0: 181, y0: 6, x1: 715, y1: 184 }, t: "agua", baja: "n", pend: 0.09 },        // exhibición GWM
  { c: { x0: 246, y0: 264, x1: 605, y1: 487 }, t: "dos", cumbre: 376, pend: 0.19 },     // entrega y carros demo GWM (fila central de pedestales en y 366)
  { c: { x0: 182, y0: 579, x1: 711, y1: 712 }, t: "agua", baja: "s", pend: 0.21 },      // exhibición Marca 4
  { c: { x0: 136, y0: 273, x1: 236, y1: 485 }, t: "agua", baja: "o", pend: 0.05, alto: 3.8 },   // marquesina junto al boulevard (foto 5)
];
function techosOeste() {
  const g = new THREE.Group(); g.userData.techo = true;
  const lam = new THREE.MeshStandardMaterial({ color: 0xc3c8cc, metalness: 0.45, roughness: 0.5, side: THREE.DoubleSide, transparent: true, opacity: 0.7, depthWrite: false });
  const blanco = matE(0xeeeeea), rojo = matE(0xb8352b), m2 = (u) => u * 0.056;
  for (const r of TECHOS_OESTE) {
    const c = r.c, ALERO = r.alto || 4.5, base = E.altura((c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2) * M, P = (x, y, h) => { const v = aEscena(x, y); v.y = base + h * M; return v; };
    if (r.t === "agua") {
      const ancho = r.baja === "n" || r.baja === "s" ? c.y1 - c.y0 : c.x1 - c.x0, alto = ALERO + r.pend * m2(ancho);
      const h = (x, y) => r.baja === "n" ? ALERO + (alto - ALERO) * (y - c.y0) / (c.y1 - c.y0) : r.baja === "s" ? alto - (alto - ALERO) * (y - c.y0) / (c.y1 - c.y0)
        : r.baja === "o" ? ALERO + (alto - ALERO) * (x - c.x0) / (c.x1 - c.x0) : alto - (alto - ALERO) * (x - c.x0) / (c.x1 - c.x0);
      panelE(g, [P(c.x0, c.y0, h(c.x0, c.y0)), P(c.x1, c.y0, h(c.x1, c.y0)), P(c.x1, c.y1, h(c.x1, c.y1)), P(c.x0, c.y1, h(c.x0, c.y1))], lam);
      const ns = r.baja === "n" || r.baja === "s";
      for (let k = 0; k <= 6; k++) { const t = k / 6; if (ns) { const x = c.x0 + (c.x1 - c.x0) * t; celosia(g, P(x, c.y0, h(x, c.y0) - 0.05), P(x, c.y1, h(x, c.y1) - 0.05), 0.5 * M, blanco, 0.08); }
        else { const y = c.y0 + (c.y1 - c.y0) * t; celosia(g, P(c.x0, y, h(c.x0, y) - 0.05), P(c.x1, y, h(c.x1, y) - 0.05), 0.4 * M, blanco, 0.08); } }
      if (ns) for (let y = c.y0; y <= c.y1; y += 27) barraE(g, P(c.x0, y, h(0, y) - 0.1), P(c.x1, y, h(0, y) - 0.1), 0.12, rojo, 0.22);
      else for (let x = c.x0; x <= c.x1; x += 27) barraE(g, P(x, c.y0, h(x, 0) - 0.1), P(x, c.y1, h(x, 0) - 0.1), 0.12, rojo, 0.22);
      if (r.alto) for (const [x, y] of [[c.x0, c.y0], [c.x0, c.y1], [c.x1, c.y0], [c.x1, c.y1]]) barraE(g, P(x, y, 0), P(x, y, h(x, y)), 0.15, blanco);
    } else {
      const hc = ALERO + r.pend * m2(Math.max(r.cumbre - c.y0, c.y1 - r.cumbre));
      panelE(g, [P(c.x0, c.y0, ALERO), P(c.x1, c.y0, ALERO), P(c.x1, r.cumbre, hc), P(c.x0, r.cumbre, hc)], lam);
      panelE(g, [P(c.x0, r.cumbre, hc), P(c.x1, r.cumbre, hc), P(c.x1, c.y1, ALERO), P(c.x0, c.y1, ALERO)], lam);
      for (let k = 0; k <= 5; k++) { const x = c.x0 + (c.x1 - c.x0) * k / 5; celosia(g, P(x, c.y0, ALERO - 0.05), P(x, r.cumbre, hc - 0.05), 0.5 * M, blanco, 0.08); celosia(g, P(x, r.cumbre, hc - 0.05), P(x, c.y1, ALERO - 0.05), 0.5 * M, blanco, 0.08); }
      for (let y = c.y0; y <= c.y1; y += 27) { const hy = y < r.cumbre ? ALERO + (hc - ALERO) * (y - c.y0) / (r.cumbre - c.y0) : hc - (hc - ALERO) * (y - r.cumbre) / (c.y1 - r.cumbre); barraE(g, P(c.x0, y, hy - 0.1), P(c.x1, y, hy - 0.1), 0.12, rojo, 0.22); }
    }
  }
  return g;
}

// Techo agregado en el plano (p. ej. el de Entrega de vehículos): lámina sobre una armazón, a "alto" metros.
// Falta: transparente. En construcción: solo la armazón. Hecho: armazón y lámina.
function techoElemento(e) {
  const X = (e.x / 100) * ANCHO, Y = (e.y / 100) * ALTO, W = (e.w / 100) * ANCHO, H = (e.h / 100) * ALTO;
  const g = new THREE.Group(); g.userData.techo = true; g.userData.elemento = e.id;
  const c = aEscena(X + W / 2, Y + H / 2), y = E.altura(X + W / 2, Y + H / 2) * M + (+e.alto || 4.5) * M, w = W * ESC, h = H * ESC;
  const marco = e.estado === "falta" ? MAT.falta : e.estado === "en_proceso" ? MAT.en_proceso : new THREE.MeshStandardMaterial({ color: 0x8b949b, metalness: 0.4, roughness: 0.5 });
  const viga = (lx, lz, px, pz) => { const v = new THREE.Mesh(new THREE.BoxGeometry(lx, 0.45, lz), marco); v.position.set(c.x + px, y - 0.3, c.z + pz); v.castShadow = e.estado !== "falta"; g.add(v); };
  viga(w, 0.3, 0, -h / 2); viga(w, 0.3, 0, h / 2); viga(0.3, h, -w / 2, 0); viga(0.3, h, w / 2, 0);
  const n = Math.max(1, Math.round(h / (3 * M))); for (let k = 1; k < n; k++) viga(w, 0.22, 0, -h / 2 + (h * k) / n);   // largueros cada ~3 m
  if (e.estado !== "en_proceso") {
    const lam = e.estado === "falta" ? MAT.falta : new THREE.MeshStandardMaterial({ color: 0xb9c0c6, metalness: 0.5, roughness: 0.45, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, h), lam); m.position.set(c.x, y + 0.1, c.z); g.add(m);
  }
  return g;
}

// ---------- Taller: estructura de acero gris perla (como en obra) ----------
// Columnas en 4 filas de norte a sur (AR-01): pared oeste x 941, dos por dentro x 1083 y x 1190, pared este x 1331.
// Techos del G-01 (ver abajo): lados casi planos y el centro levantado a dos aguas.
const TALLER = { x0: 933, x1: 1337, y0: 60, y1: 715 };
const enTaller = (x, y) => x > TALLER.x0 - 8 && x < TALLER.x1 + 8 && y > TALLER.y0 - 8 && y < TALLER.y1 + 8;
const COLUMNAS_TALLER = [
  ...[64, 177, 356, 535, 710].map((y) => [941, y]),
  ...[356, 536, 709].map((y) => [1083, y]),
  ...[218, 356, 535, 710].map((y) => [1190, y]),
  ...[87, 176, 264, 354, 444, 534].map((y) => [1331, y]),
];
const ALTO_TALLER = 6, SUBE_CENTRO = 1.6;   // metros: aleros de los techos y cumbrera de las cerchas
function estructuraTaller(base) {
  const g = new THREE.Group();
  const perla = new THREE.MeshStandardMaterial({ color: 0xe0b022, metalness: 0.3, roughness: 0.55 });   // columnas y vigas amarillas (foto)
  const lamina = new THREE.MeshStandardMaterial({ color: 0xb4babf, metalness: 0.45, roughness: 0.5, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
  const y = base + ALTO_TALLER * M, z0 = aEscena(0, TALLER.y0 + 5).z, z1 = aEscena(0, TALLER.y1 - 5).z, largo = z1 - z0, zc = (z0 + z1) / 2;
  const X = (x) => aEscena(x, 0).x;
  for (const [cx, cy] of COLUMNAS_TALLER) {   // columnas delgadas de acero
    const v = aEscena(cx, cy), b = E.altura(cx, cy) * M, alto = y - b;
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.45, alto, 0.45), perla); col.position.set(v.x, b + alto / 2, v.z); col.castShadow = true; E.edificios.add(col);   // las columnas se ven también al editar
  }
  // Techos según G-01: franja oeste (941–1085) cae al 2% hacia el oeste; franja este (1192–1331) al 3% hacia el este;
  // el centro (1085–1192) va levantado: paredes cortas abiertas (entra luz y aire) y encima dos aguas al 21% con cumbrera en x 1138.
  const za = aEscena(0, TALLER.y0 + 5).z, zb = aEscena(0, TALLER.y1 - 5).z;
  const Pt = (x, h, z) => new THREE.Vector3(X(x), base + h * M, z);
  const panel = (p0, p1, mat) => {   // franja de lámina de p0 a p1 (en el corte), a todo lo largo
    const geo = new THREE.BufferGeometry(), v = [Pt(p0[0], p0[1], za), Pt(p1[0], p1[1], za), Pt(p1[0], p1[1], zb), Pt(p0[0], p0[1], zb)];
    geo.setAttribute("position", new THREE.Float32BufferAttribute(v.flatMap((q) => [q.x, q.y, q.z]), 3)); geo.setIndex([0, 1, 2, 0, 2, 3]); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; g.add(m);
  };
  const barra = (a, b, s) => { const v = new THREE.Vector3().subVectors(b, a), m = new THREE.Mesh(new THREE.BoxGeometry(s, s, v.length()), perla); m.position.copy(a).addScaledVector(v, 0.5); m.lookAt(b); m.castShadow = true; g.add(m); };
  const m2 = (u) => u * 0.056, H = ALTO_TALLER, CLARO = 1.4, CUMBRE = 0.21 * m2(1138 - 1085);
  const hO = H - 0.02 * m2(1085 - 941), hE = H - 0.03 * m2(1331 - 1192), hC = H + CLARO;
  panel([941, hO], [1085, H], lamina); panel([1192, H], [1331, hE], lamina);                       // franjas de los lados
  panel([1085, hC], [1138, hC + CUMBRE], lamina); panel([1138, hC + CUMBRE], [1192, hC], lamina);   // centro levantado y techado (foto)
  const claro = new THREE.MeshStandardMaterial({ color: 0xdfe6ea, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
  panel([1085, H], [1085, hC], claro); panel([1192, H], [1192, hC], claro);   // paredes cortas de la parte levantada (entra luz)
  const paso = 5 * M, n = Math.max(2, Math.round((zb - za) / paso));
  for (let k = 0; k <= n; k++) {   // marcos cada ~5 m
    const z = za + ((zb - za) * k) / n;
    barra(Pt(941, hO - 0.3, z), Pt(1085, H - 0.3, z), 0.4); barra(Pt(1192, H - 0.3, z), Pt(1331, hE - 0.3, z), 0.4);
    barra(Pt(1085, H - 0.3, z), Pt(1085, hC, z), 0.3); barra(Pt(1192, H - 0.3, z), Pt(1192, hC, z), 0.3);       // paralelos de la parte levantada
    barra(Pt(1085, hC - 0.25, z), Pt(1138, hC + CUMBRE - 0.25, z), 0.4); barra(Pt(1138, hC + CUMBRE - 0.25, z), Pt(1192, hC - 0.25, z), 0.4);
    barra(Pt(1085, H - 0.3, z), Pt(1192, H - 0.3, z), 0.25);                                                   // cuerda de abajo
  }
  for (const [x, h] of [[941, hO], [1085, H], [1085, hC], [1138, hC + CUMBRE], [1192, hC], [1192, H], [1331, hE]]) barra(Pt(x, h - 0.2, za), Pt(x, h - 0.2, zb), 0.22);   // largueros a lo largo
  filaNorteTaller(base, H);
  g.userData.techo = true;   // al editar el plano se esconde, igual que los techos
  return g;
}

// Azulejo a cuadros (foto del taller): textura de dos colores
function cuadros(c1, c2, rep = [40, 4]) {
  const cv = document.createElement("canvas"); cv.width = cv.height = 32; const x = cv.getContext("2d");
  x.fillStyle = c1; x.fillRect(0, 0, 32, 32); x.fillStyle = c2; x.fillRect(0, 0, 16, 16); x.fillRect(16, 16, 16, 16);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.magFilter = THREE.NearestFilter;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 });
}
// Paredes del taller y la fila del norte (Model.pdf para las medidas, fotos para materiales):
//  oeste: azulejo amarillo y blanco abajo, lámina arriba; este: azulejo naranja y blanco abajo, lámina arriba; norte: lámina.
//  Fila norte (y 5–62): bodega de repuestos (x 1028–1143) con estantería azul abierta; lockers (1144–1251) y baños (1252–1336)
//  con pared blanca y naranja abajo, ventanas y puertas como el Model.pdf.
const FILA_NORTE = { x0: 1025, x1: 1338, y0: 3, y1: 66 };
const enFilaNorte = (x, y) => x > FILA_NORTE.x0 && x < FILA_NORTE.x1 && y > FILA_NORTE.y0 && y < FILA_NORTE.y1;
function filaNorteTaller(base, H) {
  const g = E.edificios;
  const caja = (x0, y0, x1, y1, h0, h1, mat) => { const a = aEscena(x0, y0), b = aEscena(x1, y1), m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.15, Math.abs(b.x - a.x)), (h1 - h0) * M, Math.max(0.15, Math.abs(b.z - a.z))), mat);
    m.position.set((a.x + b.x) / 2, base + ((h0 + h1) / 2) * M, (a.z + b.z) / 2); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  const lam = new THREE.MeshStandardMaterial({ color: 0x8f969c, metalness: 0.45, roughness: 0.55 });
  const blanco = new THREE.MeshStandardMaterial({ color: 0xf1efe9, roughness: 0.85 }), naranja = new THREE.MeshStandardMaterial({ color: 0xe8792a, roughness: 0.8 });
  const oscuro = new THREE.MeshStandardMaterial({ color: 0x24282c, roughness: 0.4 }), azul = new THREE.MeshStandardMaterial({ color: 0x2f6fc2, metalness: 0.3, roughness: 0.5 });
  // paredes perimetrales
  caja(939, 66, 943, 700, 0, 1.5, cuadros("#f2f0e8", "#e8c33a", [1, 120])); caja(939, 66, 943, 700, 1.5, H - 0.1, lam);
  caja(1329, 66, 1333, 712, 0, 2.0, cuadros("#f4f2ec", "#e8792a", [1, 120])); caja(1329, 66, 1333, 712, 2.0, H - 0.1, lam);
  caja(925, 3, 1336, 6, 0, H, lam);
  // pared sur de la fila (de x 1144 a 1336) con huecos: [desde, hasta] en x, tipo
  const ALTO = 3.0, yS = 61, pared = (x0, x1) => { if (x1 - x0 < 0.5) return; caja(x0, yS - 1, x1, yS + 1, 0, 1.2, naranja); caja(x0, yS - 1, x1, yS + 1, 1.2, ALTO, blanco); };
  const huecos = [[1171, 1219, "puerta"], [1300, 1316, "puerta"]], ventanas = [[1150, 1166, 1.3, 1.0], [1262, 1276, 2.0, 0.5]];
  let x = 1144; for (const [a, b] of huecos) { pared(x, a); caja(a, yS - 1, b, yS + 1, 2.4, ALTO, blanco); x = b; } pared(x, 1336);
  for (const [a, b, desde, alto] of ventanas) caja(a, yS - 1.4, b, yS + 1.4, desde, desde + alto, oscuro);
  // divisiones entre bodega, lockers y baños, y el fondo
  for (const xd of [1143.5, 1251.5]) { caja(xd - 1, 6, xd + 1, yS, 0, 1.2, naranja); caja(xd - 1, 6, xd + 1, yS, 1.2, ALTO, blanco); }
  // baños: cubículos (Model.pdf) y el mueble del lavamanos frente a la puerta
  for (const xc of [1282, 1303]) caja(xc - 0.6, 6, xc + 0.6, 26, 0, 2.1, blanco);
  caja(1262, 52, 1310, 59, 0, 0.85, new THREE.MeshStandardMaterial({ color: 0xd9d6cf, roughness: 0.4 }));
  // lockers: dos filas de casilleros y una banca al centro
  const metal = new THREE.MeshStandardMaterial({ color: 0x9aa3ab, metalness: 0.5, roughness: 0.45 });
  caja(1146, 7, 1198, 13, 0, 1.9, metal); caja(1146, 52, 1198, 58, 0, 1.9, metal); caja(1150, 31, 1185, 35, 0, 0.45, new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.8 }));
  // bodega de repuestos: estantería azul de dos niveles, abierta al taller
  for (const xb of [1032, 1060, 1088, 1116, 1140]) for (const yb of [8, 58]) caja(xb - 0.5, yb - 0.5, xb + 0.5, yb + 0.5, 0, 4.6, azul);
  for (const h of [0.15, 2.2, 4.4]) { caja(1031, 7, 1141, 9, h, h + 0.15, azul); caja(1031, 57, 1141, 59, h, h + 0.15, azul); }
  caja(1031, 8, 1141, 58, 2.3, 2.38, new THREE.MeshStandardMaterial({ color: 0x5b636b, metalness: 0.4, roughness: 0.5 }));   // entrepiso de la estantería
}

// Jardineras del plano (piezas "jardin"): cajón bajo de concreto con plantas, como en el render
function ponerJardineras(piezas = {}) {
  // Jardineras del plano (render): cajones de concreto claro, escalonados con el terreno, con zacate ornamental bajo.
  // Cada una con su estado: si falta, se ve transparente y sin plantas.
  const grupos = [];
  PIEZAS.forEach(([clase], i) => {
    if (clase !== "jardin") return;
    const c = CAJAS[i], g = grupos.find((q) => c.x0 < q.x1 + 10 && c.x1 > q.x0 - 10 && c.y0 < q.y1 + 10 && c.y1 > q.y0 - 10);
    if (g) { g.x0 = Math.min(g.x0, c.x0); g.x1 = Math.max(g.x1, c.x1); g.y0 = Math.min(g.y0, c.y0); g.y1 = Math.max(g.y1, c.y1); g.i.push(i); }
    else grupos.push({ x0: c.x0, x1: c.x1, y0: c.y0, y1: c.y1, i: [i] });
  });
  const concreto = new THREE.MeshStandardMaterial({ color: 0xd6d3cc, roughness: 0.9 }), tierra = new THREE.MeshStandardMaterial({ color: 0x6b5a40, roughness: 1 });
  const zacate = new THREE.MeshStandardMaterial({ color: 0x8fae3e, roughness: 0.95 });
  for (const q of grupos) {
    const est = (() => { const n = {}; for (const i of q.i) { const e = estadoPieza(i, piezas); n[e] = (n[e] || 0) + 1; } return Object.entries(n).sort((a, b) => b[1] - a[1])[0][0]; })();
    if (est === "quitado") continue;
    const falta = est === "falta", largoX = q.x1 - q.x0 >= q.y1 - q.y0, L = largoX ? q.x1 - q.x0 : q.y1 - q.y0, nT = Math.max(1, Math.round((L * 0.056) / 2.5));   // tramos de ~2.5 m
    for (let k = 0; k < nT; k++) {
      const t0 = k / nT, t1 = (k + 1) / nT, x0 = largoX ? q.x0 + (q.x1 - q.x0) * t0 : q.x0, x1 = largoX ? q.x0 + (q.x1 - q.x0) * t1 : q.x1, y0 = largoX ? q.y0 : q.y0 + (q.y1 - q.y0) * t0, y1 = largoX ? q.y1 : q.y0 + (q.y1 - q.y0) * t1;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, w = (x1 - x0) * ESC - 0.1, h = (y1 - y0) * ESC - 0.1, c = aEscena(cx, cy), base = E.altura(cx, cy) * M, alto = 0.6 * M;
      const caj = new THREE.Mesh(new THREE.BoxGeometry(w, alto, h), falta ? MAT.falta : est === "en_proceso" ? MAT.en_proceso : concreto); caj.position.set(c.x, base + alto / 2, c.z); caj.castShadow = !falta; caj.receiveShadow = true; E.edificios.add(caj);
      if (est !== "existe") continue;
      const top = new THREE.Mesh(new THREE.BoxGeometry(w - 0.3, 0.06, h - 0.3), tierra); top.position.set(c.x, base + alto + 0.02, c.z); E.edificios.add(top);
      const n = Math.max(3, Math.round(w * h * 1.2));   // matas de zacate: conos bajos y finos
      for (let j = 0; j < n; j++) {
        const r = 0.18 + ((j * 37) % 5) * 0.03, m = new THREE.Mesh(new THREE.ConeGeometry(r, 0.5 + ((j * 13) % 4) * 0.1, 6), zacate);
        m.position.set(c.x + (((j * 0.618) % 1) - 0.5) * (w - 0.6), base + alto + 0.3, c.z + (((j * 0.382 + 0.17) % 1) - 0.5) * (h - 0.6)); E.edificios.add(m);
      }
    }
  }
}

// ---------- Oficina del supervisor y la casita del comedor (como están en obra, según las fotos) ----------
// Supervisor: paneles blancos con franja naranja y raya blanca. Cara sur (hacia donde termina la pared de lámina): fila de ventanas.
// Cara oeste (hacia el rebalse técnico): puerta, ventana, puerta y ventanas. Techo delgado sobre cerchas que cubre la caseta y el lado
// de las puertas y baja hacia la pared de lámina; un poste cerca de la cara sur. Sin la fascia de publicidad.
const SUPERVISOR = { x0: 829, x1: 931, y0: 175, y1: 260 }, TECHO_SUP = { x0: 797, x1: 932, y0: 168, y1: 362 }   // techo del G-01; poste en el "PEDESTAL" del G-02;
// Casita del comedor (atrás y a la izquierda): crema con franjas naranjas, techo inclinado hacia el frente (sur) con orilla amarilla.
const CASITA = { x0: 711, x1: 848, y0: 3, y1: 100 };   // G-02: "OFICINA, toda esta edificación es de block", cielo a 2.72 m
const SUBEST = { x0: 848, x1: 930, y0: 3, y1: 82 };   // G-02: "ELÉCTRICO, edificación de block" (la subestación)
const BODEGA_B = { x0: 720, x1: 809, y0: 713, y1: 912 };   // la bodega se dibuja completa (fotos); sus piezas del plano no
const enSupervisor = (x, y) => [SUPERVISOR, CASITA, SUBEST, { x0: 930, x1: 952, y0: 3, y1: 75 }, LAVADO, OFI_NISSAN, BODEGA_B].some((q) => x > q.x0 - 3 && x < q.x1 + 3 && y > q.y0 - 3 && y < q.y1 + 3);
const centro = (i) => [(CAJAS[i].x0 + CAJAS[i].x1) / 2, (CAJAS[i].y0 + CAJAS[i].y1) / 2];
// ---------- Lavado de vehículos (foto): galera abierta hacia el patio de maniobras ----------
// Techo de lámina de una caída (18% hacia la calle, G-01) sobre largueros de celosía blancos; viga de celosía al frente con fascia oxidada.
// Al fondo (sur) pared de lámina con zócalo de bloque pintado de azul; al este pared de bloque con franja azul.
// Postes de tubo blanco al frente y a lo largo del fondo. El frente (norte) queda abierto.
const LAVADO = { x0: 1085, x1: 1337, y0: 1333, y1: 1448 };   // techo del G-01
function celosia(g, a, b, alto, mat, grueso = 0.12) {   // viga de celosía de a a b (puntos de la escena, cuerda de arriba)
  const d = new THREE.Vector3().subVectors(b, a), L = d.length(), n = Math.max(2, Math.round(L / (alto * 1.2)));
  const barra = (p, q) => { const v = new THREE.Vector3().subVectors(q, p), m = new THREE.Mesh(new THREE.BoxGeometry(grueso, grueso, v.length()), mat);
    m.position.copy(p).addScaledVector(v, 0.5); m.lookAt(q); g.add(m); };
  const abajo = new THREE.Vector3(0, -alto, 0), A = a.clone().add(abajo), B = b.clone().add(abajo);
  barra(a, b); barra(A, B);
  for (let k = 0; k < n; k++) { const p = a.clone().addScaledVector(d, k / n), q = a.clone().addScaledVector(d, (k + 1) / n);
    barra(k % 2 ? p : p.clone().add(abajo), k % 2 ? q.clone().add(abajo) : q); }
}
function lavado(base) {
  const g = new THREE.Group(), q = LAVADO, m = MATS_CASETA();
  const blanco = new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.6, metalness: 0.3 });
  const azul = new THREE.MeshStandardMaterial({ color: 0x2f6fb8, roughness: 0.8 }), bloque = new THREE.MeshStandardMaterial({ color: 0x9a9c98, roughness: 0.95 });
  const oxido = new THREE.MeshStandardMaterial({ color: 0xc8962e, roughness: 0.8 }), losa = new THREE.MeshStandardMaterial({ color: 0xc9c7c0, roughness: 0.95 });
  const lam = new THREE.MeshStandardMaterial({ color: 0x9da4aa, metalness: 0.5, roughness: 0.5, side: THREE.DoubleSide });
  const lamT = new THREE.MeshStandardMaterial({ color: 0xb9c0c6, metalness: 0.5, roughness: 0.45, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
  const P = (x, y, h = 0) => { const v = aEscena(x, y); v.y = base + h * M; return v; };
  const caja = (x0, x1, y0, y1, h0, h1, mat) => { const a = P(x0, y0), b = P(x1, y1), w = Math.max(0.12, Math.abs(b.x - a.x)), d = Math.max(0.12, Math.abs(b.z - a.z));
    const k = new THREE.Mesh(new THREE.BoxGeometry(w, (h1 - h0) * M, d), mat); k.position.set((a.x + b.x) / 2, base + ((h0 + h1) / 2) * M, (a.z + b.z) / 2); k.castShadow = k.receiveShadow = true; g.add(k); };
  const FRENTE = 4.51, FONDO = FRENTE - 0.18 * (q.y1 - q.y0) * 0.056,   // 18% hacia la calle (G-01)
    alto = (y) => FRENTE + ((FONDO - FRENTE) * (y - q.y0)) / (q.y1 - q.y0);
  caja(q.x0, q.x1, q.y0, q.y1, 0, 0.12, losa);                                   // losa de concreto
  // fondo: zócalo de bloque azul y lámina hasta el techo
  caja(q.x0, q.x1, q.y1 - 2, q.y1, 0, 1.2, azul); caja(q.x0, q.x1, q.y1 - 1.5, q.y1, 1.2, FONDO, lam);
  // este: bloque con franja azul abajo
  caja(q.x1 - 2.5, q.x1, q.y0 + 8, q.y1, 0, 1.5, azul); caja(q.x1 - 2.5, q.x1, q.y0 + 8, q.y1, 1.5, alto(q.y0 + 8) - 0.1, bloque);
  // postes de tubo blanco: al frente (orillas y centro) y a lo largo del fondo
  const tubo = (x, y, h) => { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, h * M, 10), blanco); const v = P(x, y, h / 2); t.position.copy(v); t.castShadow = true; g.add(t); };
  for (const x of [q.x0 + 4, (q.x0 + q.x1) / 2, q.x1 - 6]) tubo(x, q.y0 + 4, alto(q.y0 + 4) - 0.35);
  for (let k = 0; k <= 4; k++) { const x = q.x0 + 4 + ((q.x1 - q.x0 - 8) * k) / 4; tubo(x, q.y1 - 4, alto(q.y1 - 4) - 0.35); }
  // viga de celosía al frente y largueros de celosía de frente a fondo
  celosia(g, P(q.x0, q.y0 + 4, FRENTE - 0.05), P(q.x1, q.y0 + 4, FRENTE - 0.05), 0.5, blanco, 0.07);
  const nL = 6; for (let k = 0; k <= nL; k++) { const x = q.x0 + 2 + ((q.x1 - q.x0 - 4) * k) / nL; celosia(g, P(x, q.y0, FRENTE - 0.05), P(x, q.y1, FONDO - 0.05), 0.35, blanco, 0.06); }
  // lámina del techo (una caída hacia el fondo) y fascia oxidada al frente
  const a = P((q.x0 + q.x1) / 2, q.y0 - 3, FRENTE), b = P((q.x0 + q.x1) / 2, q.y1, FONDO), w = (q.x1 - q.x0 + 4) * ESC, L = a.distanceTo(b);
  const t = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, L), lamT); t.position.set(a.x, (a.y + b.y) / 2 + 0.06, (a.z + b.z) / 2); t.rotation.x = Math.atan2(a.y - b.y, b.z - a.z) * Math.sign(b.z - a.z); t.receiveShadow = true;
  const techo = new THREE.Group(); techo.userData.techo = true; techo.add(t);
  const f = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18 * M, 0.08), oxido); f.position.set(a.x, a.y - 0.1, a.z); techo.add(f);
  g.add(techo);
  return g;
}
// ---------- Galeras existentes sobre el rebalse y el patio (G-01, levantamiento: planta de techos existente) ----------
// G-01 calza con el AR-01 (ajuste con las columnas de G-02, error ≈ 13 cm). Medidas y pendientes de ahí:
//  Grande (rebalse): x 935–1263, y 712–892, una caída al 9% hacia el norte; al frente (sur, hacia el lavado) la fascia alta.
//  Pequeña (patio): x 1075–1263, y 892–1216, pegada a la grande, una caída al 8% hacia el este (alta del lado de entrega).
//  Entre las galeras y el lindero este queda la rampa, sin techo.
const GALERA = { x0: 935, x1: 1263, y0: 712, y1: 892 }, GALERA_CHICA = { x0: 1075, x1: 1263, y0: 892, y1: 1216 };
const enGalera = (x, y) => [GALERA, GALERA_CHICA].some((q) => x > q.x0 - 3 && x < q.x1 + 3 && y > q.y0 - 3 && y < q.y1 + 3);
function galeras(base) {
  const g = new THREE.Group(), tg = new THREE.Group(); tg.userData.techo = true; g.add(tg);
  const oscuro = new THREE.MeshStandardMaterial({ color: 0x3d4247, metalness: 0.5, roughness: 0.6 }), amarillo = new THREE.MeshStandardMaterial({ color: 0xd9a821, roughness: 0.6 });
  const lam = new THREE.MeshStandardMaterial({ color: 0x8e959b, metalness: 0.5, roughness: 0.5, side: THREE.DoubleSide });
  const lamT = new THREE.MeshStandardMaterial({ color: 0xb4bbc1, metalness: 0.5, roughness: 0.45, side: THREE.DoubleSide, transparent: true, opacity: 0.8, depthWrite: false });
  const fascia = new THREE.MeshStandardMaterial({ color: 0x7d858c, metalness: 0.5, roughness: 0.5, side: THREE.DoubleSide });
  const blancoG = new THREE.MeshStandardMaterial({ color: 0xe6e8e6, metalness: 0.3, roughness: 0.5 });
  const bloque = new THREE.MeshStandardMaterial({ color: 0xe6e3da, roughness: 0.9, side: THREE.DoubleSide });
  const P = (x, y, h = 0) => { const v = aEscena(x, y); v.y = base + h * M; return v; };
  const barra = (grupo, a, b, s, mat) => { const v = new THREE.Vector3().subVectors(b, a), m = new THREE.Mesh(new THREE.BoxGeometry(s, s, v.length()), mat); m.position.copy(a).addScaledVector(v, 0.5); m.lookAt(b); m.castShadow = true; grupo.add(m); };
  const panel = (grupo, pts, mat) => {
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pts.flatMap((p) => [p.x, p.y, p.z]), 3)); geo.setIndex([0, 1, 2, 0, 2, 3]); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; grupo.add(m); return m;
  };
  const metros = (u) => u * 0.056;
  // --- grande: alta al sur, baja al norte (9%) ---
  const q = GALERA, SUR = 6.6, NORTE = SUR - 0.09 * metros(q.y1 - q.y0), hq = (y) => SUR + ((NORTE - SUR) * (q.y1 - y)) / (q.y1 - q.y0);
  panel(tg, [P(q.x0, q.y0, NORTE), P(q.x1, q.y0, NORTE), P(q.x1, q.y1, SUR), P(q.x0, q.y1, SUR)], lamT);
  const X = [q.x0 + 1, (q.x0 + q.x1) / 2, q.x1 - 1];
  for (let k = 0; k <= 6; k++) {   // vigas de norte a sur, sobre columnas en las dos orillas
    const x = q.x0 + 1 + ((q.x1 - q.x0 - 2) * k) / 6;
    barra(tg, P(x, q.y0, NORTE - 0.3), P(x, q.y1, SUR - 0.3), 0.45, oscuro);
  }
  for (const x of X) for (const y of [q.y0 + 1, q.y1 - 1]) barra(g, P(x, y, 0), P(x, y, hq(y) - 0.3), 0.4, oscuro);
  for (let k = 0; k <= 8; k++) { const y = q.y0 + ((q.y1 - q.y0) * k) / 8; barra(tg, P(q.x0, y, hq(y) - 0.12), P(q.x1, y, hq(y) - 0.12), 0.16, amarillo); }   // polines
  panel(g, [P(q.x0, q.y0, 0), P(q.x1, q.y0, 0), P(q.x1, q.y0, NORTE), P(q.x0, q.y0, NORTE)], lam);   // fondo norte de lámina
  // la pared junto a la rampa es la que dibujaste en el plano (x 1247.7)
  const yf = q.y1 + 5; panel(tg, [P(q.x0 - 1, yf, SUR - 1.4), P(q.x1 + 1, yf, SUR - 1.4), P(q.x1 + 1, yf, SUR + 1.2), P(q.x0 - 1, yf, SUR + 1.2)], fascia);   // fascia alta al frente (foto: lámina sobre viga de celosía)
  celosia(tg, P(q.x0, yf - 1, SUR - 1.4), P(q.x1, yf - 1, SUR - 1.4), 0.7 * M, oscuro, 0.12);
  // --- pequeña: alta al oeste (frente a entrega), baja al este (8%) ---
  const c = GALERA_CHICA, OESTE = 5.0, ESTE = OESTE - 0.08 * metros(c.x1 - c.x0), hc = (x) => OESTE + ((ESTE - OESTE) * (x - c.x0)) / (c.x1 - c.x0);
  panel(tg, [P(c.x0, c.y0, OESTE), P(c.x1, c.y0, ESTE), P(c.x1, c.y1, ESTE), P(c.x0, c.y1, OESTE)], lamT);
  for (let k = 0; k <= 5; k++) {
    const y = c.y0 + 1 + ((c.y1 - c.y0 - 2) * k) / 5;
    celosia(tg, P(c.x0, y, OESTE - 0.1), P(c.x1, y, ESTE - 0.1), 0.45 * M, blancoG, 0.08);   // celosías blancas (foto)
    for (const x of [c.x0 + 1, c.x1 - 1]) barra(g, P(x, y, 0), P(x, y, hc(x) - 0.25), 0.3, oscuro);
  }
  barra(tg, P(c.x0, c.y0, OESTE - 0.1), P(c.x0, c.y1, OESTE - 0.1), 0.3, fascia);   // orilla del frente
  barra(tg, P(c.x1 + 2, c.y0, ESTE - 0.2), P(c.x1 + 2, c.y1, ESTE - 0.2), 0.35, fascia);   // canal del lado bajo
  const xw = 1247.7, hw = hc(xw), y0w = 965;   // sigue la pared dibujada (x 1247.7) hasta el final de la galera pequeña
  panel(g, [P(xw, y0w, 0), P(xw, c.y1, 0), P(xw, c.y1, 1.2), P(xw, y0w, 1.2)], bloque);
  panel(g, [P(xw, y0w, 1.2), P(xw, c.y1, 1.2), P(xw, c.y1, hw), P(xw, y0w, hw)], lam);
  return g;
}
const MATS_CASETA = () => ({
  blanco: new THREE.MeshStandardMaterial({ color: 0xe8e6e1, roughness: 0.8 }), crema: new THREE.MeshStandardMaterial({ color: 0xece3cf, roughness: 0.85 }),
  naranja: new THREE.MeshStandardMaterial({ color: 0xe0662e, roughness: 0.8 }), vidrio: new THREE.MeshStandardMaterial({ color: 0x23282d, roughness: 0.3, metalness: 0.4 }),
  alum: new THREE.MeshStandardMaterial({ color: 0xc8ccd0, metalness: 0.6, roughness: 0.4 }), acero: new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.5, roughness: 0.5 }),
  lamina: new THREE.MeshStandardMaterial({ color: 0xb9c0c6, metalness: 0.5, roughness: 0.45, side: THREE.DoubleSide }),
  amarillo: new THREE.MeshStandardMaterial({ color: 0xe8b81f, roughness: 0.6 }), rojo: new THREE.MeshStandardMaterial({ color: 0xc8202a, roughness: 0.7 }),
});
// Caja de paredes con franja naranja (0–0.45 naranja, raya blanca, 0.57–0.95 naranja) y piezas pegadas a sus caras
function caseta(g, q, base, alto, pared, m) {
  const w = (q.x1 - q.x0) * ESC, h = (q.y1 - q.y0) * ESC, c = aEscena((q.x0 + q.x1) / 2, (q.y0 + q.y1) / 2);
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, alto * M, h), pared); b.position.set(c.x, base + (alto * M) / 2, c.z); b.castShadow = b.receiveShadow = true; g.add(b);
  for (const [d, a, mat] of [[0, 0.45, m.naranja], [0.45, 0.12, m.blanco], [0.57, 0.38, m.naranja]]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, a * M, h + 0.06), mat); f.position.set(c.x, base + (d + a / 2) * M, c.z); g.add(f);
  }
  // pieza en una cara: lado "s" (sur), "n", "o" (oeste), "e"; de t0 a t1 a lo largo (unidades del mapa), de "desde" con "a" de alto (m)
  return (lado, t0, t1, desde, a, mat, salir = 0.05) => {
    const L = Math.abs(t1 - t0) * ESC, mid = (t0 + t1) / 2, y = base + (desde + a / 2) * M;
    const v = lado === "s" || lado === "n" ? aEscena(mid, lado === "s" ? q.y1 : q.y0) : aEscena(lado === "o" ? q.x0 : q.x1, mid);
    const geo = lado === "s" || lado === "n" ? new THREE.BoxGeometry(L, a * M, 0.1) : new THREE.BoxGeometry(0.1, a * M, L);
    const p = new THREE.Mesh(geo, mat); p.position.set(v.x + (lado === "o" ? -salir : lado === "e" ? salir : 0), y, v.z + (lado === "s" ? salir : lado === "n" ? -salir : 0)); g.add(p);
  };
}
const puertaV = (cara, lado, t0, t1, m) => { cara(lado, t0 - 0.8, t1 + 0.8, 0, 2.2, m.alum); cara(lado, t0, t1, 0.02, 2.1, m.vidrio, 0.07); };
const ventanas = (cara, lado, t0, t1, n, desde, a, m) => { cara(lado, t0, t1, desde, a, m.vidrio); for (let k = 0; k <= n; k++) { const t = t0 + ((t1 - t0) * k) / n; cara(lado, t - 0.3, t + 0.3, desde, a, m.alum, 0.07); } };
function supervisor(base) {
  const g = new THREE.Group(), m = MATS_CASETA();
  const cara = caseta(g, SUPERVISOR, base, 3, m.blanco, m);
  ventanas(cara, "s", 836, 928, 5, 1.0, 0.75, m);   // cara sur: fila de ventanas
  puertaV(cara, "o", 182, 198, m); ventanas(cara, "o", 200, 220, 1, 1.0, 0.75, m); ventanas(cara, "o", 222, 241, 1, 1.0, 0.75, m); puertaV(cara, "o", 243, 259, m);   // cara oeste: puerta (con espacio a la esquina norte), dos ventanas, puerta pegada a la esquina sur
  // techo (G-01): lámina de x 797 a 932 y de y 168 a 362, cae al 19% hacia el este (la pared de lámina).
  // Lo carga el poste del "PEDESTAL" del G-02 (x 830, y 356), unos 5.4 m al frente de la cabina. Celosías por debajo.
  const t = TECHO_SUP, OESTE = 5.6, ESTE = OESTE - 0.19 * (t.x1 - t.x0) * 0.056, hT = (x) => OESTE + ((ESTE - OESTE) * (x - t.x0)) / (t.x1 - t.x0);
  const P = (x, y, h) => { const v = aEscena(x, y); v.y = base + h * M; return v; };
  const geo = new THREE.BufferGeometry(), pts = [P(t.x0, t.y0, OESTE), P(t.x1, t.y0, ESTE), P(t.x1, t.y1, ESTE), P(t.x0, t.y1, OESTE)];
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pts.flatMap((p) => [p.x, p.y, p.z]), 3)); geo.setIndex([0, 1, 2, 0, 2, 3]); geo.computeVertexNormals();
  const losa = new THREE.Mesh(geo, m.lamina); losa.castShadow = losa.receiveShadow = true; g.add(losa);
  for (const y of [t.y0 + 2, t.y0 + 60, t.y0 + 120, t.y1 - 3]) celosia(g, P(t.x0 + 2, y, OESTE - 0.08), P(t.x1 - 2, y, ESTE - 0.08), 0.35 * M, m.acero, 0.07);   // de oeste a este, con la pendiente
  for (const x of [t.x0 + 3, t.x1 - 3]) celosia(g, P(x, t.y0 + 2, hT(x) - 0.08), P(x, t.y1 - 2, hT(x) - 0.08), 0.35 * M, m.acero, 0.07);
  const px = 830, py = 356, pv = aEscena(px, py), ap = (hT(px) - 0.4) * M;   // poste blanco con pie amarillo
  const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, ap, 12), new THREE.MeshStandardMaterial({ color: 0xf2f2f0, roughness: 0.6 }));
  poste.position.set(pv.x, base + ap / 2, pv.z); poste.castShadow = true; g.add(poste);
  const pie = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.6 * M, 12), m.amarillo); pie.position.set(pv.x, base + 0.3 * M, pv.z); g.add(pie);
  g.add(casita());
  return g;
}
function casita() {
  // G-02 + foto: block crema con franjas naranjas; al frente (sur) ventana, puerta, ventana (ventanas de 1.60 m sobre 0.62 m);
  // ventana también al oeste. Techo de lámina que vuela poco al frente, con viga de celosía blanca y orilla roja,
  // cargado por la columna roja de perfil I del "PEDESTAL" (x 853, y 103) junto a la esquina, con su bajada de agua blanca.
  const g = new THREE.Group(), m = MATS_CASETA(), q = CASITA, base = E.altura((q.x0 + q.x1) / 2, (q.y0 + q.y1) / 2) * M;
  const cara = caseta(g, q, base, 2.9, m.crema, m);
  cara("s", q.x0, q.x1, 1.25, 0.2, m.naranja, 0.04); cara("o", q.y0, q.y1, 1.25, 0.2, m.naranja, 0.04); cara("e", q.y0, q.y1, 1.25, 0.2, m.naranja, 0.04);   // tercera franja
  ventanas(cara, "s", 727, 757, 1, 0.62, 1.6, m); puertaV(cara, "s", 775, 791, m); ventanas(cara, "s", 815, 845, 1, 0.62, 1.6, m);
  ventanas(cara, "o", 38, 68, 1, 0.62, 1.6, m);
  const rojo = new THREE.MeshStandardMaterial({ color: 0xb1281f, roughness: 0.55, metalness: 0.3 }), blanco = new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.6, metalness: 0.2 });
  const T = { x0: 705, x1: 932, y0: 0, y1: 112 }, FRENTE = 4.0, ATRAS = FRENTE - 0.07 * (T.y1 - T.y0) * 0.056;
  const P = (x, y, h) => { const v = aEscena(x, y); v.y = base + h * M; return v; };
  const geo = new THREE.BufferGeometry(), pts = [P(T.x0, T.y0, ATRAS), P(T.x1, T.y0, ATRAS), P(T.x1, T.y1, FRENTE), P(T.x0, T.y1, FRENTE)];
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pts.flatMap((p) => [p.x, p.y, p.z]), 3)); geo.setIndex([0, 1, 2, 0, 2, 3]); geo.computeVertexNormals();
  const lam = new THREE.Mesh(geo, m.lamina); lam.castShadow = lam.receiveShadow = true; g.add(lam);
  const amarillo = new THREE.MeshStandardMaterial({ color: 0xd9a821, roughness: 0.6 });
  for (let x = T.x0; x <= T.x1; x += 27) barraE(g, P(x, T.y0, ATRAS - 0.12), P(x, T.y1, FRENTE - 0.12), 0.12, amarillo, 0.22);   // polines amarillos
  celosia(g, P(T.x0, T.y1 - 1, FRENTE - 0.05), P(T.x1, T.y1 - 1, FRENTE - 0.05), 0.7 * M, blanco, 0.08);   // viga de celosía blanca al frente
  barraE(g, P(T.x0, T.y1, FRENTE), P(T.x1, T.y1, FRENTE), 0.1, rojo, 0.35 * M);   // orilla roja
  // columna roja de perfil I con placa, y bajada de agua blanca
  const v = P(856, 102, 0), hc = (FRENTE - 0.7) * M;
  for (const [sx, sz, dx] of [[0.32, 0.06, 0], [0.06, 0.3, 0.13], [0.06, 0.3, -0.13]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(sx, hc, sz), rojo); p.position.set(v.x, base + hc / 2, v.z + dx); p.castShadow = true; g.add(p); }
  const placa = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.5), rojo); placa.position.set(v.x, base + 0.03, v.z); g.add(placa);
  const tubo = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, FRENTE * M, 10), blanco); const vt = P(849, 102, 0); tubo.position.set(vt.x, base + (FRENTE * M) / 2, vt.z); g.add(tubo);
  g.add(subestacion(base));
  return g;
}

// Subestación (G-02 "ELÉCTRICO" + foto): recinto de block sin techo. Frente (sur): murito celeste oxidado (1.2 m) con malla
// naranja hasta ~3.2 m en marco naranja, portón de barrotes gris claro a la derecha, pilastras celestes en las esquinas.
// Adentro dos transformadores sobre su base. Al lado (este) el cuartito celeste con su puerta.
function subestacion(base) {
  const g = new THREE.Group(), q = SUBEST;
  const caja = (x0, y0, x1, y1, b, t, mat) => { const a = aEscena(x0, y0), c = aEscena(x1, y1), m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.08, Math.abs(c.x - a.x)), (t - b) * M, Math.max(0.08, Math.abs(c.z - a.z))), mat);
    m.position.set((a.x + c.x) / 2, base + ((b + t) / 2) * M, (a.z + c.z) / 2); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  const celeste = new THREE.MeshStandardMaterial({ color: 0x9fc6d6, roughness: 0.9 }), block = cuadros("#a99f95", "#9f958b", [20, 8]);
  const naranja = new THREE.MeshStandardMaterial({ color: 0xec6a1e, roughness: 0.6, metalness: 0.3 }), gris = new THREE.MeshStandardMaterial({ color: 0xc9cbc8, roughness: 0.6, metalness: 0.3 });
  const malla = new THREE.MeshStandardMaterial({ color: 0xf07a2a, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
  const yF = q.y1, xP = 905;
  caja(q.x0, q.y0, q.x0 + 2, q.y1, 0, 3.3, celeste); caja(q.x1 - 3, q.y0, q.x1, q.y1, 0, 3.3, celeste);   // pilastras / paredes laterales
  caja(q.x0, q.y0, q.x1, q.y0 + 2, 0, 3.3, block);                                                         // fondo
  caja(q.x0 + 2, yF - 2, xP, yF, 0, 1.2, celeste);                                                          // murito con óxido
  caja(q.x0 + 2, yF - 1.2, xP, yF - 0.8, 1.2, 3.2, malla);                                                  // malla
  for (const x of [q.x0 + 3, 866, 884, xP]) caja(x - 0.5, yF - 1.5, x + 0.5, yF - 0.5, 1.2, 3.2, naranja);
  for (const h of [1.2, 2.2, 3.2]) caja(q.x0 + 2, yF - 1.5, xP, yF - 0.5, h - 0.05, h + 0.05, naranja);
  // portón de barrotes
  for (let x = xP + 1; x <= q.x1 - 4; x += 2.5) caja(x - 0.3, yF - 1.4, x + 0.3, yF - 0.6, 0, 2.6, gris);
  for (const h of [0.1, 1.1, 2.0, 2.55]) caja(xP + 1, yF - 1.4, q.x1 - 4, yF - 0.6, h, h + 0.08, gris);
  caja(xP, yF - 1.2, q.x1 - 3, yF - 0.8, 2.6, 3.2, malla);
  // transformadores
  const tr = new THREE.MeshStandardMaterial({ color: 0xdfe3e4, metalness: 0.5, roughness: 0.35 });
  caja(868, 30, 920, 55, 0, 0.3, new THREE.MeshStandardMaterial({ color: 0x9a9a95 }));
  for (const x of [880, 905]) { const v = aEscena(x, 42), t = new THREE.Mesh(new THREE.CylinderGeometry(0.55 * M, 0.55 * M, 1.4 * M, 14), tr); t.position.set(v.x, base + (0.3 + 0.7) * M, v.z); t.castShadow = true; g.add(t); }
  // cuartito celeste al este con su puerta
  caja(930, 3, 952, 75, 0, 3.6, celeste); caja(931, 75, 945, 75.6, 0, 2.1, new THREE.MeshStandardMaterial({ color: 0x7f9fae }));
  return g;
}

// La bodega (edificación de block existente) con la otra construcción encima
function bodega(a, base) {
  // Fotos 13:57–13:58 + plano. Planta baja: UN solo volumen de block a todo el ancho; afuera pintado amarillo/crema, y en la
  // cara norte la parte oeste lleva azul abajo (es muro, no otra cosa) con el block gastado en la esquina. En la cara norte,
  // del lado de la rampa, el portón: por fuera se ve el hueco abierto (el portón corre por dentro), reja blanca arriba y un
  // alerito de lámina con ménsulas. Adentro: piso de concreto oscuro, paredes y cielo blancos.
  // Arriba: piso de block café sobre la parte de la rampa; su piso queda al nivel de la rampa donde está la puerta (por ahí se
  // entra). Este (rampa), de sur a norte: ventana, puerta, ventana, ventana, ventana; norte: una ventana de celosía de dos hojas.
  const c = caja(a), W = (c.x1 - c.x0) * ESC, h = (c.y1 - c.y0) * ESC, ctr = aEscena((c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2);
  const dPuerta = 0.71, yPuerta = c.y0 + dPuerta * (c.y1 - c.y0);
  const yRampa = E.altura(c.x1 + 6, yPuerta) * M, g = new THREE.Group(), yb = Math.max(base + 2.9 * M, ARRIBA * EXAGERA * M), piso1 = yb - base, piso2 = 3.0 * M;   // el piso de arriba llega al nivel de arriba de la rampa
  const xE = ctr.x + W / 2, xO = ctr.x - W / 2, zN = ctr.z - h / 2, zS = ctr.z + h / 2, G = 0.2 * M;   // G: grueso del muro
  const box = (x0, x1, y0, y1, z0, z1, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)), mat); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  const crema = new THREE.MeshStandardMaterial({ color: 0xe0c072, roughness: 0.9 }), azul = new THREE.MeshStandardMaterial({ color: 0x3f6aa6, roughness: 0.9 });
  const gastado = new THREE.MeshStandardMaterial({ color: 0xc9c6bf, roughness: 1 }), blanco = new THREE.MeshStandardMaterial({ color: 0xf1f0ec, roughness: 0.9 });
  const pisoOsc = new THREE.MeshStandardMaterial({ color: 0x3b3e42, roughness: 0.9 }), metal = new THREE.MeshStandardMaterial({ color: 0x2a2d30, metalness: 0.4, roughness: 0.6 });
  // planta baja hueca: muros y losa
  const ap = 2.3 * M, xp0 = xE - 0.45 * M - ap, xp1 = xE - 0.45 * M, hp = Math.min(2.4 * M, piso1 - 0.65 * M);   // portón (lado de la rampa)
  box(xO, xE, base, yb, zS - G, zS, crema);                       // sur
  box(xO, xO + G, base, yb, zN, zS, crema);                       // oeste
  box(xE - G, xE, base, yb, zN, zS, crema);                       // este (rampa)
  box(xp1, xE, base, yb, zN, zN + G, crema);                      // norte: pilar junto a la rampa
  box(xp0, xp1, base + hp, yb, zN, zN + G, crema);                // sobre el portón
  box(xO, xp0, base, yb, zN, zN + G, crema);                      // resto del norte
  const xa = xp0 - 0.4 * M;                                       // azul abajo (desde el portón hacia el oeste) y esquina gastada
  box(xO + G, xE - G, base, base + 0.03, zN + G, zS - G, pisoOsc);                       // piso adentro
  box(xO + G, xE - G, yb - 0.25, yb - 0.24, zN + G, zS - G, blanco);                      // cielo
  box(xO + G + 0.02, xE - G - 0.02, base, yb - 0.25, zS - G - 0.03, zS - G - 0.02, blanco);   // paredes de adentro (fondo y lados)
  box(xO + G, xO + G + 0.01, base, yb - 0.25, zN + G, zS - G, blanco); box(xE - G - 0.01, xE - G, base, yb - 0.25, zN + G, zS - G, blanco);
  box(xO, xE, yb - 0.12, yb, zN, zS, crema);                      // losa
  for (let k = 0; k <= 12; k++) box(xp0 + (ap * k) / 12 - 0.02, xp0 + (ap * k) / 12 + 0.02, base + hp - 0.45 * M, base + hp, zN + 0.02, zN + 0.06, blanco);   // reja
  box(xp0, xp1, base + hp - 0.05, base + hp, zN + 0.02, zN + 0.06, blanco);
  const alero = box(xp0 - 0.5 * M, xp1 + 0.5 * M, base + hp + 0.55 * M, base + hp + 0.58 * M, zN - 0.75 * M, zN, new THREE.MeshStandardMaterial({ color: 0x9ea5aa, metalness: 0.5, roughness: 0.5 }));
  alero.rotation.x = -0.1;
  for (const x of [xp0 - 0.3 * M, xp1 + 0.3 * M]) box(x - 0.02, x + 0.02, base + hp + 0.2 * M, base + hp + 0.55 * M, zN - 0.5 * M, zN, metal);   // ménsulas
  // piso de arriba: block café sobre la parte de la rampa
  const w = W, xc = xE - w / 2, block = cuadros("#8f7a66", "#857060", [Math.round(h / 0.4), Math.round(piso2 / 0.4)]);
  box(xE - w, xE, yb, yb + piso2, zN, zS, block);
  box(xE - w - 0.02, xE + 0.02, yb + piso2, yb + piso2 + 0.1, zN - 0.02, zS + 0.02, new THREE.MeshStandardMaterial({ color: 0x7a6656, roughness: 0.95 }));
  const celosia = new THREE.MeshStandardMaterial({ color: 0x9aa3a8, metalness: 0.4, roughness: 0.45 });
  const zd = (d) => zN + d * h;   // d: fracción desde el norte
  const huecoE = (mat, an, alto, desde, d) => box(xE, xE + 0.08, yb + desde * M, yb + (desde + alto) * M, zd(d) - (an * M) / 2, zd(d) + (an * M) / 2, mat);
  for (const [d, an] of [[0.91, 1.4], [0.5, 1.3], [0.29, 1.2], [0.09, 1.1]]) huecoE(celosia, an, 1.2, 0.9, d);
  huecoE(new THREE.MeshStandardMaterial({ color: 0xcfd2d4 }), 1.1, 2.25, 0, dPuerta); const pu = huecoE(new THREE.MeshStandardMaterial({ color: 0x2f3438 }), 0.9, 2.15, 0, dPuerta); pu.position.x += 0.02;
  { const n = Math.max(1, Math.round((yb - yRampa) / (0.18 * M))), con = new THREE.MeshStandardMaterial({ color: 0xbdbab3, roughness: 0.95 });   // gradas de la rampa a la puerta
    for (let k = 0; k < n; k++) box(xE, xE + (0.3 * (n - k)) * M, yRampa - 0.2 * M, yRampa + ((yb - yRampa) * (k + 1)) / n, zd(dPuerta) - 0.7 * M, zd(dPuerta) + 0.7 * M, con); }
  box(xc - 0.12 * w - 0.85 * M, xc - 0.12 * w + 0.85 * M, yb + 0.9 * M, yb + 2.0 * M, zN - 0.06, zN, celosia);   // ventana del norte
  return g;
}

// Rótulos de nivel ("N 871.92") sobre la plataforma más grande de cada nivel, y en las rampas
function rotulosNivel() {
  const porNivel = new Map();
  for (const p of E.niveles.planas) { const area = (p.c.x1 - p.c.x0) * (p.c.y1 - p.c.y0), o = porNivel.get(p.n); if (!o || area > o.area) porNivel.set(p.n, { p, area }); }
  const poner = (texto, x, y, n) => { const s = etiqueta(texto, "#24435e"); s.scale.set(17, 2.1, 1); const v = aEscena(x, y); s.position.set(v.x, EXAGERA * n * M + 3, v.z); E.edificios.add(s); };
  for (const [n, { p }] of porNivel) poner(`N ${(BASE_N + n).toFixed(2)}`, (p.c.x0 + p.c.x1) / 2, p.c.y0 + 18, n);
  for (const r of E.niveles.rampas) {
    if (r.sinRotulo) continue;
    const sube = r.n[1] - r.n[0];
    if (Math.abs(sube) > 0.3) poner(`Rampa ${Math.abs(sube).toFixed(1)} m`, (r.c.x0 + r.c.x1) / 2, (r.c.y0 + r.c.y1) / 2, Math.max(...r.n));
  }
}

// Pared dibujada a mano: block, lámina (con murito) o ventanal (murito + vidrio), con su alto y grueso
const MAT_AMARILLO = new THREE.MeshStandardMaterial({ color: 0xe0c46c, roughness: 0.9 });
const MAT_VIDRIO = new THREE.MeshStandardMaterial({ color: 0x9fd0ee, transparent: true, opacity: 0.38, metalness: 0.2, roughness: 0.1, depthWrite: false });
function paredDibujada(e, areas) {
  const { a, b, L, solidos, huecos } = tramosPared(e), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const g = new THREE.Group(); g.userData.elemento = e.id; if (L < 1) return g;
  // El piso puede cambiar a lo largo de la pared (rampa, escalón): arranca desde lo más bajo para no flotar, y el alto se mide desde lo más alto
  const pisos = [0, 0.25, 0.5, 0.75, 1].map((t) => E.altura(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t) * M);
  const base = Math.min(...pisos), alto0 = Math.max(...pisos) - base;
  // pegada a la bodega y con alto automático: sube hasta la losa de la bodega
  const bod = areas.find((q) => q.es_receso), cb = bod && caja(bod), cerca = 5;
  const enBodega = cb && mx > cb.x0 - cerca && mx < cb.x1 + cerca && my > cb.y0 - cerca && my < cb.y1 + cerca;
  const mat = e.material || "block";
  const altoM = +e.alto ? alto0 / M + +e.alto
    : enBodega ? Math.max(3 * M, ARRIBA * EXAGERA * M - E.altura((cb.x0 + cb.x1) / 2, (cb.y0 + cb.y1) / 2) * M) / M + (E.altura((cb.x0 + cb.x1) / 2, (cb.y0 + cb.y1) / 2) * M - base) / M
    : alto0 / M + (mat === "lamina" ? ALTO_LAMINA : ALTO_MURO[tipoEn(areas, mx, my)] || 3);
  const grueso = gruesoPared(e) * M, falta = e.estado === "falta", proceso = e.estado === "en_proceso";
  // un pedazo de pared entre s0 y s1 (unidades del mapa desde la punta a), de "desde" a "desde + alto" (metros)
  const trozo = (s0, s1, desde, alto, material, gr = grueso) => {
    if (s1 - s0 < 0.2 || alto <= 0) return;
    const m = new THREE.Mesh(new THREE.BoxGeometry((s1 - s0) * ESC + (s0 <= 0 || s1 >= L ? grueso / 2 : 0), alto * M, gr), material);
    m.position.set(((s0 + s1) / 2 - L / 2) * ESC, (desde + alto / 2) * M, 0);
    m.castShadow = material !== MAT.falta && material !== MAT_VIDRIO; m.receiveShadow = true; g.add(m);
  };
  const tope = proceso ? altoM * 0.5 : altoM, macizo = falta ? MAT.falta : proceso ? MAT.en_proceso : enBodega && !+e.alto ? MAT_AMARILLO : MAT.existe;   // la pared de abajo de la bodega está pintada de amarillo (foto)
  for (const [s0, s1] of solidos) {
    if (falta || proceso || mat === "block") trozo(s0, s1, 0, tope, macizo);
    else if (mat === "lamina") { trozo(s0, s1, 0, MURITO, MAT_MURITO, grueso * 1.4); trozo(s0, s1, MURITO, altoM - MURITO, MAT_LAMINA, grueso * 0.6); }
    else { const ant = Math.min(0.9, altoM / 2); trozo(s0, s1, 0, ant, MAT.existe); trozo(s0, s1, ant, altoM - ant, MAT_VIDRIO, grueso * 0.5); }
  }
  // huecos: la puerta deja el paso libre hasta 2.1 m; la ventana lleva antepecho de 0.9 m, vidrio y dintel
  const dintel = Math.min(2.1, tope - 0.1);
  for (const h of huecos) {
    trozo(h.s0, h.s1, dintel, tope - dintel, macizo);
    if (h.t === "ventana") { trozo(h.s0, h.s1, 0, Math.min(0.9, dintel), macizo); if (!falta) trozo(h.s0, h.s1, 0.9, dintel - 0.9, MAT_VIDRIO, grueso * 0.3); }
  }
  const p = aEscena(mx, my); g.position.set(p.x, base, p.z); g.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
  return g;
}

function ponerEdificios(areas, elementos = [], piezas = {}) {
  E.edificios.clear(); E.areas = areas;
  ponerParedes(areas, piezas);
  ponerGradas(piezas);
  const eRampa = estadoRampa(RAMPA_CHERY, piezas);
  if (eRampa === "falta" || eRampa === "en_proceso") E.edificios.add(losaRampa(RAMPA_CHERY, MAT[eRampa].clone()));
  for (const a of areas) {
    const c = caja(a), base = E.altura((c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2) * M;
    if (a.es_receso) { E.edificios.add(bodega(a, base)); continue; }
    if (/^taller$/i.test(a.nombre || "")) { E.edificios.add(estructuraTaller(base)); continue; }
    if (/supervisor/i.test(a.nombre || "")) { E.edificios.add(supervisor(base)); continue; }
    if (/lavado/i.test(a.nombre || "")) { E.edificios.add(lavado(base)); continue; }
    if (/sucursal/i.test(a.nombre || "") && a.estado === "existe") { E.edificios.add(oficinaExistente()); continue; }
    if (/comedor/i.test(a.nombre || "")) continue;   // la fila norte (casita, bodega de repuestos, lockers, baños) se dibuja aparte
    const bajoTechoExistente = TECHO_EXISTENTE.some((t) => { const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2; return cx > t.x0 && cx < t.x1 && cy > t.y0 && cy < t.y1; });
    if (ALTO_MURO[a.tipo] && !bajoTechoExistente) { const t = techo(a, base, ALTO_MURO[a.tipo] * M * (a.estado === "en_proceso" ? 0.5 : 1)); t.userData.techo = true; E.edificios.add(t); }
  }
  E.edificios.add(techoExistente());
  E.edificios.add(techosOeste());
  E.edificios.add(zonaBoulevard());
  E.edificios.add(galeras(E.altura(1100, 850) * M));
  ponerJardineras(piezas);
  rotulosNivel();
  // Elementos agregados (gradas, jardineras, baños…)
  const ALTO_EL = { grada: 2.2, jardinera: 1.2, bano: 3, muro: 3.5, puerta: 3, columna: 6, bodega: 4, otro: 2 };
  const COL_EL = { grada: 0x8a8f96, jardinera: 0x5f9a45, bano: 0x4f9fd0, muro: 0x3b4046, puerta: 0x6c5a3d, columna: 0x8d8a80, bodega: 0xee8420, techo: 0x8b949b, otro: 0x7d6bb3 };
  for (const e of elementos) {
    if (e.trazo) { const [[ax, ay], [bx, by]] = puntas(e.trazo); if (!enSupervisor((ax + bx) / 2, (ay + by) / 2)) E.edificios.add(paredDibujada(e, areas)); continue; }
    if (e.tipo === "techo") { E.edificios.add(techoElemento(e)); continue; }
    const X = (e.x / 100) * ANCHO, Y = (e.y / 100) * ALTO, W = Math.max(2, (e.w / 100) * ANCHO), H = Math.max(2, (e.h / 100) * ALTO);
    const alto = (+e.alto ? e.alto * M : ALTO_EL[e.tipo] || 2) * (e.estado === "en_proceso" ? 0.5 : 1), c = aEscena(X + W / 2, Y + H / 2);
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
  const r = rampaDe(grupo[0]);
  if (r) {   // la rampa se resalta entera, como una losa inclinada
    const nivel = r.c.x0 < RAMPA_CHERY.c.x1 && r.c.x1 > RAMPA_CHERY.c.x0 && r.c.y0 < RAMPA_CHERY.c.y1 && r.c.y1 > RAMPA_CHERY.c.y0 ? RAMPA_CHERY.n : [E.altura(r.c.x0, r.c.y0) / EXAGERA, E.altura(r.c.x1, r.c.y1) / EXAGERA];
    const m = losaRampa({ c: r.c, eje: r.eje, n: nivel }, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: opacidad * 0.7, depthWrite: false }), 0.12);
    m.renderOrder = 5; capa.add(m); return;
  }
  const items = [];
  for (const i of grupo) {
    const clase = PIEZAS[i][0], c = CAJAS[i], pared = ((clase === "muro" || clase === "columna") && !CHICAS.has(i)) || clase === "lamina";
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
  E.areasUlt = areas;
  if (E.clave !== clave) { E.clave = clave; E.hovKey = E.selKey = "-"; prepararNiveles(areas, piezas); ponerTerreno(); ponerPiso(svg); ponerEdificios(areas, elementos, piezas); }
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
