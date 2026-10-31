/* Service worker : permet l'utilisation hors ligne.
   - Les fichiers de l'application sont mis en cache à la première ouverture avec du réseau.
   - Ensuite l'application s'ouvre immédiatement depuis le cache (même sans réseau) ;
     en arrière-plan, si une nouvelle version est publiée, elle est téléchargée et l'utilisateur est invité à actualiser. */
const V = "codif-851f18d672";
const SCOPE = self.registration.scope;
const INDEX = new URL("index.html", SCOPE).href;
const CORE = ["index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"]
  .map(p => new URL(p, SCOPE).href);

self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function revalidate(req, key) {
  try {
    const res = await fetch(req, {cache: "no-cache"});
    if (!res || !res.ok) return;
    const cache = await caches.open(V);
    const old = await cache.match(key);
    if (old) {
      const [a, b] = await Promise.all([old.clone().text(), res.clone().text()]);
      if (a !== b) {
        await cache.put(key, res);
        const cs = await self.clients.matchAll();
        cs.forEach(c => c.postMessage({type: "update"}));
      }
    } else {
      await cache.put(key, res);
    }
  } catch (_) { /* hors ligne : on garde la copie en cache */ }
}

self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) return;
  const isPage = r.mode === "navigate" || u.href === INDEX;
  const key = isPage ? INDEX : r;
  e.respondWith((async () => {
    const hit = await caches.match(key);
    if (hit) { e.waitUntil(revalidate(isPage ? INDEX : r, key)); return hit; }
    try {
      const res = await fetch(r);
      if (res.ok) (await caches.open(V)).put(key, res.clone());
      return res;
    } catch (err) {
      return (await caches.match(INDEX)) || Response.error();
    }
  })());
});

self.addEventListener("message", e => { if (e.data === "skip") self.skipWaiting(); });
