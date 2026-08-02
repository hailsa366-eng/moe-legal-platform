legalBootstrapStorage();

const APPEALS_PAGE_STORE_KEY = "legalPlatformAppealsPageData";
const APPEAL_JUDGMENTS_KEY = "legalPlatformAppealJudgments";
const FINAL_JUDGMENTS_KEY = "legalPlatformFinalJudgments";
const DEFAULT_APPEAL_JUDGMENTS = [
  "تأييد الحكم لصالح الجهة",
  "نقض الحكم لصالح الجهة",
  "تأييد الحكم ضد الجهة",
  "نقض الحكم ضد الجهة"
];
const rawSession = sessionStorage.getItem(LEGAL_SESSION_KEY);
let currentUser = null;

if (!rawSession) {
  window.location.replace("index.html");
} else {
  try {
    const session = JSON.parse(rawSession);
    currentUser = legalGetUsers().find(user =>
      user.id === session.userId && String(user.username) === String(session.username) &&
      String(user.department) === String(session.department) && user.active !== false
    );
  } catch (_) { currentUser = null; }
  if (!currentUser) {
    sessionStorage.removeItem(LEGAL_SESSION_KEY);
    alert("انتهت صلاحية الدخول أو تم تعديل بيانات المستخدم.");
    window.location.replace("index.html");
  }
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"}[char]));
}
function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? escapeHtml(value) : new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
}
function readAppealsPageStore() {
  try { const parsed=JSON.parse(localStorage.getItem(APPEALS_PAGE_STORE_KEY)||"[]"); return Array.isArray(parsed)?parsed:[]; } catch(_){ return []; }
}
function saveAppealsPageStore(items) { localStorage.setItem(APPEALS_PAGE_STORE_KEY, JSON.stringify(items)); }
function showToast(message, isError=false) {
  const toast=document.getElementById("departmentToast");
  toast.textContent=message; toast.classList.toggle("error-toast",isError); toast.classList.add("show");
  setTimeout(()=>toast.classList.remove("show"),3000);
}
function readAppealJudgments(){
  try {
    const items=JSON.parse(localStorage.getItem(APPEAL_JUDGMENTS_KEY)||"null");
    if(Array.isArray(items)&&items.length) return items;
  } catch(_){}
  localStorage.setItem(APPEAL_JUDGMENTS_KEY,JSON.stringify(DEFAULT_APPEAL_JUDGMENTS));
  return [...DEFAULT_APPEAL_JUDGMENTS];
}
function renderAppealJudgments(selected=""){
  const select=document.getElementById("appealJudgment");
  select.innerHTML='<option value="">اختر</option>'+readAppealJudgments().map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
  select.value=selected;
}
function importTransferredAppeal() {
  const rawTransfer=new URLSearchParams(window.location.search).get("transfer"); if(!rawTransfer) return;
  try {
    const transferred=JSON.parse(decodeURIComponent(rawTransfer)); if(!transferred||!transferred.id) return;
    const localAppeals=readAppealsPageStore();
    if(!localAppeals.some(item=>item.id===transferred.id||(item.department===transferred.department&&item.appealCaseNumber===transferred.appealCaseNumber))){localAppeals.push(transferred);saveAppealsPageStore(localAppeals);}
    history.replaceState({},document.title,"appeals.html");
  } catch(error){console.error(error);}
}
function getAllDepartmentAppeals() {
  const workspace=legalGetDepartmentWorkspace(currentUser.department);
  const combined=[...(Array.isArray(workspace.appeals)?workspace.appeals:[])];
  readAppealsPageStore().filter(i=>i.department===currentUser.department).forEach(item=>{
    if(!combined.some(e=>e.id===item.id||e.appealCaseNumber===item.appealCaseNumber)) combined.push(item);
  });
  return combined;
}

function saveFinalJudgmentRecord(item){
  let records=[];
  try {
    const parsed=JSON.parse(localStorage.getItem(FINAL_JUDGMENTS_KEY)||"[]");
    records=Array.isArray(parsed)?parsed:[];
  } catch(_) { records=[]; }

  const record={
    id: item.id || `judgment-${Date.now()}`,
    department: currentUser.department,
    plaintiffName: item.plaintiffName || "",
    originalCaseNumber: item.originalCaseNumber || item.caseNumber || "",
    appealCaseNumber: item.appealCaseNumber || "",
    plaintiffRole: item.plaintiffRole || "",
    appellantType: item.appellantType || "",
    claimType: item.claimType || "",
    judgmentResult: item.judgmentResult || "",
    appealJudgment: item.appealJudgment || "",
    caseRepresentative: item.caseRepresentative || "",
    appealStatus: "منتهية",
    administrativeJudgmentAttachment: item.administrativeJudgmentAttachment || null,
    appealJudgmentAttachment: item.appealJudgmentAttachment || null,
    transferredToJudgmentsAt: new Date().toISOString()
  };

  const index=records.findIndex(i =>
    String(i.id || "") === String(record.id) ||
    (
      String(i.originalCaseNumber || "") === String(record.originalCaseNumber) &&
      String(i.appealCaseNumber || "") === String(record.appealCaseNumber)
    )
  );

  if(index>=0) records[index]=record; else records.push(record);
  localStorage.setItem(FINAL_JUDGMENTS_KEY,JSON.stringify(records));
  return record;
}

function updateAppeal(updated){
  const workspace=legalGetDepartmentWorkspace(currentUser.department);
  const appeals=Array.isArray(workspace.appeals)?workspace.appeals:[];
  const wi=appeals.findIndex(i=>i.id===updated.id);
  if(wi>=0) appeals[wi]=updated; else appeals.push(updated);
  legalSaveDepartmentWorkspace(currentUser.department,{...workspace,appeals});
  const page=readAppealsPageStore(); const pi=page.findIndex(i=>i.id===updated.id);
  if(pi>=0) page[pi]=updated; else page.push(updated); saveAppealsPageStore(page);
}
function renderAppeals() {
  const appeals=getAllDepartmentAppeals(), body=document.getElementById("appealsTableBody"), empty=document.getElementById("appealsEmptyState");
  body.innerHTML=appeals.map((item,index)=>`<tr>
    <td>${index+1}</td><td>${escapeHtml(item.plaintiffName)}</td><td>${escapeHtml(item.appealCaseNumber)}</td>
    <td>${escapeHtml(item.appellantType||"—")}</td><td>${escapeHtml(item.appealCourtName)}</td><td>${formatDate(item.appealSessionDate)}</td>
    <td>${escapeHtml(item.appealSessionTime)}</td>
    <td><button type="button" class="status-btn ${item.appealStatus==="منتهية"?"status-done":"status-pending"}" data-finish-appeal="${escapeHtml(item.id)}">${escapeHtml(item.appealStatus||"منظورة")}</button></td>
    <td>${escapeHtml(item.appealJudgment||"—")}</td><td>${escapeHtml(item.caseRepresentative||"—")}</td></tr>`).join("");
  empty.hidden=appeals.length!==0;
}
function openFinishAppeal(id){
  const item=getAllDepartmentAppeals().find(i=>i.id===id); if(!item) return;
  document.getElementById("finishingAppealId").value=id;
  document.getElementById("appealJudgmentError").textContent="";
  document.getElementById("administrativeJudgmentFile").value="";
  document.getElementById("appealJudgmentFile").value="";
  renderAppealJudgments(item.appealJudgment||"");
  document.getElementById("finishAppealModal").hidden=false;
}
function closeFinishAppeal(){document.getElementById("finishAppealModal").hidden=true;}
function fileToRecord(file){
  return new Promise((resolve,reject)=>{
    if(!file){resolve(null);return;} if(file.size>2*1024*1024){reject(new Error(`الملف ${file.name} يتجاوز 2 ميجابايت.`));return;}
    const reader=new FileReader(); reader.onload=()=>resolve({name:file.name,type:file.type||"application/octet-stream",size:file.size,data:reader.result}); reader.onerror=()=>reject(new Error("تعذر قراءة الملف.")); reader.readAsDataURL(file);
  });
}

if(currentUser){
  document.getElementById("sidebarDepartment").textContent=currentUser.department;
  document.getElementById("profileName").textContent=currentUser.fullName;
  document.getElementById("profileUsername").textContent=currentUser.username;
  document.getElementById("profileAvatar").textContent=currentUser.fullName.trim().charAt(0)||"م";
  importTransferredAppeal(); renderAppeals(); renderAppealJudgments();
}

document.getElementById("appealsTableBody").addEventListener("click",e=>{
  const btn=e.target.closest("[data-finish-appeal]"); if(btn) openFinishAppeal(btn.dataset.finishAppeal);
});
document.querySelectorAll(".close-finish-appeal").forEach(b=>b.addEventListener("click",closeFinishAppeal));
document.getElementById("finishAppealModal").addEventListener("click",e=>{if(e.target.id==="finishAppealModal")closeFinishAppeal();});
document.getElementById("addAppealJudgment").addEventListener("click",()=>{
  const value=prompt("أدخل حكم الاستئناف الجديد:")?.trim(); if(!value)return;
  const items=readAppealJudgments(); if(items.some(i=>i.toLowerCase()===value.toLowerCase())){showToast("الحكم موجود مسبقًا.",true);return;}
  items.push(value); localStorage.setItem(APPEAL_JUDGMENTS_KEY,JSON.stringify(items)); renderAppealJudgments(value); showToast("تمت إضافة الحكم إلى القائمة.");
});
document.getElementById("deleteAppealJudgment").addEventListener("click",()=>{
  const select=document.getElementById("appealJudgment"), value=select.value; if(!value){showToast("اختر حكمًا أولًا.",true);return;}
  if(!confirm(`هل تريد حذف "${value}" من القائمة؟`))return;
  localStorage.setItem(APPEAL_JUDGMENTS_KEY,JSON.stringify(readAppealJudgments().filter(i=>i!==value))); renderAppealJudgments(); showToast("تم حذف الحكم من القائمة.");
});
document.getElementById("finishAppealForm").addEventListener("submit",async e=>{
  e.preventDefault(); const judgment=document.getElementById("appealJudgment").value;
  if(!judgment){document.getElementById("appealJudgmentError").textContent="اختر حكم الاستئناف.";return;}
  const id=document.getElementById("finishingAppealId").value;
  const item=getAllDepartmentAppeals().find(i=>i.id===id); if(!item)return;
  try{
    const adminFile=await fileToRecord(document.getElementById("administrativeJudgmentFile").files[0]);
    const appealFile=await fileToRecord(document.getElementById("appealJudgmentFile").files[0]);
    const updated={
      ...item,
      appealStatus:"منتهية",
      appealJudgment:judgment,
      administrativeJudgmentAttachment:adminFile||item.administrativeJudgmentAttachment||null,
      appealJudgmentAttachment:appealFile||item.appealJudgmentAttachment||null,
      appealFinishedAt:new Date().toISOString()
    };

    saveFinalJudgmentRecord(updated);

    const appealStoreRecord={
      ...updated,
      administrativeJudgmentAttachment: updated.administrativeJudgmentAttachment
        ? {name:updated.administrativeJudgmentAttachment.name,type:updated.administrativeJudgmentAttachment.type,size:updated.administrativeJudgmentAttachment.size}
        : null,
      appealJudgmentAttachment: updated.appealJudgmentAttachment
        ? {name:updated.appealJudgmentAttachment.name,type:updated.appealJudgmentAttachment.type,size:updated.appealJudgmentAttachment.size}
        : null
    };

    updateAppeal(appealStoreRecord);
    renderAppeals();
    closeFinishAppeal();
    showToast("تم إنهاء الدعوى وترحيل جميع بياناتها إلى الأحكام القضائية.");
    window.location.href="judgments.html";
  }catch(error){showToast(error.message||"تعذر حفظ المرفقات.",true);}
});
document.getElementById("logoutBtn").addEventListener("click",()=>{sessionStorage.removeItem(LEGAL_SESSION_KEY);window.location.replace("index.html");});
