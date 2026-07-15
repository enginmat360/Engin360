/* ENGİN360 Bildirim Sistemi v2
   Öğrenci ve veli panellerinde kullanılır.
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
    button.style.opacity = disabled ? ".72" : "1";
    button.style.cursor = disabled ? "default" : "pointer";
  }

  function showInPageNotification(title, body, url) {
    const old = document.getElementById("engin360ForegroundNotice");
    if (old) old.remove();

    const card = document.createElement("button");
    card.id = "engin360ForegroundNotice";
    card.type = "button";
    card.style.cssText = [
      "position:fixed",
      "left:14px",
      "right:14px",
      "top:14px",
      "z-index:100000",
      "border:1px solid rgba(255,255,255,.22)",
      "border-radius:18px",
      "padding:16px",
      "text-align:left",
      "color:#fff",
      "background:linear-gradient(135deg,rgba(76,29,149,.97),rgba(8,145,178,.97))",
      "box-shadow:0 18px 50px rgba(0,0,0,.38)",
      "font:inherit"
    ].join(";");

    card.innerHTML =
      `<strong style="display:block;font-size:16px;margin-bottom:5px">${escapeHtml(title)}</strong>` +
      `<span style="display:block;opacity:.92">${escapeHtml(body)}</span>`;

    card.onclick = () => {
      card.remove();
      if (url) location.href = url;
    };

    document.body.appendChild(card);
    setTimeout(() => card.remove(), 9000);
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char]));
  }

  async function sha256(text) {
    const data = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
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
      origin: location.origin,
      guncellendi: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await db.collection("kullanicilar").doc(user.uid).set({
      bildirimAktif: true,
      bildirimOrigin: location.origin,
      bildirimGuncellendi: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  async function registerAndRefreshToken() {
    ensureFirebase();

    const user = auth.currentUser;
    if (!user) {
      throw new Error("Bildirim açmak için önce giriş yapılmalıdır.");
    }

    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
      { scope: "/" }
    );

    await registration.update();
    await navigator.serviceWorker.ready;

    const token = await messaging.getToken({
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    });

    if (!token) {
      throw new Error("Cihaz bildirim anahtarı alınamadı.");
    }

    await saveToken(token, user);
    localStorage.setItem("engin360BildirimAktif", "1");
    return token;
  }

  async function activateNotifications(button) {
    try {
      ensureFirebase();

      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        throw new Error("Bu tarayıcı web bildirimlerini desteklemiyor.");
      }

      setButtonState(button, "İzin bekleniyor…", true);

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Bildirim izni verilmedi.");
      }

      await registerAndRefreshToken();
      setButtonState(button, "✅ Bildirimler Açık", true);
      showInPageNotification(
        "✅ ENGİN360 bildirimleri açık",
        "Bu cihaz artık yeni görev bildirimlerini alacak.",
        ""
      );
    } catch (error) {
      console.error("ENGİN360 bildirim hatası:", error);
      alert(error.message || "Bildirim sistemi etkinleştirilemedi.");
      setButtonState(button, "🔔 Bildirimleri Aç", false);
    }
  }

  function installForegroundListener() {
    messaging.onMessage((payload) => {
      console.log("ENGİN360 ön plan bildirimi:", payload);

      const notification = payload.notification || {};
      const data = payload.data || {};
      const title = notification.title || data.title || "ENGİN360";
      const body = notification.body || data.body || "Yeni bildiriminiz var.";
      const url = data.url || "/ogrenci-paneli.html";

      showInPageNotification(title, body, url);

      if (Notification.permission === "granted" && document.visibilityState === "visible") {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification(title, {
            body,
            icon: data.icon || "/icon-512.png",
            badge: data.badge || "/favicon-32x32.png",
            tag: data.tag || `engin360-${Date.now()}`,
            data: { url }
          });
        }).catch((error) => {
          console.warn("Ön plan sistem bildirimi gösterilemedi:", error);
        });
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const button = createButton();

    try {
      ensureFirebase();
      installForegroundListener();
    } catch (error) {
      console.error(error);
      return;
    }

    auth.onAuthStateChanged(async (user) => {
      if (!user) return;

      if (Notification.permission === "granted") {
        try {
          setButtonState(button, "Bildirim yenileniyor…", true);
          await registerAndRefreshToken();
          setButtonState(button, "✅ Bildirimler Açık", true);
        } catch (error) {
          console.error("Token yenileme hatası:", error);
          setButtonState(button, "🔔 Bildirimleri Yenile", false);
        }
      } else {
        setButtonState(button, "🔔 Bildirimleri Aç", false);
      }
    });

    button.addEventListener("click", () => activateNotifications(button));
  });
})();
