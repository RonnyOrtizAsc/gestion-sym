// Vista 3D de la obra: el mapa dibujado como piso, los edificios levantados
// y cada trabajador como un muñequito con casco que camina a su área (o a la bodega en el receso).
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { ANCHO, ALTO, PIEZAS, CAJAS, estadoPieza } from "./mapa-svg.js";

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
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.maxPolarAngle = 1.32; controls.minDistance = 30; controls.maxDistance = 360;
  controls.target.set(0, 0, 5);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f7a, 1.15));
  const sol = new THREE.DirectionalLight(0xffffff, 1.6);
  sol.position.set(-80, 160, 60); sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -100, right: 100, top: 100, bottom: -100, near: 10, far: 400 });
  scene.add(sol);

  // Terreno alrededor del lote
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshLambertMaterial({ color: 0xb7c99a }));
  suelo.rotation.x = -Math.PI / 2; suelo.position.y = -1.64 * ESC / 0.056 - 0.05; suelo.receiveShadow = true; scene.add(suelo);

  const piso = new THREE.Mesh(new THREE.PlaneGeometry(ANCHO * ESC, ALTO * ESC), new THREE.MeshLambertMaterial({ color: 0xffffff }));
  piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; scene.add(piso);

  const edificios = new THREE.Group(); scene.add(edificios);
  const gente = new THREE.Group(); scene.add(gente);

  E = { renderer, scene, camera, controls, piso, edificios, gente, figuras: new Map(), clave: "", corriendo: false, reloj: new THREE.Clock() };

  // Tocar (sin arrastrar) = seleccionar persona o área
  const ray = new THREE.Raycaster(), p = new THREE.Vector2(); let ini = null;
  renderer.domElement.addEventListener("pointerdown", (e) => (ini = [e.clientX, e.clientY]));
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (!ini || Math.hypot(e.clientX - ini[0], e.clientY - ini[1]) > 8) return; ini = null;
    const r = renderer.domElement.getBoundingClientRect();
    p.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
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
// Metros sobre el piso de las salas (N 868.96). Calle ≈ 867.32, oficinas 870.00,
// plataforma de atrás (taller, rebalse, patio) 871.92, bodega 871.65.
const BASE_N = 868.96, CALLE = -1.64;
const esRampa = (a) => a.tipo === "rampa" || /rampa/i.test(a.nombre || "");
const caja = (a) => ({ x0: (a.x / 100) * ANCHO, y0: (a.y / 100) * ALTO, x1: ((+a.x + +a.w) / 100) * ANCHO, y1: ((+a.y + +a.h) / 100) * ALTO });
function nivelFijo(a) {
  if (a.es_receso) return 2.69;
  const cx = +a.x + a.w / 2, cy = +a.y + a.h / 2;
  if (cx >= 67) return 2.96;                       // plataforma de atrás
  if (a.x >= 51.5 && cy < 5) return 2.96;          // comedor y lockers (arriba)
  if (a.x >= 51.5 && cy < 47) return 2.96;         // rebalse técnico junto al taller
  if (cx >= 41) return 1.04;                       // oficinas y entrega (870.00)
  return 0;                                        // salas y exhibición (868.96)
}
// Prepara la función de altura del terreno: cada área a su nivel; las rampas suben de un nivel al otro
function prepararNiveles(areas) {
  const planas = areas.filter((a) => !esRampa(a)).map((a) => ({ a, c: caja(a), n: nivelFijo(a) }));
  const fuera = (x, y) => x < 0.06 * ANCHO || y > 0.955 * ALTO;   // calle y acera
  const plano = (x, y) => {
    if (fuera(x, y)) return CALLE;
    let mejor = null, d = Infinity;
    for (const p of planas) {
      const dx = Math.max(p.c.x0 - x, 0, x - p.c.x1), dy = Math.max(p.c.y0 - y, 0, y - p.c.y1), dd = dx * dx + dy * dy;
      if (dd < d || (dd === d && dd === 0 && p.n > mejor.n)) { d = dd; mejor = p; }
    }
    return mejor ? mejor.n : 0;
  };
  const rampas = areas.filter(esRampa).map((a) => {
    const c = caja(a), mx = (c.x0 + c.x1) / 2, my = (c.y0 + c.y1) / 2, m = 12;
    const ex = [plano(c.x0 - m, my), plano(c.x1 + m, my)], ey = [plano(mx, c.y0 - m), plano(mx, c.y1 + m)];
    const eje = Math.abs(ex[1] - ex[0]) >= Math.abs(ey[1] - ey[0]) ? "x" : "y";
    return { a, c, eje, n: eje === "x" ? ex : ey };
  });
  E.altura = (x, y) => {
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
    const salto = Math.max(...v.map((o) => Math.abs(o - h))), c = salto > 1.2 ? 0.62 : 1;
    col.set([c, c, c * 0.98], k * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  E.piso.geometry.dispose(); E.piso.geometry = g; E.piso.rotation.x = 0;
  E.piso.material.vertexColors = true; E.piso.material.needsUpdate = true;
}

// ---------- Paredes y columnas del plano (cada pieza con su estado: hecho, en construcción o falta) ----------
const ALTO_MURO = { sala: 6, taller: 7, oficinas: 3.2, servicio: 3.2, receso: 3 };   // metros
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

// La bodega (edificación de block existente) con la otra construcción encima
function bodega(a, base) {
  const c = caja(a), w = (c.x1 - c.x0) * ESC, h = (c.y1 - c.y0) * ESC, ctr = aEscena((c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2);
  const g = new THREE.Group(), piso1 = 3 * M, piso2 = 3.2 * M;
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
  const poner = (texto, x, y, n) => { const s = etiqueta(texto, "#24435e"); s.scale.set(11, 1.4, 1); const v = aEscena(x, y); s.position.set(v.x, n * M + 2.2, v.z); E.edificios.add(s); };
  for (const [n, { p }] of porNivel) poner(`N ${(BASE_N + n).toFixed(2)}`, (p.c.x0 + p.c.x1) / 2, p.c.y0 + 18, n);
  for (const r of E.niveles.rampas) {
    const sube = r.n[1] - r.n[0];
    if (Math.abs(sube) > 0.3) poner(`Rampa ${Math.abs(sube).toFixed(1)} m`, (r.c.x0 + r.c.x1) / 2, (r.c.y0 + r.c.y1) / 2, Math.max(...r.n));
  }
}

function ponerEdificios(areas, elementos = [], piezas = {}) {
  E.edificios.clear();
  ponerParedes(areas, piezas);
  for (const a of areas) {
    const c = caja(a), base = E.altura((c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2) * M;
    if (a.es_receso) { E.edificios.add(bodega(a, base)); continue; }
    if (ALTO_MURO[a.tipo]) E.edificios.add(techo(a, base, ALTO_MURO[a.tipo] * M * (a.estado === "en_proceso" ? 0.5 : 1)));
  }
  rotulosNivel();
  // Elementos agregados (gradas, jardineras, baños…)
  const ALTO_EL = { grada: 2.2, jardinera: 1.2, bano: 3, muro: 3.5, puerta: 3, columna: 6, bodega: 4, otro: 2 };
  const COL_EL = { grada: 0x8a8f96, jardinera: 0x5f9a45, bano: 0x4f9fd0, muro: 0x3b4046, puerta: 0x6c5a3d, columna: 0x3b4046, bodega: 0xee8420, otro: 0x7d6bb3 };
  for (const e of elementos) {
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
  g.scale.setScalar(1.7);   // más grandes para verlos y tocarlos en el celular
  const pos = aEscena(p.x, p.y); pos.y = E.altura(p.x, p.y) * M; g.position.copy(pos); g.userData.destino = pos.clone();
  return g;
}

function ponerPersonas(personas) {
  const vistos = new Set();
  for (const p of personas) {
    vistos.add(p.id);
    let f = E.figuras.get(p.id);
    if (!f) { f = figura(p); E.figuras.set(p.id, f); E.gente.add(f); }
    f.userData.destino = aEscena(p.x, p.y); f.userData.destino.y = E.altura(p.x, p.y) * M;
    if (f.userData.et.userData.texto !== p.nombre) {   // cambió la actividad: nueva etiqueta
      f.remove(f.userData.et); f.userData.et.material.map.dispose(); f.userData.et.material.dispose();
      f.userData.et = etiqueta(p.nombre); f.add(f.userData.et);
    }
    f.userData.ropa.color.setHex(p.receso ? NARANJA : VERDE);
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
  E.controls.update(); E.renderer.render(E.scene, E.camera);
}

// Pone la escena dentro del contenedor y la actualiza con los datos actuales
export function montar(contenedor, { svg, clave, areas, elementos, piezas, personas, handlers }) {
  if (!E) crear();
  E.handlers = handlers;
  contenedor.appendChild(E.renderer.domElement);
  ajustar();
  if (E.clave !== clave) { E.clave = clave; prepararNiveles(areas); ponerTerreno(); ponerPiso(svg); ponerEdificios(areas, elementos, piezas); }
  ponerPersonas(personas);
  if (!E.corriendo) { E.corriendo = true; E.reloj.getDelta(); animar(); }
}

export function vistaInicial() { if (!E) return; E.camera.position.set(-35, 120, 135); E.controls.target.set(0, 0, 5); }
