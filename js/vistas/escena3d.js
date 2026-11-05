// Vista 3D de la obra: el mapa dibujado como piso, los edificios levantados
// y cada trabajador como un muñequito con casco que camina a su área (o a la bodega en el receso).
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { ANCHO, ALTO } from "./mapa-svg.js";

const ESC = 0.1;                                   // unidades del plano → metros de la escena
const ALTURA = { sala: 9, oficinas: 6, taller: 11, servicio: 7 };
const COLOR_MURO = { sala: 0x8fc3e8, oficinas: 0xd9c4a0, taller: 0x8d969e, servicio: 0xc9c3b5 };
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
  suelo.rotation.x = -Math.PI / 2; suelo.position.y = -0.05; suelo.receiveShadow = true; scene.add(suelo);

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

function muros(X, Y, W, H, alto, color, opacidad) {
  const g = new THREE.Group(), grosor = 0.5;
  const mat = new THREE.MeshStandardMaterial({ color, transparent: opacidad < 1, opacity: opacidad, roughness: 0.8 });
  const c = aEscena(X + W / 2, Y + H / 2), w = W * ESC, h = H * ESC;
  [[w, grosor, 0, -h / 2], [w, grosor, 0, h / 2], [grosor, h, -w / 2, 0], [grosor, h, w / 2, 0]].forEach(([sx, sz, dx, dz]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, alto, sz), mat);
    m.position.set(c.x + dx, alto / 2, c.z + dz); m.castShadow = opacidad > 0.6; m.receiveShadow = true; g.add(m);
  });
  const borde = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, alto, h)), new THREE.LineBasicMaterial({ color: 0x2f3337, transparent: true, opacity: 0.55 }));
  borde.position.set(c.x, alto / 2, c.z); g.add(borde);
  return g;
}

function ponerEdificios(areas, elementos = []) {
  E.edificios.clear();
  for (const a of areas) {
    const tipo = a.es_receso ? "receso" : a.tipo;
    const X = (a.x / 100) * ANCHO + 3, Y = (a.y / 100) * ALTO + 3, W = (a.w / 100) * ANCHO - 6, H = (a.h / 100) * ALTO - 6;
    if (tipo === "receso") { E.edificios.add(muros(X, Y, W, H, 4, NARANJA, 0.9)); continue; }
    if (!ALTURA[tipo]) continue;
    // Según su estado: existe = completo · en construcción = a media altura en ocre · falta = fantasma
    if (a.estado === "falta") E.edificios.add(muros(X, Y, W, H, ALTURA[tipo], 0x7f9bb8, 0.14));
    else if (a.estado === "en_proceso") E.edificios.add(muros(X, Y, W, H, ALTURA[tipo] * 0.5, 0xc98a2c, 0.85));
    else E.edificios.add(muros(X, Y, W, H, ALTURA[tipo], COLOR_MURO[tipo], tipo === "sala" ? 0.35 : 0.92));
  }
  // Elementos agregados (gradas, jardineras, baños…)
  const ALTO_EL = { grada: 2.2, jardinera: 1.2, bano: 3, muro: 3.5, puerta: 3, columna: 6, bodega: 4, otro: 2 };
  const COL_EL = { grada: 0x8a8f96, jardinera: 0x5f9a45, bano: 0x4f9fd0, muro: 0x3b4046, puerta: 0x6c5a3d, columna: 0x3b4046, bodega: 0xee8420, otro: 0x7d6bb3 };
  for (const e of elementos) {
    const X = (e.x / 100) * ANCHO, Y = (e.y / 100) * ALTO, W = Math.max(2, (e.w / 100) * ANCHO), H = Math.max(2, (e.h / 100) * ALTO);
    const alto = (ALTO_EL[e.tipo] || 2) * (e.estado === "en_proceso" ? 0.5 : 1), c = aEscena(X + W / 2, Y + H / 2);
    const m = new THREE.Mesh(new THREE.BoxGeometry(W * ESC, alto, H * ESC), new THREE.MeshStandardMaterial({
      color: e.estado === "en_proceso" ? 0xc98a2c : COL_EL[e.tipo] || 0x7d6bb3, transparent: e.estado === "falta", opacity: e.estado === "falta" ? 0.18 : 1 }));
    m.position.set(c.x, alto / 2, c.z); m.castShadow = e.estado !== "falta"; m.receiveShadow = true; E.edificios.add(m);
  }
  // Árboles del boulevard
  const tronco = new THREE.MeshLambertMaterial({ color: 0x7a5a3a }), copa = new THREE.MeshLambertMaterial({ color: 0x5f8f3e });
  for (let i = 0; i < 12; i++) {
    const p = aEscena(45, 120 + i * 112), t = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 4), tronco);
    t.position.set(p.x, 2, p.z); const c = new THREE.Mesh(new THREE.SphereGeometry(3.2 + (i % 3) * 0.5, 10, 8), copa);
    c.position.set(p.x, 6, p.z); c.castShadow = true; t.castShadow = true; E.edificios.add(t, c);
  }
}

function etiqueta(texto) {
  const W = 512, cv = document.createElement("canvas"), ctx = cv.getContext("2d"); cv.width = W; cv.height = 64;
  ctx.font = "800 32px Manrope, Arial, sans-serif";
  let t = texto; while (ctx.measureText(t).width > W - 40 && t.length > 4) t = t.slice(0, -2);
  if (t !== texto) t = t.trimEnd() + "…";
  const w = ctx.measureText(t).width + 28;
  ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.beginPath(); ctx.roundRect((W - w) / 2, 8, w, 48, 12); ctx.fill();
  ctx.fillStyle = "#1d2125"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(t, W / 2, 33);
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
  const pos = aEscena(p.x, p.y); g.position.copy(pos); g.userData.destino = pos.clone();
  return g;
}

function ponerPersonas(personas) {
  const vistos = new Set();
  for (const p of personas) {
    vistos.add(p.id);
    let f = E.figuras.get(p.id);
    if (!f) { f = figura(p); E.figuras.set(p.id, f); E.gente.add(f); }
    f.userData.destino = aEscena(p.x, p.y);
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
      const paso = Math.min(dist, 22 * dt); f.position.add(falta.normalize().multiplyScalar(paso));
      f.rotation.y = Math.atan2(falta.x, falta.z); f.userData.cuerpo.position.y = 1.8 + Math.abs(Math.sin(t * 14)) * 0.35;
    } else f.userData.cuerpo.position.y = 1.8;
  }
  E.controls.update(); E.renderer.render(E.scene, E.camera);
}

// Pone la escena dentro del contenedor y la actualiza con los datos actuales
export function montar(contenedor, { svg, clave, areas, elementos, personas, handlers }) {
  if (!E) crear();
  E.handlers = handlers;
  contenedor.appendChild(E.renderer.domElement);
  ajustar();
  if (E.clave !== clave) { E.clave = clave; ponerPiso(svg); ponerEdificios(areas, elementos); }
  ponerPersonas(personas);
  if (!E.corriendo) { E.corriendo = true; E.reloj.getDelta(); animar(); }
}

export function vistaInicial() { if (!E) return; E.camera.position.set(-35, 120, 135); E.controls.target.set(0, 0, 5); }
