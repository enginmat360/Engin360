import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { collection,doc,setDoc,addDoc,getDocs,updateDoc,deleteDoc,serverTimestamp,Timestamp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { auth,db,firebaseConfig } from "./firebase.js";
const TEACHER_UID="lwC5kkGoomRsKINiWRVwEVGd0J03";
const $=id=>document.getElementById(id);
let students=[],parents=[],tasks=[];
function msg(id,text,type=""){const e=$(id);e.textContent=text;e.className="message"+(type?" "+type:"")}
function esc(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
onAuthStateChanged(auth,async user=>{if(!user||user.uid!==TEACHER_UID){location.replace("gorev-giris.html");return}$("teacherEmail").textContent=user.email;await refresh()});
$("logoutBtn").onclick=async()=>{await signOut(auth);location.replace("gorev-giris.html")};
async function refresh(){await loadUsers();await loadTasks();renderStats()}
async function loadUsers(){
 const snap=await getDocs(collection(db,"users"));const all=snap.docs.map(d=>({id:d.id,...d.data()}));
 students=all.filter(x=>x.role==="student");parents=all.filter(x=>x.role==="parent");
 $("studentCount").textContent=students.length;$("parentCount").textContent=parents.length;
 const opts='<option value="">Öğrenci seçin</option>'+students.map(s=>`<option value="${s.id}">${esc(s.name)} — ${esc(s.email)}</option>`).join("");
 $("taskStudent").innerHTML=opts;$("parentStudent").innerHTML=opts;
 $("studentsList").innerHTML=students.length?students.map(s=>`<div class="item"><div class="item-head"><div><h3>${esc(s.name)}</h3><div class="muted">${esc(s.email)}</div></div><span class="badge ${s.active===false?"revision":"approved"}">${s.active===false?"Pasif":"Aktif"}</span></div></div>`).join(""):'<div class="notice">Henüz öğrenci yok.</div>';
 $("parentsList").innerHTML=parents.length?parents.map(p=>{const s=students.find(x=>x.id===p.studentId);return `<div class="item"><div class="item-head"><div><h3>${esc(p.name)}</h3><div class="muted">${esc(p.email)}</div><div class="muted">Öğrenci: ${esc(s?.name||p.studentName||"Bağlantı yok")}</div></div><span class="badge approved">Aktif</span></div></div>`}).join(""):'<div class="notice">Henüz veli hesabı yok.</div>';
}
async function loadTasks(){const snap=await getDocs(collection(db,"gorevler"));tasks=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
 $("tasksList").innerHTML=tasks.length?tasks.map(t=>`<div class="item"><div class="item-head"><div><h3>${esc(t.title||t.baslik)}</h3><div class="muted">${esc(t.studentName||t.studentEmail||"")}</div></div><span class="badge ${t.status||"pending"}">${statusText(t.status)}</span></div>
 <div class="meta"><span>${esc(t.date||"")}</span><span>${esc(t.startTime||"")}–${esc(t.endTime||"")}</span><span>Sıra ${t.order||1}</span></div>
 ${t.teacherNote?`<p class="muted"><b>Öğretmen notu:</b> ${esc(t.teacherNote)}</p>`:""}
 <div class="item-actions">
 ${t.status==="submitted"?`<button class="btn success" data-action="approve" data-id="${t.id}">Onayla</button><button class="btn secondary" data-action="revision" data-id="${t.id}">Tekrar İste</button>`:""}
 <button class="btn secondary" data-action="unlock" data-id="${t.id}">Kilidi Aç</button>
 <button class="btn secondary" data-action="skip" data-id="${t.id}">Görevi Geç</button>
 <button class="btn danger" data-action="delete" data-id="${t.id}">Görevi Sil</button>
 </div></div>`).join(""):'<div class="notice">Henüz görev yok.</div>';
 document.querySelectorAll("[data-action]").forEach(b=>b.onclick=()=>handleTaskAction(b.dataset.action,b.dataset.id))}
function statusText(s){return({pending:"Bekliyor",submitted:"Onay bekliyor",approved:"Onaylandı",revision:"Tekrar yap",skipped:"Geçildi"}[s]||"Bekliyor")}
function renderStats(){$("taskCount").textContent=tasks.length;$("approvedCount").textContent=tasks.filter(t=>t.status==="approved"||t.status==="skipped").length}
async function createAccount({email,password,data,label}){
 const secondary=initializeApp(firebaseConfig,label+"-"+Date.now());const secondaryAuth=getAuth(secondary);
 try{const c=await createUserWithEmailAndPassword(secondaryAuth,email,password);await setDoc(doc(db,"users",c.user.uid),{...data,email,active:true,createdAt:serverTimestamp(),createdBy:TEACHER_UID});await signOut(secondaryAuth);await deleteApp(secondary);return c.user.uid}
 catch(err){try{await deleteApp(secondary)}catch{}throw err}
}
$("studentForm").addEventListener("submit",async e=>{e.preventDefault();msg("studentMsg","Öğrenci oluşturuluyor…");
 try{await createAccount({email:$("studentEmail").value.trim(),password:$("studentPassword").value,data:{name:$("studentName").value.trim(),role:"student"},label:"studentCreator"});e.target.reset();msg("studentMsg","Öğrenci hesabı oluşturuldu.","success");await loadUsers()}
 catch(err){msg("studentMsg","Oluşturulamadı: "+err.message,"error")}});
$("parentForm").addEventListener("submit",async e=>{e.preventDefault();const sid=$("parentStudent").value;const s=students.find(x=>x.id===sid);if(!s)return;msg("parentMsg","Veli hesabı oluşturuluyor…");
 try{await createAccount({email:$("parentEmail").value.trim(),password:$("parentPassword").value,data:{name:$("parentName").value.trim(),role:"parent",studentId:sid,studentName:s.name,studentEmail:s.email},label:"parentCreator"});e.target.reset();msg("parentMsg","Veli hesabı oluşturuldu ve öğrenciye bağlandı.","success");await loadUsers()}
 catch(err){msg("parentMsg","Oluşturulamadı: "+err.message,"error")}});
$("taskForm").addEventListener("submit",async e=>{e.preventDefault();const sid=$("taskStudent").value;const s=students.find(x=>x.id===sid);if(!s)return;
 msg("taskMsg","Görev kaydediliyor…");const date=$("taskDate").value,start=$("taskStart").value,end=$("taskEnd").value;
 try{await addDoc(collection(db,"gorevler"),{studentId:sid,studentName:s.name,studentEmail:s.email,title:$("taskTitle").value.trim(),description:$("taskDescription").value.trim(),
 date,startTime:start,endTime:end,startAt:Timestamp.fromDate(new Date(`${date}T${start}:00`)),endAt:Timestamp.fromDate(new Date(`${date}T${end}:00`)),
 order:Number($("taskOrder").value),requiresApproval:$("taskApproval").checked,status:"pending",unlockedOverride:false,teacherNote:"",createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
 e.target.reset();$("taskOrder").value=1;$("taskApproval").checked=true;msg("taskMsg","Görev kaydedildi.","success");await loadTasks();renderStats()}
 catch(err){msg("taskMsg","Kaydedilemedi: "+err.message,"error")}});
async function handleTaskAction(action,id){
 const task=tasks.find(t=>t.id===id);
 if(action==="delete"){if(!task||!confirm(`"${task.title||task.baslik}" görevini kalıcı olarak silmek istiyor musun?`))return;await deleteDoc(doc(db,"gorevler",id));await loadTasks();renderStats();return}
 const ref=doc(db,"gorevler",id);let patch={updatedAt:serverTimestamp()};
 if(action==="approve"){
  patch.status="approved";
  patch.approvedAt=serverTimestamp();
  patch.teacherNote="";
  patch.unlockedOverride=true;
 }
 if(action==="revision"){
  const note=prompt("Öğrenciye gönderilecek düzeltme notunu yazın:","Eksiklerini tamamlayıp tekrar gönder.");
  if(note===null)return;
  patch.status="revision";
  patch.teacherNote=note.trim();
  patch.unlockedOverride=false;
 }
 if(action==="unlock")patch.unlockedOverride=true;
 if(action==="skip"){patch.status="skipped";patch.unlockedOverride=true}
 await updateDoc(ref,patch);await loadTasks();renderStats();
}