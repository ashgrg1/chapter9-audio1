// Offline helper for the Ch 9 lesson. Caches the page and the MP3 so it plays without internet.
const CACHE = 'ch9-rx-v1';
const FILES = ['./', './index.html', './Ch9_audio.mp3', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Audio players ask for byte ranges (iPhone always does). Answer from the cached full file.
async function rangeResponse(req) {
  const cache = await caches.open(CACHE);
  let full = await cache.match('./Ch9_audio.mp3');
  if (!full) {
    try { full = await fetch('./Ch9_audio.mp3'); if (full.ok) cache.put('./Ch9_audio.mp3', full.clone()); }
    catch (e) { return fetch(req); }
  }
  const buf = await full.arrayBuffer();
  const size = buf.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
  if (!m) return new Response(buf, { status: 200, headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': size, 'Accept-Ranges': 'bytes' } });
  let start = m[1] === '' ? size - Number(m[2]) : Number(m[1]);
  let end = m[1] !== '' && m[2] !== '' ? Number(m[2]) : size - 1;
  start = Math.max(0, start); end = Math.min(end, size - 1);
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Accept-Ranges': 'bytes' }
  });
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // fonts load normally
  if (url.pathname.endsWith('.mp3')) { e.respondWith(rangeResponse(e.request)); return; }
  // Page and small files: use the network when online (gets updates), cache when offline
  e.respondWith(
    fetch(e.request).then(r => { if (r.ok) caches.open(CACHE).then(c => c.put(e.request, r.clone())); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});
