legalBootstrapStorage();

const FINAL_JUDGMENTS_KEY = "legalPlatformFinalJudgments";
let activeTab = "all";
let allRows = [];
let lastDataSignature = "";
const syncChannel = "BroadcastChannel" in window
  ? new BroadcastChannel("legalPlatformDataSync")
  : null;

const els = {
  totalCases: document.getElementById("totalCases"),
  pendingCases: document.getElementById("pendingCases"),
  finishedCases: document.getElementById("finishedCases"),
  appealCases: document.getElementById("appealCases"),
  judgmentCases: document.getElementById("judgmentCases"),
  activeDepartments: document.getElementById("activeDepartments"),
  pendingRate: document.getElementById("pendingRate"),
  finishedRate: document.getElementById("finishedRate"),
  donut: document.getElementById("casesDonut"),
  donutTotal: document.getElementById("donutTotal"),
  legendPending: document.getElementById("legendPending"),
  legendFinished: document.getElementById("legendFinished"),
  alertsList: document.getElementById("alertsList"),
  departmentsBody: document.getElementById("departmentsTableBody"),
  departmentsEmpty: document.getElementById("departmentsEmpty"),
  casesBody: document.getElementById("adminCasesTableBody"),
  casesEmpty: document.getElementById("casesEmpty"),
  search: document.getElementById("caseSearchInput"),
  departmentFilter: document.getElementById("departmentFilter"),
  statusFilter: document.getElementById("statusFilter"),
  levelFilter: document.getElementById("levelFilter"),
  resultsMeta: document.getElementById("resultsMeta"),
  toast: document.getElementById("adminToast")
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[char]));
}

function readJsonObject(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (_) { return {}; }
}

function readJsonArray(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) { return []; }
}

function normalizeStatus(value) {
  const status = String(value || "").trim();
  return status === "منتهية" ? "منتهية" : "منظورة";
}

function buildRows() {
  const workspaces = readJsonObject(LEGAL_DEPARTMENT_WORKSPACES_KEY);
  const rows = [];

  Object.entries(workspaces).forEach(([department, workspace]) => {
    const cases = Array.isArray(workspace.cases) ? workspace.cases : [];
    const appeals = Array.isArray(workspace.appeals) ? workspace.appeals : [];

    cases.forEach(item => rows.push({
      id: item.id,
      department,
      level: "إدارية",
      plaintiffName: item.plaintiffName || "",
      caseNumber: item.caseNumber || item.originalCaseNumber || "",
      plaintiffRole: item.plaintiffRole || "",
      claimType: item.claimType || "",
      courtName: item.courtName || "",
      status: normalizeStatus(item.status),
      judgment: item.judgmentResult || "",
      representative: item.caseRepresentative || "",
      createdAt: item.createdAt || "",
      source: item
    }));

    appeals.forEach(item => rows.push({
      id: item.id,
      department,
      level: "استئناف",
      plaintiffName: item.plaintiffName || "",
      caseNumber: item.appealCaseNumber || "",
      plaintiffRole: item.plaintiffRole || "",
      claimType: item.claimType || "",
      courtName: item.appealCourtName || "",
      status: normalizeStatus(item.appealStatus),
      judgment: item.appealJudgment || "",
      representative: item.caseRepresentative || "",
      createdAt: item.transferredAt || item.appealFinishedAt || "",
      source: item
    }));
  });

  return rows;
}

function getJudgmentCount() {
  return readJsonArray(FINAL_JUDGMENTS_KEY).length;
}

function percentage(part, total) {
  return total ? Math.round((part / total) * 100) : 0;
}

function renderStats() {
  const total = allRows.length;
  const pending = allRows.filter(r => r.status === "منظورة").length;
  const finished = allRows.filter(r => r.status === "منتهية").length;
  const appeals = allRows.filter(r => r.level === "استئناف").length;
  const departments = new Set(allRows.map(r => r.department).filter(Boolean)).size;
  const judgments = getJudgmentCount();

  els.totalCases.textContent = total;
  els.pendingCases.textContent = pending;
  els.finishedCases.textContent = finished;
  els.appealCases.textContent = appeals;
  els.judgmentCases.textContent = judgments;
  els.activeDepartments.textContent = departments;
  els.pendingRate.textContent = `${percentage(pending,total)}% من الإجمالي`;
  els.finishedRate.textContent = `${percentage(finished,total)}% من الإجمالي`;
  els.donutTotal.textContent = total;
  els.legendPending.textContent = pending;
  els.legendFinished.textContent = finished;

  const pendingDegrees = total ? (pending / total) * 360 : 0;
  els.donut.style.background =
    `conic-gradient(var(--warning) 0deg ${pendingDegrees}deg, var(--success) ${pendingDegrees}deg 360deg)`;

  document.getElementById("allTabCount").textContent = total;
  document.getElementById("pendingTabCount").textContent = pending;
  document.getElementById("finishedTabCount").textContent = finished;
}

function renderAlerts() {
  const pending = allRows.filter(r => r.status === "منظورة").length;
  const appealsPending = allRows.filter(r => r.level === "استئناف" && r.status === "منظورة").length;
  const withoutRepresentative = allRows.filter(r => !r.representative).length;

  const alerts = [];
  if (pending > 0) alerts.push({type:"warning",icon:"!",title:`${pending} دعوى ما زالت قائمة`,text:"تحتاج إلى متابعة الممثلين والإجراءات القادمة."});
  if (appealsPending > 0) alerts.push({type:"info",icon:"⇧",title:`${appealsPending} دعوى استئناف منظورة`,text:"راجع مواعيد الجلسات وحالة أحكام الاستئناف."});
  if (withoutRepresentative > 0) alerts.push({type:"warning",icon:"♙",title:`${withoutRepresentative} دعوى بلا ممثل مسجل`,text:"ينبغي استكمال تعيين ممثل قانوني للدعوى."});
  if (!alerts.length) alerts.push({type:"success",icon:"✓",title:"لا توجد تنبيهات حرجة",text:"جميع الدعاوى المسجلة مستوفية لمؤشرات المتابعة الأساسية."});

  els.alertsList.innerHTML = alerts.map(a => `
    <div class="alert-item alert-${a.type}">
      <span class="alert-icon">${a.icon}</span>
      <div><strong>${escapeHtml(a.title)}</strong><small>${escapeHtml(a.text)}</small></div>
    </div>
  `).join("");
}

function renderDepartmentSummary() {
  const groups = {};
  allRows.forEach(row => {
    if (!groups[row.department]) groups[row.department] = {total:0,pending:0,finished:0,appeals:0};
    const g = groups[row.department];
    g.total += 1;
    if (row.status === "منتهية") g.finished += 1; else g.pending += 1;
    if (row.level === "استئناف") g.appeals += 1;
  });

  const judgments = readJsonArray(FINAL_JUDGMENTS_KEY);
  judgments.forEach(item => {
    const dept = item.department || "غير محدد";
    if (!groups[dept]) groups[dept] = {total:0,pending:0,finished:0,appeals:0};
    groups[dept].judgments = (groups[dept].judgments || 0) + 1;
  });

  const entries = Object.entries(groups).sort((a,b) => b[1].total - a[1].total);
  els.departmentsBody.innerHTML = entries.map(([department,g]) => {
    const rate = percentage(g.finished,g.total);
    return `
      <tr>
        <td><strong>${escapeHtml(department)}</strong></td>
        <td>${g.total}</td>
        <td><span class="status-badge status-pending">${g.pending}</span></td>
        <td><span class="status-badge status-finished">${g.finished}</span></td>
        <td>${g.appeals}</td>
        <td>${g.judgments || 0}</td>
        <td><span class="progress-bar"><span class="progress-fill" style="width:${rate}%"></span></span><span class="rate-label">${rate}%</span></td>
      </tr>
    `;
  }).join("");

  els.departmentsEmpty.hidden = entries.length !== 0;
}

function populateDepartmentFilter() {
  const departments = [...new Set(allRows.map(r => r.department).filter(Boolean))].sort();
  els.departmentFilter.innerHTML = '<option value="">جميع الإدارات</option>' +
    departments.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join("");
}

function getFilteredRows() {
  const query = els.search.value.trim().toLowerCase();
  const department = els.departmentFilter.value;
  const status = els.statusFilter.value;
  const level = els.levelFilter.value;

  return allRows.filter(row => {
    if (activeTab === "pending" && row.status !== "منظورة") return false;
    if (activeTab === "finished" && row.status !== "منتهية") return false;
    if (department && row.department !== department) return false;
    if (status && row.status !== status) return false;
    if (level && row.level !== level) return false;
    if (query) {
      const haystack = [row.plaintiffName,row.caseNumber,row.representative,row.department,row.claimType]
        .join(" ").toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

function renderCases() {
  const rows = getFilteredRows();
  els.casesBody.innerHTML = rows.map((row,index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(row.department)}</td>
      <td><span class="level-badge ${row.level === "استئناف" ? "level-appeal" : "level-admin"}">${row.level}</span></td>
      <td>${escapeHtml(row.plaintiffName || "—")}</td>
      <td>${escapeHtml(row.caseNumber || "—")}</td>
      <td>${escapeHtml(row.plaintiffRole || "—")}</td>
      <td>${escapeHtml(row.claimType || "—")}</td>
      <td>${escapeHtml(row.courtName || "—")}</td>
      <td><span class="status-badge ${row.status === "منتهية" ? "status-finished" : "status-pending"}">${row.status}</span></td>
      <td>${escapeHtml(row.judgment || "—")}</td>
      <td>${escapeHtml(row.representative || "—")}</td>
    </tr>
  `).join("");

  els.casesEmpty.hidden = rows.length !== 0;
  els.resultsMeta.textContent = `عرض ${rows.length} من أصل ${allRows.length} سجل دعوى`;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  setTimeout(() => els.toast.classList.remove("show"), 2400);
}

function exportCsv() {
  const rows = getFilteredRows();
  const headers = ["الإدارة","المرحلة","اسم المدعي","رقم الدعوى","صفة المدعي","طلب المدعي","المحكمة","الحالة","الحكم","اسم الممثل"];
  const csvRows = [headers, ...rows.map(r => [
    r.department,r.level,r.plaintiffName,r.caseNumber,r.plaintiffRole,r.claimType,r.courtName,r.status,r.judgment,r.representative
  ])];
  const csv = "\ufeff" + csvRows.map(cols => cols.map(v => `"${String(v || "").replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `تقرير_الدعاوى_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("تم تصدير تقرير الدعاوى.");
}

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    activeTab = tab.dataset.tab;
    renderCases();
  });
});

[els.search,els.departmentFilter,els.statusFilter,els.levelFilter].forEach(control => {
  control.addEventListener(control.tagName === "INPUT" ? "input" : "change", renderCases);
});

document.getElementById("clearFilters").addEventListener("click", () => {
  els.search.value = "";
  els.departmentFilter.value = "";
  els.statusFilter.value = "";
  els.levelFilter.value = "";
  activeTab = "all";
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === "all"));
  renderCases();
});

document.getElementById("exportCsvBtn").addEventListener("click", exportCsv);

function buildDataSignature() {
  const workspaces = localStorage.getItem(LEGAL_DEPARTMENT_WORKSPACES_KEY) || "";
  const judgments = localStorage.getItem(FINAL_JUDGMENTS_KEY) || "";
  return `${workspaces.length}:${workspaces.slice(-120)}|${judgments.length}:${judgments.slice(-120)}`;
}

function updateLastUpdatedText() {
  const target = document.getElementById("lastUpdatedText");
  if (!target) return;
  const now = new Date();
  target.textContent = `آخر تحديث: ${now.toLocaleTimeString("ar-SA", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  })}`;
}

function refreshDashboard(showMessage = false) {
  const currentDepartment = els.departmentFilter.value;
  allRows = buildRows();

  renderStats();
  renderAlerts();
  renderDepartmentSummary();
  populateDepartmentFilter();

  if ([...els.departmentFilter.options].some(option => option.value === currentDepartment)) {
    els.departmentFilter.value = currentDepartment;
  }

  renderCases();
  updateLastUpdatedText();
  lastDataSignature = buildDataSignature();

  if (showMessage) showToast("تم تحديث لوحة المتابعة وعرض أحدث الدعاوى.");
}

document.getElementById("refreshDashboardBtn").addEventListener("click", () => {
  refreshDashboard(true);
});

window.addEventListener("storage", () => refreshDashboard());

window.addEventListener("focus", () => refreshDashboard());

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshDashboard();
});

if (syncChannel) {
  syncChannel.addEventListener("message", event => {
    if (event.data && event.data.type === "cases-updated") {
      refreshDashboard();
    }
  });
}

// فحص دوري لضمان ظهور الدعاوى الجديدة حتى عند تشغيل المشروع محليًا من ملفات ZIP.
setInterval(() => {
  const signature = buildDataSignature();
  if (signature !== lastDataSignature) refreshDashboard();
}, 1500);

refreshDashboard();
