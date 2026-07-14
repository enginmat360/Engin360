/* ENGİN360 Firebase Cloud Messaging Service Worker */
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

messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  const data = payload.data || {};

  return self.registration.showNotification(
    notification.title || data.title || "ENGİN360",
    {
      body: notification.body || data.body || "Yeni bildiriminiz var.",
      icon: data.icon || "/icon-512.png",
      badge: data.badge || "/favicon-32x32.png",
      data: {
        url: data.url || "/ogrenci-paneli.html"
      }
    }
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification &&
      event.notification.data &&
      event.notification.data.url) ||
    "/ogrenci-paneli.html";

  event.waitUntil(clients.openWindow(targetUrl));
});
