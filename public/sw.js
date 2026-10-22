// Ofertar — funciona offline. A página é buscada na rede quando há conexão
// (assim todos recebem a versão nova) e vem do cache quando não há.
const CACHE = 'ofertas-v3'
const BASICOS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './favicon.svg']
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASICOS)).then(() => self.skipWaiting())) })
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())) })
self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  const fontes = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'
  if (url.origin !== location.origin && !fontes) return
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', cp)); return r }).catch(() => caches.match('./index.html')))
    return
  }
  e.respondWith(caches.match(req).then(hit => {
    const rede = fetch(req).then(r => { if (r.ok || r.type === 'opaque') { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)) } return r }).catch(() => hit)
    return hit || rede
  }))
})
