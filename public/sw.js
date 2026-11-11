const CACHE = "ijs-railway-__BUILD_ID__";
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/art/title-hero.webp",
  "/art/route-map.webp",
  "/art/meadow.webp",
  "/art/village.webp",
  "/art/mountains.webp",
  "/art/night-tunnel.webp",
  "/art/sea-bridge.webp",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  // Updates wait while a lesson is open. A fresh app launch may activate a
  // previously waiting worker; there is deliberately no automatic reload.
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "ACTIVATE_ON_LAUNCH") void self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      ),
  );
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === "navigate") {
          return (await caches.match("/index.html")) ?? Response.error();
        }
        return Response.error();
      }),
  );
});
