/* Caderno Digital — service worker: guarda a app para funcionar sem internet */
const CACHE = 'caderno-digital-v5';
const ASSETS = ['./', './index.html', './estilos.css', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png',
  './js/base.js', './js/tinta.js', './js/pdf.js', './js/editor.js', './js/drive.js', './js/blocos.js', './js/arranque.js'];
// Leitor de PDF (fase 3): guardado também, para abrir PDFs sem internet
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
const PDFJS_FILES = [PDFJS + 'pdf.min.js', PDFJS + 'pdf.worker.min.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(async c => {
    await c.addAll(ASSETS);
    // o leitor de PDF é opcional: se falhar agora, é guardado na primeira vez que for usado
    await Promise.all(PDFJS_FILES.map(u => c.add(new Request(u, { mode: 'cors' })).catch(() => {})));
  }));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
const put = (key, res) => { if (res && res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(key, cp)); } return res; };
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Leitor de PDF: usa a cópia guardada; se não houver, vai à rede e guarda
  if (req.url.startsWith(PDFJS)) {
    e.respondWith(caches.match(req.url).then(hit => hit || fetch(req).then(r => put(req.url, r))));
    return;
  }
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // Ficheiros da app: tenta sempre a versão mais recente (até 3 s), para que
  // index.html, estilos e scripts fiquem todos da mesma versão; sem rede, usa a guardada
  const key = req.mode === 'navigate' ? './index.html' : url.pathname;
  e.respondWith(new Promise(resolve => {
    let done = false;
    const fallback = () => caches.match(key, { ignoreSearch: true })
      .then(r => r || caches.match(req, { ignoreSearch: true }))
      .then(r => r || (req.mode === 'navigate' ? caches.match('./') : null))
      .then(r => r || new Response('Sem ligação e sem cópia guardada.', { status: 503 }));
    const t = setTimeout(() => { if (!done) { done = true; fallback().then(resolve); } }, 3000);
    fetch(req).then(r => {
      put(key, r.clone());
      if (!done) { done = true; clearTimeout(t); resolve(r); }
    }).catch(() => { if (!done) { done = true; clearTimeout(t); fallback().then(resolve); } });
  }));
});
