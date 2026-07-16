import { auth, db, getMessagingSafe } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  collection, query, where, getDocs, doc, getDoc, updateDoc,
  serverTimestamp, setDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import {
  getToken, onMessage
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging.js";

const VAPID_KEY = "BLLgwsmJxoAUdCAGX4S21nedb2XLkcr6wGb6tu9PvHJ2UONmlrUs2MQ0cSBCNf_wiKJlJlK42zIFRpHn5xQ3u5s";
const $ = (id) => document.getElementById(id);

let currentUser = null;
let tasks = [];
let foregroundListenerInstalled = false;

function esc(s = "") {
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}

$("logoutBtn").onclick = async () => {
  await signOut(auth);
  location.replace("gorev-giris.html");
};

$("notificationBtn").onclick = enableNotifications;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.replace("gorev-giris.html");
    return;
  }

  currentUser = user;
  const userSnap = await getDoc(doc(db, "users", user.uid));

  if (!userSnap.exists() || userSnap.data().role !== "student" || userSnap.data().active === false) {
    await signOut(auth);
    location.replace("gorev-giris.html");
    return;
  }

  $("studentInfo").textContent = `${userSnap.data().name || "Öğrenci"} • ${user.email}`;
  await loadTasks();
  await prepareMessaging();
});

async function loadTasks() {
  const snap = await getDocs(
    query(collection(db, "gorevler"), where("studentId", "==", currentUser.uid))
  );

  tasks = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const dateCompare = String(a.date || "").localeCompare(String(b.date || ""));
      if (dateCompare !== 0) return dateCompare;
      const orderCompare = Number(a.order || 0) - Number(b.order || 0);
      if (orderCompare !== 0) return orderCompare;
      return Number(a.createdAt?.seconds || 0) - Number(b.createdAt?.seconds || 0);
    });

  render();
}

function evaluate(task, index) {
  const now = new Date();
  const start = task.startAt?.toDate
    ? task.startAt.toDate()
    : new Date(`${task.date}T${task.startTime}:00`);
  const end = task.endAt?.toDate
    ? task.endAt.toDate()
    : new Date(`${task.date}T${task.endTime}:00`);

  const previous = tasks[index - 1];

  let previousDone = true;
  if (previous) {
    const previousRequiresApproval = previous.requiresApproval !== false;
    previousDone = previousRequiresApproval
      ? ["approved", "skipped"].includes(previous.status)
      : ["submitted", "approved", "skipped"].includes(previous.status);
  }

  if (task.unlockedOverride === true) previousDone = true;

  if (["approved", "skipped"].includes(task.status)) {
    return { state: "done", label: task.status === "skipped" ? "Öğretmen geçti" : "Onaylandı" };
  }

  if (task.status === "submitted") {
    return { state: "submitted", label: "Öğretmen onayı bekleniyor" };
  }

  if (task.status === "revision") {
    return { state: "active", label: "Tekrar yap" };
  }

  if (!previousDone) {
    return { state: "locked", label: "Önceki görev öğretmen tarafından onaylanmalı" };
  }

  if (now < start) return { state: "upcoming", label: "Saati gelmedi" };
  if (now > end) return { state: "active", label: "Süresi geçti — teslim edebilirsin" };
  return { state: "active", label: "Aktif görev" };
}

function render() {
  const list = $("tasksList");

  if (!tasks.length) {
    $("studentMessage").textContent = "Henüz sana atanmış görev yok.";
    list.innerHTML = "";
    updateStats(0, 0, 0, 0);
    return;
  }

  $("studentMessage").textContent =
    "Görevler sırayla açılır. Onay gerektiren görev öğretmen onaylamadan sonraki görev açılmaz.";

  let done = 0;
  let active = 0;
  let locked = 0;

  list.innerHTML = tasks.map((task, index) => {
    const ev = evaluate(task, index);

    if (ev.state === "done") done++;
    if (ev.state === "active") active++;
    if (ev.state === "locked" || ev.state === "upcoming") locked++;

    if (ev.state === "locked" || ev.state === "upcoming") return "";

    return `<div class="item">
      <div class="item-head">
        <div>
          <h3>${esc(task.title || task.baslik)}</h3>
          <div class="muted">${esc(task.description || "")}</div>
        </div>
        <span class="badge ${ev.state === "done" ? "approved" : ev.state}">${esc(ev.label)}</span>
      </div>

      <div class="meta">
        <span>${esc(task.date || "")}</span>
        <span>${esc(task.startTime || "")}–${esc(task.endTime || "")}</span>
        <span>Sıra ${task.order || 1}</span>
      </div>

      ${task.teacherNote ? `<div class="notice"><b>Öğretmen notu:</b> ${esc(task.teacherNote)}</div>` : ""}

      ${ev.state === "active" ? `
        <label>Teslim açıklaması / çözüm bağlantısı</label>
        <textarea id="sub-${task.id}" placeholder="Ne yaptığını yaz veya Drive bağlantısı ekle">${esc(task.submissionText || "")}</textarea>
        <div class="item-actions">
          <button class="btn success" data-submit="${task.id}">Görevi Teslim Et</button>
        </div>` : ""}

      ${ev.state === "submitted" && task.submissionText ? `
        <div class="notice"><b>Teslimin:</b><br>${esc(task.submissionText)}</div>` : ""}
    </div>`;
  }).join("");

  updateStats(tasks.length, done, active, locked);
  document.querySelectorAll("[data-submit]")
    .forEach((button) => button.onclick = () => submitTask(button.dataset.submit));
}

function updateStats(total, done, active, locked) {
  $("totalCount").textContent = total;
  $("doneCount").textContent = done;
  $("activeCount").textContent = active;
  $("lockedCount").textContent = locked;
}

async function submitTask(id) {
  const text = $("sub-" + id).value.trim();
  if (!text) {
    alert("Teslim açıklaması veya bağlantı yazmalısın.");
    return;
  }

  if (!confirm("Görevi öğretmen onayına göndermek istiyor musun?")) return;

  await updateDoc(doc(db, "gorevler", id), {
    submissionText: text,
    status: "submitted",
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await loadTasks();
}

async function prepareMessaging() {
  const messaging = await getMessagingSafe();
  if (!messaging) {
    $("notificationBtn").textContent = "Bildirim desteklenmiyor";
    $("notificationBtn").disabled = true;
    return;
  }

  if (!foregroundListenerInstalled) {
    onMessage(messaging, (payload) => {
      const n = payload.notification || {};
      const d = payload.data || {};
      showForegroundNotice(
        n.title || d.title || "ENGİN360",
        n.body || d.body || "Yeni bildiriminiz var.",
        d.url || "ogrenci-paneli.html"
      );
    });
    foregroundListenerInstalled = true;
  }

  if (Notification.permission === "granted") {
    try {
      await registerToken(messaging);
      $("notificationBtn").textContent = "✅ Bildirimler Açık";
    } catch (error) {
      console.error(error);
      $("notificationBtn").textContent = "🔔 Bildirimleri Yenile";
    }
  }
}

async function enableNotifications() {
  try {
    const messaging = await getMessagingSafe();
    if (!messaging) throw new Error("Bu tarayıcı bildirimleri desteklemiyor.");

    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error("Bildirim izni verilmedi.");

    await registerToken(messaging);
    $("notificationBtn").textContent = "✅ Bildirimler Açık";
    showForegroundNotice(
      "✅ Bildirimler hazır",
      "Bu cihaz yeni görev bildirimlerini alacak.",
      ""
    );
  } catch (error) {
    console.error(error);
    alert(error.message || "Bildirimler etkinleştirilemedi.");
  }
}

async function registerToken(messaging) {
  const registration = await navigator.serviceWorker.register(
    "/firebase-messaging-sw.js",
    { scope: "/" }
  );

  await registration.update();
  await navigator.serviceWorker.ready;

  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration
  });

  if (!token) throw new Error("Bildirim tokenı alınamadı.");

  const tokenId = await sha256(token);
  await setDoc(doc(db, "bildirimTokenlari", tokenId), {
    token,
    uid: currentUser.uid,
    email: currentUser.email || "",
    rol: "ogrenci",
    aktif: true,
    platform: navigator.platform || "",
    userAgent: navigator.userAgent || "",
    origin: location.origin,
    guncellendi: serverTimestamp()
  }, { merge: true });
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function showForegroundNotice(title, body, url) {
  const old = document.getElementById("engin360ForegroundNotice");
  if (old) old.remove();

  const card = document.createElement("button");
  card.id = "engin360ForegroundNotice";
  card.type = "button";
  card.innerHTML = `<strong>${esc(title)}</strong><span>${esc(body)}</span>`;
  card.style.cssText = [
    "position:fixed",
    "left:14px",
    "right:14px",
    "top:14px",
    "z-index:100000",
    "border:0",
    "border-radius:18px",
    "padding:16px",
    "text-align:left",
    "color:#fff",
    "background:linear-gradient(135deg,#6d28d9,#0891b2)",
    "box-shadow:0 18px 50px rgba(0,0,0,.38)",
    "font:inherit"
  ].join(";");

  const strong = card.querySelector("strong");
  const span = card.querySelector("span");
  strong.style.cssText = "display:block;font-size:16px;margin-bottom:5px";
  span.style.cssText = "display:block;opacity:.92";

  card.onclick = () => {
    card.remove();
    if (url) location.href = url;
  };

  document.body.appendChild(card);
  setTimeout(() => card.remove(), 9000);
}
