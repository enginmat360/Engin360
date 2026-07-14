import {auth,db} from "./firebase.js";
import {onAuthStateChanged,signOut} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {collection,query,where,getDocs,doc,getDoc} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
const $=id=>document.getElementById(id);
let parentUser=null,parentData=null,studentData=null,tasks=[];
function esc(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
$("logoutBtn").onclick=async()=>{await signOut(auth);location.replace("gorev-giris.html")};
onAuthStateChanged(auth,async user=>{
 if(!user){location.replace("gorev-giris.html");return}
 const snap=await getDoc(doc(db,"users",user.uid));
 if(!snap.exists()||snap.data().role!=="parent"||snap.data().active===false){await signOut(auth);location.replace("gorev-giris.html");return}
 parentUser=user;parentData=snap.data();
 if(!parentData.studentId){$("studentSummary").textContent="Bu veli hesabına henüz öğrenci bağlanmamış.";return}
 const ss=await getDoc(doc(db,"users",parentData.studentId));
 if(!ss.exists()){$("studentSummary").textContent="Bağlı öğrenci kaydı bulunamadı.";return}
 studentData={id:ss.id,...ss.data()};
 $("parentInfo").textContent=(parentData.name||"Veli")+" • "+(studentData.name||"Öğrenci");
 await loadTasks();
});
async function loadTasks(){
 const snap=await getDocs(query(collection(db,"gorevler"),where("studentId","==",studentData.id)));
 tasks=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))||(b.order||0)-(a.order||0));
 render();
}
function statusText(s){return({pending:"Bekliyor",submitted:"Öğretmen onayı bekliyor",approved:"Tamamlandı",revision:"Tekrar yapılacak",skipped:"Öğretmen geçti"}[s]||"Bekliyor")}
function statusClass(s){return s==="approved"||s==="skipped"?"approved":s==="revision"?"revision":s==="submitted"?"submitted":"pending"}
function render(){
 const done=tasks.filter(t=>["approved","skipped"].includes(t.status)).length;
 const active=tasks.length-done;
 const rate=tasks.length?Math.round(done/tasks.length*100):0;
 $("totalCount").textContent=tasks.length;$("doneCount").textContent=done;$("activeCount").textContent=active;$("rateCount").textContent="%"+rate;
 $("progressBar").style.width=rate+"%";
 $("studentSummary").innerHTML=`<b>${esc(studentData.name||"Öğrenci")}</b><br><span class="muted">${esc(studentData.email||"")}</span><br><br>Görevlerin <b>%${rate}</b> kadarı tamamlandı.`;
 const notes=tasks.filter(t=>t.teacherNote).slice(0,4);
 $("teacherNotes").innerHTML=notes.length?`<h3>Öğretmen Notları</h3>`+notes.map(t=>`<div class="parent-note"><b>${esc(t.title||t.baslik||"Görev")}</b><br>${esc(t.teacherNote)}</div>`).join(""):'<div class="notice">Henüz öğretmen notu bulunmuyor.</div>';
 const latest=tasks.slice(0,3);
 $("statusSummary").innerHTML=latest.length?latest.map(t=>`<div class="item"><div class="item-head"><div><h3>${esc(t.title||t.baslik)}</h3><div class="muted">${esc(t.date||"")}</div></div><span class="badge ${statusClass(t.status)}">${statusText(t.status)}</span></div></div>`).join(""):'<div class="notice">Henüz görev yok.</div>';
 $("tasksList").innerHTML=tasks.length?tasks.map(t=>`<div class="item"><div class="item-head"><div><h3>${esc(t.title||t.baslik)}</h3><div class="muted">${esc(t.description||"")}</div></div><span class="badge ${statusClass(t.status)}">${statusText(t.status)}</span></div>
 <div class="meta"><span>${esc(t.date||"")}</span><span>${esc(t.startTime||"")}–${esc(t.endTime||"")}</span><span>Sıra ${t.order||1}</span></div>
 ${t.teacherNote?`<div class="notice"><b>Öğretmen notu:</b> ${esc(t.teacherNote)}</div>`:""}</div>`).join(""):'<div class="notice">Öğrenciye atanmış görev bulunmuyor.</div>';
}