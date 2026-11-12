// Permite instalar Gestión SYM como app y abrirla aunque la señal esté mala.
// Siempre intenta traer la versión nueva primero; si no hay internet, usa la guardada.
// Los datos (Supabase) nunca se guardan aquí: siempre vienen en vivo.
const CACHE = "gestion-sym-v118";
const ARCHIVOS = ["./", "index.html", "css/app.css", "js/app.js", "js/datos.js", "js/util.js", "js/config.js",
  "js/vistas/obra.js", "js/vistas/recesos.js", "js/vistas/herramientas.js", "js/vistas/mas.js", "js/vistas/anticipos.js", "js/vistas/fotos.js",
  "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    // "no-cache": siempre pregunta al servidor si hay versión nueva antes de usar la guardada
    fetch(e.request, { cache: "no-cache" }).then((r) => { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); return r; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("index.html")))
  );
});

// Avisos de receso: llegan del servidor cada 5 minutos mientras alguien sigue en receso
self.addEventListener("push", (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: "Gestión SYM", body: e.data?.text() || "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Gestión SYM", {
    body: d.body || "", tag: d.tag || "aviso", renotify: true, icon: "icons/icon-192.png", badge: "icons/icon-192.png",
    vibrate: [200, 100, 200], data: { url: d.url || "./#recesos" } }));
});
// Al tocar el aviso: abre la app en Recesos (o la trae al frente si ya estaba abierta)
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "./#recesos", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
    const c = cs.find((x) => x.url.startsWith(self.registration.scope));
    if (c) { c.navigate(url).catch(() => {}); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
