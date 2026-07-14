import {auth,db} from "./firebase.js";
import {onAuthStateChanged,signOut} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {collection,query,where,getDocs,doc,getDoc,updateDoc,serverTimestamp} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
const $=id=>document.getElementById(id);let currentUser=null,tasks=[];
function esc(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
$("logoutBtn").onclick=async()=>{await signOut(auth);location.replace("gorev-giris.html")};
onAuthStateChanged(auth,async user=>{if(!user){location.replace("gorev-giris.html");return}currentUser=user;
 const us=await getDoc(doc(db,"users",user.uid));if(!us.exists()||us.data().role!=="student"||us.data().active===false){await signOut(auth);location.replace("gorev-giris.html");return}
 $("studentInfo").textContent=(us.data().name||"Öğrenci")+" • "+user.email;await loadTasks()});
async function loadTasks(){const snap=await getDocs(query(collection(db,"gorevler"),where("studentId","==",currentUser.uid)));
 tasks=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.date).localeCompare(String(b.date))||(a.order||0)-(b.order||0));
 render()}
function evaluate(t,index){const now=new Date();const start=t.startAt?.toDate?t.startAt.toDate():new Date(`${t.date}T${t.startTime}:00`);
 const end=t.endAt?.toDate?t.endAt.toDate():new Date(`${t.date}T${t.endTime}:00`);
 const previous=tasks[index-1];const previousDone=!previous||["approved","skipped"].includes(previous.status)||t.unlockedOverride===true;
 if(["approved","skipped"].includes(t.status))return{state:"done",label:t.status==="skipped"?"Öğretmen geçti":"Onaylandı"};
 if(t.status==="submitted")return{state:"submitted",label:"Öğretmen onayı bekleniyor"};
 if(t.status==="revision")return{state:"active",label:"Tekrar yap"};
 if(!previousDone)return{state:"locked",label:"Önceki görev tamamlanmalı"};
 if(now<start)return{state:"upcoming",label:"Saati gelmedi"};
 if(now>end)return{state:"active",label:"Süresi geçti — teslim edebilirsin"};
 return{state:"active",label:"Aktif görev"}}
function render(){const list=$("tasksList");if(!tasks.length){$("studentMessage").textContent="Henüz sana atanmış görev yok.";list.innerHTML="";return}
 $("studentMessage").textContent="Görevler sırayla açılır. Teslim ettiğin görev öğretmen onayından sonra tamamlanır.";
 let done=0,active=0,locked=0;
 list.innerHTML=tasks.map((t,i)=>{const ev=evaluate(t,i);if(ev.state==="done")done++;if(ev.state==="active")active++;if(ev.state==="locked"||ev.state==="upcoming"){locked++;return "";}
 return `<div class="item ${ev.state==="locked"?"locked-overlay":""}"><div class="item-head"><div><h3>${esc(t.title||t.baslik)}</h3><div class="muted">${esc(t.description||"")}</div></div>
 <span class="badge ${ev.state==="done"?"approved":ev.state}">${esc(ev.label)}</span></div>
 <div class="meta"><span>${esc(t.date||"")}</span><span>${esc(t.startTime||"")}–${esc(t.endTime||"")}</span><span>Sıra ${t.order||1}</span></div>
 ${t.teacherNote?`<div class="notice"><b>Öğretmen notu:</b> ${esc(t.teacherNote)}</div>`:""}
 ${ev.state==="active"?`<label>Teslim açıklaması / çözüm bağlantısı</label><textarea id="sub-${t.id}" placeholder="Ne yaptığını yaz veya Drive bağlantısı ekle">${esc(t.submissionText||"")}</textarea>
 <div class="item-actions"><button class="btn success" data-submit="${t.id}">Görevi Teslim Et</button></div>`:""}
 ${ev.state==="submitted"&&t.submissionText?`<div class="notice"><b>Teslimin:</b><br>${esc(t.submissionText)}</div>`:""}</div>`}).join("");
 $("totalCount").textContent=tasks.length;$("doneCount").textContent=done;$("activeCount").textContent=active;$("lockedCount").textContent=locked;
 document.querySelectorAll("[data-submit]").forEach(b=>b.onclick=()=>submitTask(b.dataset.submit))}
async function submitTask(id){const text=$("sub-"+id).value.trim();if(!text){alert("Teslim açıklaması veya bağlantı yazmalısın.");return}
 if(!confirm("Görevi öğretmen onayına göndermek istiyor musun?"))return;
 await updateDoc(doc(db,"gorevler",id),{submissionText:text,status:"submitted",submittedAt:serverTimestamp(),updatedAt:serverTimestamp()});await loadTasks()}
