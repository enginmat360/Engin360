import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { collection,doc,setDoc,addDoc,getDocs,updateDoc,serverTimestamp,Timestamp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { auth,db,firebaseConfig } from "./firebase.js";
const TEACHER_UID="lwC5kkGoomRsKINiWRVwEVGd0J03";
const $=id=>document.getElementById(id);
let students=[],tasks=[];
function msg(id,text,type=""){const e=$(id);e.textContent=text;e.className="message"+(type?" "+type:"")}
function esc(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
onAuthStateChanged(auth,async user=>{if(!user||user.uid!==TEACHER_UID){location.replace("gorev-giris.html");return}$("teacherEmail").textContent=user.email;await refresh()});
$("logoutBtn").onclick=async()=>{await signOut(auth);location.replace("gorev-giris.html")};
async function refresh(){await loadStudents();await loadTasks();renderStats()}
async function loadStudents(){const snap=await getDocs(collection(db,"users"));students=snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.role==="student");
 $("studentCount").textContent=students.length;$("taskStudent").innerHTML='<option value="">Öğrenci seçin</option>'+students.map(s=>`<option value="${s.id}">${esc(s.name)} — ${esc(s.email)}</option>`).join("");
 $("studentsList").innerHTML=students.length?students.map(s=>`<div class="item"><div class="item-head"><div><h3>${esc(s.name)}</h3><div class="muted">${esc(s.email)}</div></div><span class="badge ${s.active===false?"revision":"approved"}">${s.active===false?"Pasif":"Aktif"}</span></div></div>`).join(""):'<div class="notice">Henüz öğrenci yok.</div>'}
async function loadTasks(){const snap=await getDocs(collection(db,"gorevler"));tasks=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
 $("tasksList").innerHTML=tasks.length?tasks.map(t=>`<div class="item"><div class="item-head"><div><h3>${esc(t.title||t.baslik)}</h3><div class="muted">${esc(t.studentName||t.studentEmail||"")}</div></div><span class="badge ${t.status||"pending"}">${statusText(t.status)}</span></div>
 <div class="meta"><span>${esc(t.date||"")}</span><span>${esc(t.startTime||"")}–${esc(t.endTime||"")}</span><span>Sıra ${t.order||1}</span></div>
 ${t.submissionText?`<div class="notice"><b>Öğrenci teslimi:</b><br>${esc(t.submissionText)}</div>`:""}
 ${t.teacherNote?`<p class="muted"><b>Öğretmen notu:</b> ${esc(t.teacherNote)}</p>`:""}
 <div class="item-actions">${t.status==="submitted"?`<button class="btn success" data-action="approve" data-id="${t.id}">Onayla</button><button class="btn danger" data-action="revision" data-id="${t.id}">Tekrar Yap</button>`:""}
 <button class="btn secondary" data-action="unlock" data-id="${t.id}">Kilidi Aç</button><button class="btn secondary" data-action="skip" data-id="${t.id}">Görevi Geç</button></div></div>`).join(""):'<div class="notice">Henüz görev yok.</div>';
 document.querySelectorAll("[data-action]").forEach(b=>b.onclick=()=>handleTaskAction(b.dataset.action,b.dataset.id))}
function statusText(s){return({pending:"Bekliyor",submitted:"Onay bekliyor",approved:"Onaylandı",revision:"Tekrar yap",skipped:"Geçildi"}[s]||"Bekliyor")}
function renderStats(){$("taskCount").textContent=tasks.length;$("waitingCount").textContent=tasks.filter(t=>t.status==="submitted").length;$("approvedCount").textContent=tasks.filter(t=>t.status==="approved"||t.status==="skipped").length}
$("studentForm").addEventListener("submit",async e=>{e.preventDefault();msg("studentMsg","Öğrenci oluşturuluyor…");
 const secondary=initializeApp(firebaseConfig,"studentCreator-"+Date.now());const secondaryAuth=getAuth(secondary);
 try{const c=await createUserWithEmailAndPassword(secondaryAuth,$("studentEmail").value.trim(),$("studentPassword").value);
 await setDoc(doc(db,"users",c.user.uid),{name:$("studentName").value.trim(),email:$("studentEmail").value.trim(),role:"student",active:true,createdAt:serverTimestamp(),createdBy:TEACHER_UID});
 await signOut(secondaryAuth);await deleteApp(secondary);e.target.reset();msg("studentMsg","Öğrenci hesabı oluşturuldu.","success");await loadStudents()}
 catch(err){try{await deleteApp(secondary)}catch{}msg("studentMsg","Oluşturulamadı: "+err.message,"error")}});
$("taskForm").addEventListener("submit",async e=>{e.preventDefault();const sid=$("taskStudent").value;const s=students.find(x=>x.id===sid);if(!s)return;
 msg("taskMsg","Görev kaydediliyor…");const date=$("taskDate").value,start=$("taskStart").value,end=$("taskEnd").value;
 try{await addDoc(collection(db,"gorevler"),{studentId:sid,studentName:s.name,studentEmail:s.email,title:$("taskTitle").value.trim(),description:$("taskDescription").value.trim(),
 date,startTime:start,endTime:end,startAt:Timestamp.fromDate(new Date(`${date}T${start}:00`)),endAt:Timestamp.fromDate(new Date(`${date}T${end}:00`)),
 order:Number($("taskOrder").value),requiresApproval:$("taskApproval").checked,status:"pending",unlockedOverride:false,submissionText:"",teacherNote:"",createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
 e.target.reset();$("taskOrder").value=1;$("taskApproval").checked=true;msg("taskMsg","Görev kaydedildi.","success");await loadTasks();renderStats()}
 catch(err){msg("taskMsg","Kaydedilemedi: "+err.message,"error")}});
async function handleTaskAction(action,id){const ref=doc(db,"gorevler",id);let patch={updatedAt:serverTimestamp()};
 if(action==="approve"){patch.status="approved";patch.approvedAt=serverTimestamp()}
 if(action==="revision"){const note=prompt("Öğrenciye notunuz:","Eksikleri tamamlayıp tekrar gönder.");if(note===null)return;patch.status="revision";patch.teacherNote=note}
 if(action==="unlock"){patch.unlockedOverride=true}
 if(action==="skip"){patch.status="skipped";patch.unlockedOverride=true}
 await updateDoc(ref,patch);await loadTasks();renderStats()}
