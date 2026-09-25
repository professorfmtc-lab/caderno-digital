/* Caderno Digital — service worker: guarda a app para funcionar sem internet */
const CACHE = 'caderno-digital-v2';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
const put = (req, res) => { if (res && res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return res; };
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    // A página principal: tenta a versão mais recente (até 3 s); sem rede, usa a guardada
    e.respondWith(new Promise(resolve => {
      let done = false;
      const fallback = () => caches.match('./index.html').then(r => r || caches.match('./'));
      const t = setTimeout(() => { if (!done) { done = true; fallback().then(resolve); } }, 3000);
      fetch(req).then(r => { put('./index.html', r.clone()); if (!done) { done = true; clearTimeout(t); resolve(r); } })
        .catch(() => { if (!done) { done = true; clearTimeout(t); fallback().then(resolve); } });
    }));
    return;
  }
  // Restantes ficheiros: responde logo com o que está guardado e atualiza em segundo plano
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => {
    const net = fetch(req).then(r => put(req, r)).catch(() => hit);
    return hit || net;
  }));
});
