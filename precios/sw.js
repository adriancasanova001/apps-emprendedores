// Service worker de "Calcula tu Precio": permite instalar la app y abrirla sin internet.
// Solo toca peticiones GET del mismo origen dentro de su scope (/precios/).
// Todo lo demás (bloqueos, configuraciones de clientes, WhatsApp, etc.) va directo a la red.
// Sube el número de CACHE solo si cambian los archivos precargados (manifest o íconos);
// el index se actualiza solo porque se pide primero a la red.
var CACHE = 'ord-calc-v1';
var PREFIJO = 'ord-calc-';
var PRECARGA = ['./', 'manifest.webmanifest', 'icono-192.png', 'icono-512.png', 'maskable-192.png', 'maskable-512.png'];
var SCOPE = self.registration.scope;

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(PRECARGA); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k.indexOf(PREFIJO) === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function redConTiempo(req, ms) {
  return new Promise(function (ok, mal) {
    var t = setTimeout(function () { mal(new Error('timeout')); }, ms);
    fetch(req).then(function (r) { clearTimeout(t); ok(r); }, function (er) { clearTimeout(t); mal(er); });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.href.indexOf(SCOPE) !== 0) return;               // fuera del scope: no se toca

  var esIndex = req.mode === 'navigate' || /\/$/.test(url.pathname) || /\/index\.html$/.test(url.pathname);
  if (esIndex) {
    e.respondWith(
      redConTiempo(req, 4000).then(function (r) {
        if (r && r.ok) {
          var copia = r.clone();
          caches.open(CACHE).then(function (c) { c.put(SCOPE, copia); }).catch(function () {});
        }
        return r;
      }).catch(function () {
        return caches.match(SCOPE, { ignoreSearch: true }).then(function (c) { return c || Response.error(); });
      })
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(function (c) { return c || fetch(req); })
  );
});
