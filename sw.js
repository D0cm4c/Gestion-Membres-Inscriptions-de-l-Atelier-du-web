/* Service worker PWA — Atelier du Web (oct. 2026)
 * Stratégie PRUDENTE (leçon des bumps ?v=) :
 *   - cache uniquement la coquille de démarrage + les fichiers lourds stables (wasm, icônes)
 *   - HTML/JS/CSS : réseau d'abord, fallback cache HORS LIGNE uniquement
 *   - ainsi un déploiement GitHub Pages est visible dès le rechargement, pas de versions périmées
 */
var CACHE = 'adw-shell-v1';
var SHELL = [
  './',
  './index.html',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './vendor/sql-wasm.js'
  // sql-wasm.wasm : trop lourd à pré-cacher ? non, ~1,2 Mo — utile hors ligne. Ajouté ci-dessous.
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (cache) {
    return cache.addAll(SHELL.concat(['./vendor/sql-wasm.wasm'])).catch(function () {
      // certains fichiers peuvent échouer en install : ne pas bloquer le SW
    });
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; })
            .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  // ne pas intercepter les appels externes (atelierduweb.be, etc.)
  if (url.origin !== self.location.origin) return;

  // réseau d'abord ; si hors ligne → cache ; si HTML et rien en cache → coquille index
  e.respondWith(
    fetch(req).then(function (res) {
      // mettre en cache une copie fraîche (HTML/JS/CSS/asset)
      var copy = res.clone();
      caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        return hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error());
      });
    })
  );
});
