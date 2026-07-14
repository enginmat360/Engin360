/* ENGİN360 Bildirim Sistemi v1
   Bu dosya öğrenci ve veli panellerinde kullanılabilir.
*/
(function () {
  "use strict";

  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDj5Pnv0lNeChf_t2XGdhiru5hjwKb6iIw",
    authDomain: "engin360-56474.firebaseapp.com",
    projectId: "engin360-56474",
    storageBucket: "engin360-56474.firebasestorage.app",
    messagingSenderId: "82163330076",
    appId: "1:82163330076:web:f1c7b7b10e74ee8f4283d9"
  };

  // Firebase Console > Proje ayarları > Cloud Messaging > Web Push sertifikaları
  const VAPID_KEY = "BLLgwsmJxoAUdCAGX4S21nedb2XLkcr6wGb6tu9PvHJ2UONmlrUs2MQ0cSBCNf_wiKJlJlK42zIFRpHn5xQ3u5s";

  const role = document.body.dataset.role || "ogrenci";
  let app;
  let auth;
  let db;
  let messaging;

  function ensureFirebase() {
    if (!window.firebase) {
      throw new Error("Firebase compat kütüphaneleri yüklenmemiş.");
    }

    app = firebase.apps && firebase.apps.length
      ? firebase.app()
      : firebase.initializeApp(FIREBASE_CONFIG);

    auth = firebase.auth();
    db = firebase.firestore();
    messaging = firebase.messaging();
  }

  function createButton() {
    let button = document.getElementById("engin360NotificationButton");
    if (button) return button;

    button = document.createElement("button");
    button.id = "engin360NotificationButton";
    button.type = "button";
    button.textContent = "🔔 Bildirimleri Aç";
    button.style.cssText = [
      "position:fixed",
      "right:18px",
      "bottom:18px",
      "z-index:99999",
      "border:0",
      "border-radius:999px",
      "padding:13px 18px",
      "font-weight:800",
      "cursor:pointer",
      "color:#fff",
      "background:linear-gradient(135deg,#7c3aed,#06b6d4)",
      "box-shadow:0 10px 30px rgba(6,182,212,.35)"
    ].join(";");

    document.body.appendChild(button);
    return button;
  }

  function setButtonState(button, text, disabled) {
    button.textContent = text;
    button.disabled = Boolean(disabled);
    button.style.opacity = disabled ? ".7" : "1";
    button.style.cursor = disabled ? "default" : "pointer";
  }

  async function saveToken(token, user) {
    const tokenId = await sha256(token);

    await db.collection("bildirimTokenlari").doc(tokenId).set({
      token,
      uid: user.uid,
      email: user.email || "",
      rol: role,
      aktif: true,
      platform: navigator.platform || "",
      userAgent: navigator.userAgent || "",
      guncellendi: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await db.collection("kullanicilar").doc(user.uid).set({
      bildirimAktif: true,
      bildirimGuncellendi: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  async function sha256(text) {
    const data = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  async function activateNotifications(button) {
    try {
      ensureFirebase();

      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        throw new Error("Bu tarayıcı web bildirimlerini desteklemiyor.");
      }

      if (VAPID_KEY.includes("BURAYA")) {
        throw new Error("notifications.js içindeki VAPID anahtarı henüz eklenmemiş.");
      }

      const user = auth.currentUser;
      if (!user) {
        throw new Error("Bildirim açmak için önce giriş yapılmalıdır.");
      }

      setButtonState(button, "İzin bekleniyor…", true);

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Bildirim izni verilmedi.");
      }

      const registration = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js"
      );

      const token = await messaging.getToken({
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration
      });

      if (!token) {
        throw new Error("Cihaz bildirim anahtarı alınamadı.");
      }

      await saveToken(token, user);

      localStorage.setItem("engin360BildirimAktif", "1");
      setButtonState(button, "✅ Bildirimler Açık", true);
    } catch (error) {
      console.error("ENGİN360 bildirim hatası:", error);
      alert(error.message || "Bildirim sistemi etkinleştirilemedi.");
      setButtonState(button, "🔔 Bildirimleri Aç", false);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const button = createButton();

    if (
      Notification.permission === "granted" &&
      localStorage.getItem("engin360BildirimAktif") === "1"
    ) {
      setButtonState(button, "✅ Bildirimler Açık", true);
    }

    button.addEventListener("click", () => activateNotifications(button));
  });
})();
