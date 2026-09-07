/* Service worker solo para avisos de medicamentos (no guarda la aplicación sin conexión). */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_error) {
    data = {};
  }

  const title = data.title || "Es hora de tu medicamento";
  const options = {
    body: data.body || "Abre Pastillero Digital para registrar tu toma.",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    tag: data.tag || "pastillero",
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: { url: data.url || "/inicio" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/inicio";
  event.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const ventana of ventanas) {
        if ("focus" in ventana) {
          await ventana.focus();
          if ("navigate" in ventana) await ventana.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
