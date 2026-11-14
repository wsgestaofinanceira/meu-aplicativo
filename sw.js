/* Service worker do W$ Gestão Financeira — atualização confiável.
   - Página, scripts e manifesto: sempre tenta a rede primeiro (versão nova assim que existir) e usa o cache só offline.
   - Imagens e ícones: usa o cache e atualiza em segundo plano.
   - Nunca intercepta pedidos a outros sites (cotações, proxies etc.). */
const VER = 'ws-2026.11.14-g';

self.addEventListener('install', () => { self.skipWaiting(); });

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VER) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) return;

  const networkFirst = r.mode === 'navigate' || u.pathname.endsWith('/') || /\.(html|js|webmanifest|json)$/i.test(u.pathname);
  if (networkFirst) {
    e.respondWith((async () => {
      try {
        const f = await fetch(r, { cache: 'no-store' });
        if (f && f.ok) { const c = await caches.open(VER); c.put(r, f.clone()); }
        return f;
      } catch (_) {
        const m = await caches.match(r, { ignoreSearch: true });
        return m || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const c = await caches.open(VER);
    const m = await c.match(r);
    const n = fetch(r).then((f) => { if (f && f.ok) c.put(r, f.clone()); return f; }).catch(() => m);
    return m || n;
  })());
});
