/* TAESTEP 서비스 워커 — 인터넷이 될 때는 늘 최신 화면, 끊겼을 때만 받아 둔 사본으로 연다 (교안·그림·GitHub 요청은 건드리지 않음) */
const CACHE = 'taestep-v1';
const CORE = ['./', 'index.html', 'studio.html', 'play.html', 'ts/engine.css', 'ts/app.css', 'ts/fonts.css', 'ts/engine.js', 'ts/store.js', 'ts/home.js', 'ts/studio.js', 'ts/play.js', 'icon.svg', 'manifest.webmanifest'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => fetch(u, { cache: 'reload' }).then(r => r.ok ? c.put(u, r) : null).catch(() => null))))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('taestep-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || !/(\/|\.(html|js|css|svg|png|woff2|webmanifest))$/i.test(u.pathname)) return;
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(k => k.put(e.request, c)).catch(() => { }); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(m => m || Response.error())));
});
