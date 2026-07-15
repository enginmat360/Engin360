/* ENGİN360 Firebase Cloud Messaging Service Worker v2 */
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDj5Pnv0lNeChf_t2XGdhiru5hjwKb6iIw",
  authDomain: "engin360-56474.firebaseapp.com",
  projectId: "engin360-56474",
  storageBucket: "engin360-56474.firebasestorage.app",
  messagingSenderId: "82163330076",
  appId: "1:82163330076:web:f1c7b7b10e74ee8f4283d9"
});

const messaging = firebase.messaging();

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

messaging.onBackgroundMessage((payload) => {
  console.log("ENGİN360 arka plan bildirimi:", payload);

  const n = payload.notification || {};
  const d = payload.data || {};
  const title = n.title || d.title || "ENGİN360";

  return self.registration.showNotification(title, {
    body: n.body || d.body || "Yeni bildiriminiz var.",
    icon: d.icon || "/icon-512.png",
    badge: d.badge || "/favicon-32x32.png",
    tag: d.tag || `engin360-${Date.now()}`,
    renotify: true,
    requireInteraction: false,
    data: {
      url: d.url || "/ogrenci-paneli.html"
    }
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    event.notification?.data?.url ||
    "/ogrenci-paneli.html";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("navigate" in client) {
          client.navigate(targetUrl);
        }
        if ("focus" in client) {
          return client.focus();
        }
      }

      return clients.openWindow
        ? clients.openWindow(targetUrl)
        : null;
    })
  );
});
