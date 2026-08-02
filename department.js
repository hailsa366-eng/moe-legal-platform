
legalBootstrapStorage();

const rawSession = sessionStorage.getItem(LEGAL_SESSION_KEY);
let currentUser = null;

if (!rawSession) {
  window.location.replace("index.html");
} else {
  try {
    const session = JSON.parse(rawSession);
    currentUser = legalGetUsers().find((user) =>
      user.id === session.userId &&
      String(user.username) === String(session.username) &&
      String(user.department) === String(session.department) &&
      user.active !== false
    );
  } catch (_) {
    currentUser = null;
  }

  if (!currentUser) {
    sessionStorage.removeItem(LEGAL_SESSION_KEY);
    alert("انتهت صلاحية الدخول أو تم تعديل بيانات المستخدم.");
    window.location.replace("index.html");
  }
}

if (currentUser) {
  const department = currentUser.department;
  const name = currentUser.fullName;
  const username = currentUser.username;
  const email = currentUser.email || "غير مسجل";

  document.title = `${department} | منصة الممثلين القانونيين`;
  document.getElementById("sidebarDepartment").textContent = department;
  document.getElementById("departmentTitle").textContent = department;
  document.getElementById("welcomeDepartment").textContent = department;
  document.getElementById("profileName").textContent = name;
  document.getElementById("profileUsername").textContent = username;
  document.getElementById("profileAvatar").textContent = name.trim().charAt(0) || "م";
  document.getElementById("detailName").textContent = name;
  document.getElementById("detailUsername").textContent = username;
  document.getElementById("detailEmail").textContent = email;
  document.getElementById("detailDepartment").textContent = department;
}

const listConfigs = {
  plaintiffRoles: {
    key: LEGAL_PLAINTIFF_ROLES_KEY,
    defaults: LEGAL_DEFAULT_PLAINTIFF_ROLES,
    selectId: "plaintiffRole",
    label: "صفة المدعي"
  },
  claimTypes: {
    key: LEGAL_CLAIM_TYPES_KEY,
    defaults: LEGAL_DEFAULT_CLAIM_TYPES,
    selectId: "claimType",
    label: "طلب المدعي"
  },
  caseTypes: {
    key: LEGAL_CASE_TYPES_KEY,
    defaults: LEGAL_DEFAULT_CASE_TYPES,
    selectId: "caseType",
    label: "نوع الدعوى"
  },
  courts: {
    key: LEGAL_COURTS_KEY,
    defaults: LEGAL_DEFAULT_COURTS,
    selectId: "courtName",
    label: "اسم المحكمة"
  },
  caseRepresentatives: {
    key: LEGAL_CASE_REPRESENTATIVES_KEY,
    defaults: LEGAL_DEFAULT_CASE_REPRESENTATIVES,
    selectId: "caseRepresentative",
    label: "اسم الممثل"
  },
  appealCourts: {
    key: LEGAL_APPEAL_COURTS_KEY,
    defaults: LEGAL_DEFAULT_APPEAL_COURTS,
    selectId: "appealCourtName",
    label: "محكمة الاستئناف"
  },
  appellantTypes: {
    key: LEGAL_APPELLANT_TYPES_KEY,
    defaults: LEGAL_DEFAULT_APPELLANT_TYPES,
    selectId: "appellantType",
    label: "نوع المستأنف"
  },
  judgmentResults: {
    key: LEGAL_JUDGMENT_RESULTS_KEY,
    defaults: LEGAL_DEFAULT_JUDGMENT_RESULTS,
    selectId: "judgmentResult",
    label: "الحكم"
  }
};

let activeListName = null;
let reopenFinishModalAfterList = false;
let departmentWorkspace = legalGetDepartmentWorkspace(currentUser.department);
let cases = Array.isArray(departmentWorkspace.cases) ? departmentWorkspace.cases : [];
const departmentCases = () => cases;
const dataSyncChannel = "BroadcastChannel" in window
  ? new BroadcastChannel("legalPlatformDataSync")
  : null;

function notifyAdminDashboard(reason = "cases-updated") {
  localStorage.setItem("legalPlatformLastDataChange", JSON.stringify({
    reason,
    department: currentUser.department,
    changedAt: new Date().toISOString()
  }));

  if (dataSyncChannel) {
    dataSyncChannel.postMessage({
      type: "cases-updated",
      reason,
      department: currentUser.department,
      changedAt: Date.now()
    });
  }
}

const lawsuitsPanel = document.getElementById("lawsuitsPanel");
const casesTableBody = document.getElementById("casesTableBody");
const casesEmptyState = document.getElementById("casesEmptyState");
const caseModal = document.getElementById("caseModal");
const caseForm = document.getElementById("caseForm");
const listModal = document.getElementById("listModal");
const listForm = document.getElementById("listForm");
const finishCaseModal = document.getElementById("finishCaseModal");
const finishCaseForm = document.getElementById("finishCaseForm");
const toast = document.getElementById("departmentToast");
const casesSearchInput = document.getElementById("casesSearchInput");
const clearCasesSearch = document.getElementById("clearCasesSearch");
const casesSearchResult = document.getElementById("casesSearchResult");
const appealModal = document.getElementById("appealModal");
const appealForm = document.getElementById("appealForm");

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[char]));
}

function formatSaudiRiyal(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "—";
  return `${new Intl.NumberFormat("ar-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)} ر.س`;
}

function showToast(message, danger = false) {
  toast.textContent = message;
  toast.style.background = danger ? "#b42318" : "#067647";
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}

function getList(name) {
  const config = listConfigs[name];
  return legalEnsureList(config.key, config.defaults);
}

function renderList(name, selected = "") {
  const config = listConfigs[name];
  const select = document.getElementById(config.selectId);
  const items = getList(name);
  select.innerHTML = '<option value="">اختر</option>' +
    items.map(item => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("");
  if (selected && items.includes(selected)) select.value = selected;
}

function renderAllLists() {
  Object.keys(listConfigs).forEach(name => renderList(name));
}

function saveCases() {
  departmentWorkspace = {
    ...departmentWorkspace,
    cases
  };
  legalSaveDepartmentWorkspace(currentUser.department, departmentWorkspace);
  notifyAdminDashboard("administrative-cases-updated");
}

function normalizeSearchValue(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ");
}

function renderCases() {
  const allItems = departmentCases();
  const query = normalizeSearchValue(casesSearchInput?.value || "");

  const items = query
    ? allItems.filter(item => {
        const plaintiffName = normalizeSearchValue(item.plaintiffName);
        const caseNumber = normalizeSearchValue(item.caseNumber);
        return plaintiffName.includes(query) || caseNumber.includes(query);
      })
    : allItems;

  casesTableBody.innerHTML = items.map((item) => {
    const originalIndex = allItems.findIndex(caseItem => caseItem.id === item.id);
    return `
    <tr>
      <td>${originalIndex + 1}</td>
      <td>${escapeHtml(item.plaintiffName)}</td>
      <td>${escapeHtml(item.caseNumber)}</td>
      <td>${escapeHtml(item.plaintiffRole)}</td>
      <td>${escapeHtml(item.claimType)}</td>
      <td>${escapeHtml(item.caseType || "—")}</td>
      <td>${formatSaudiRiyal(item.claimAmount)}</td>
      <td>${escapeHtml(item.courtName)}</td>
      <td>
        ${item.status === "منتهية"
          ? '<span class="status-btn status-finished">منتهية</span>'
          : `<button type="button" class="status-btn status-pending finish-case-btn" data-id="${item.id}">منظورة</button>`}
      </td>
      <td>${escapeHtml(item.judgmentResult || "—")}</td>
      <td>${escapeHtml(item.caseRepresentative || "—")}</td>
      <td>
        <button type="button" class="action-search-btn open-appeal-btn" data-id="${item.id}" title="إضافة بيانات الاستئناف" aria-label="إضافة بيانات الاستئناف">⌕＋</button>
      </td>
    </tr>
  `;
  }).join("");

  if (query && !items.length) {
    casesTableBody.innerHTML = `
      <tr class="search-no-results">
        <td colspan="11">لا توجد دعوى مطابقة لرقم الدعوى أو اسم المدعي المدخل.</td>
      </tr>
    `;
  }

  casesEmptyState.hidden = allItems.length !== 0 || Boolean(query);

  if (casesSearchResult) {
    casesSearchResult.textContent = query
      ? `نتائج البحث: ${items.length} من أصل ${allItems.length} دعوى`
      : "";
  }

  if (clearCasesSearch) {
    clearCasesSearch.hidden = !query;
  }
}

function clearCaseErrors() {
  document.querySelectorAll("[data-case-error]").forEach(el => el.textContent = "");
}

function openCaseModal(caseItem = null) {
  caseForm.reset();
  clearCaseErrors();
  renderAllLists();

  document.getElementById("editingCaseId").value = caseItem?.id || "";
  document.getElementById("caseModalTitle").textContent = caseItem ? "تعديل بيانات الدعوى" : "إضافة دعوى جديدة";

  if (caseItem) {
    document.getElementById("plaintiffName").value = caseItem.plaintiffName;
    document.getElementById("caseNumber").value = caseItem.caseNumber;
    renderList("plaintiffRoles", caseItem.plaintiffRole);
    renderList("claimTypes", caseItem.claimType);
    renderList("caseTypes", caseItem.caseType || "");
    document.getElementById("claimAmount").value = caseItem.claimAmount || "";
    renderList("courts", caseItem.courtName);
    renderList("caseRepresentatives", caseItem.caseRepresentative || "");
  }

  caseModal.hidden = false;
}

function closeCaseModal() {
  caseModal.hidden = true;
  caseForm.reset();
  clearCaseErrors();
}

function validateCaseForm() {
  clearCaseErrors();
  const values = {
    plaintiffName: document.getElementById("plaintiffName").value.trim(),
    caseNumber: document.getElementById("caseNumber").value.trim(),
    plaintiffRole: document.getElementById("plaintiffRole").value,
    claimType: document.getElementById("claimType").value,
    caseType: document.getElementById("caseType").value,
    claimAmount: document.getElementById("claimAmount").value.trim(),
    courtName: document.getElementById("courtName").value,
    caseRepresentative: document.getElementById("caseRepresentative").value
  };

  let valid = true;
  Object.entries(values).forEach(([key, value]) => {
    if (key === "claimAmount") return;
    if (!value) {
      const error = document.querySelector(`[data-case-error="${key}"]`);
      if (error) error.textContent = "هذا الحقل مطلوب.";
      valid = false;
    }
  });

  if (values.claimAmount) {
    const amount = Number(values.claimAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      document.querySelector('[data-case-error="claimAmount"]').textContent =
        "يرجى إدخال مبلغ صحيح بالريال السعودي.";
      valid = false;
    } else {
      values.claimAmount = amount.toFixed(2);
    }
  } else {
    values.claimAmount = "";
  }

  return { valid, values };
}

document.getElementById("lawsuitsSubNav")?.addEventListener("click", () => {
  lawsuitsPanel.hidden = false;
  lawsuitsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  renderCases();
});

document.getElementById("lawsuitsNav").addEventListener("click", () => {
  lawsuitsPanel.hidden = false;
  lawsuitsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  renderCases();
});

casesSearchInput?.addEventListener("input", renderCases);

clearCasesSearch?.addEventListener("click", () => {
  casesSearchInput.value = "";
  renderCases();
  casesSearchInput.focus();
});

document.getElementById("openCaseModal").addEventListener("click", () => openCaseModal());

document.querySelectorAll(".close-case-modal").forEach(btn => btn.addEventListener("click", closeCaseModal));
caseModal.addEventListener("click", event => { if (event.target === caseModal) closeCaseModal(); });

caseForm.addEventListener("submit", event => {
  event.preventDefault();
  const { valid, values } = validateCaseForm();
  if (!valid) return;

  const editingId = document.getElementById("editingCaseId").value;
  const duplicate = cases.some(item =>
    item.caseNumber === values.caseNumber &&
    item.id !== editingId
  );

  if (duplicate) {
    document.querySelector('[data-case-error="caseNumber"]').textContent = "رقم الدعوى مسجل مسبقًا في هذه الإدارة.";
    return;
  }

  if (editingId) {
    const index = cases.findIndex(item => item.id === editingId);
    cases[index] = { ...cases[index], ...values };
    showToast("تم تعديل بيانات الدعوى بنجاح.");
  } else {
    cases.push({
      id: (crypto.randomUUID ? crypto.randomUUID() : `case-${Date.now()}`),
      department: currentUser.department,
      ...values,
      status: "منظورة",
      judgmentResult: "",
      judgmentPronouncement: "",
      createdAt: new Date().toISOString()
    });
    showToast("تمت إضافة الدعوى إلى الجدول.");
  }

  saveCases();
  renderCases();
  closeCaseModal();
});

casesTableBody.addEventListener("click", event => {
  const finishBtn = event.target.closest(".finish-case-btn");
  const appealBtn = event.target.closest(".open-appeal-btn");

  if (finishBtn) {
    const item = cases.find(caseItem => caseItem.id === finishBtn.dataset.id);
    if (!item) return;
    document.getElementById("finishingCaseId").value = item.id;
    renderList("judgmentResults", item.judgmentResult || "");
    finishCaseModal.hidden = false;
  }

  if (appealBtn) {
    const item = cases.find(caseItem => caseItem.id === appealBtn.dataset.id);
    if (!item) return;

    appealForm.reset();
    document.querySelectorAll("[data-appeal-error]").forEach(el => el.textContent = "");
    document.getElementById("appealSourceCaseId").value = item.id;
    renderList("appellantTypes", item.appellantType || "مستأنف");
    renderList("appealCourts", item.appealCourtName || "محكمة الاستئناف بالرياض");

    document.getElementById("appealCaseSummary").innerHTML = `
      <div><small>اسم المدعي</small><strong>${escapeHtml(item.plaintiffName)}</strong></div>
      <div><small>رقم الدعوى الابتدائية</small><strong>${escapeHtml(item.caseNumber)}</strong></div>
      <div><small>اسم الممثل</small><strong>${escapeHtml(item.caseRepresentative || "—")}</strong></div>
    `;

    appealModal.hidden = false;
  }
});


function closeAppealModal() {
  appealModal.hidden = true;
  appealForm.reset();
  document.querySelectorAll("[data-appeal-error]").forEach(el => el.textContent = "");
}

document.querySelectorAll(".close-appeal-modal").forEach(button => {
  button.addEventListener("click", closeAppealModal);
});

appealModal.addEventListener("click", event => {
  if (event.target === appealModal) closeAppealModal();
});

appealForm.addEventListener("submit", event => {
  event.preventDefault();
  document.querySelectorAll("[data-appeal-error]").forEach(el => el.textContent = "");

  const sourceCaseId = document.getElementById("appealSourceCaseId").value;
  const sourceCase = cases.find(item => item.id === sourceCaseId);

  const values = {
    appealCaseNumber: document.getElementById("appealCaseNumber").value.trim(),
    appellantType: document.getElementById("appellantType").value,
    appealSessionDate: document.getElementById("appealSessionDate").value,
    appealSessionTime: document.getElementById("appealSessionTime").value,
    appealCourtName: document.getElementById("appealCourtName").value
  };

  let valid = Boolean(sourceCase);
  Object.entries(values).forEach(([key, value]) => {
    if (!value) {
      const error = document.querySelector(`[data-appeal-error="${key}"]`);
      if (error) error.textContent = "هذا الحقل مطلوب.";
      valid = false;
    }
  });
  if (!valid) return;

  const appeals = Array.isArray(departmentWorkspace.appeals)
    ? departmentWorkspace.appeals
    : [];

  const duplicate = appeals.some(item =>
    item.appealCaseNumber === values.appealCaseNumber
  );

  if (duplicate) {
    document.querySelector('[data-appeal-error="appealCaseNumber"]').textContent =
      "رقم دعوى الاستئناف مسجل مسبقًا.";
    return;
  }

  appeals.push({
    id: (crypto.randomUUID ? crypto.randomUUID() : `appeal-${Date.now()}`),
    sourceCaseId: sourceCase.id,
    department: currentUser.department,
    plaintiffName: sourceCase.plaintiffName,
    originalCaseNumber: sourceCase.caseNumber,
    plaintiffRole: sourceCase.plaintiffRole,
    claimType: sourceCase.claimType,
    originalCourtName: sourceCase.courtName,
    originalStatus: sourceCase.status,
    judgmentResult: sourceCase.judgmentResult || "",
    judgmentPronouncement: sourceCase.judgmentPronouncement || "",
    caseRepresentative: sourceCase.caseRepresentative || "",
    ...values,
    appealStatus: "منظورة",
    transferredAt: new Date().toISOString()
  });

  departmentWorkspace = {
    ...departmentWorkspace,
    appeals
  };
  legalSaveDepartmentWorkspace(currentUser.department, departmentWorkspace);
  notifyAdminDashboard("appeals-updated");

  const transferredAppeal = appeals[appeals.length - 1];
  const transferPayload = encodeURIComponent(JSON.stringify(transferredAppeal));

  closeAppealModal();
  showToast("تم حفظ بيانات الدعوى وترحيلها إلى صفحة الاستئناف.");

  setTimeout(() => {
    window.location.href = `appeals.html?transfer=${transferPayload}`;
  }, 350);
});


document.querySelectorAll(".add-list-item").forEach(button => {
  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();

    activeListName = button.dataset.list;
    const config = listConfigs[activeListName];
    if (!config) {
      showToast("تعذر فتح قائمة الإضافة.", true);
      return;
    }

    reopenFinishModalAfterList =
      !finishCaseModal.hidden &&
      activeListName === "judgmentResults";

    document.getElementById("listModalTitle").textContent = `إضافة ${config.label}`;
    document.getElementById("newListItem").value = "";
    document.getElementById("listItemError").textContent = "";
    listModal.hidden = false;
    setTimeout(() => document.getElementById("newListItem").focus(), 50);
  });
});

document.querySelectorAll(".delete-list-item").forEach(button => {
  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    const listName = button.dataset.list;
    const config = listConfigs[listName];
    const select = document.getElementById(config.selectId);
    const selected = select.value;

    if (!selected) {
      showToast("اختر عنصرًا من القائمة أولًا.", true);
      return;
    }

    if (!confirm(`هل تريد حذف "${selected}" من قائمة ${config.label}؟`)) return;

    const updated = getList(listName).filter(item => item !== selected);
    legalWriteJson(config.key, updated);
    renderList(listName);
    showToast("تم حذف العنصر من القائمة.", true);
  });
});

listForm.addEventListener("submit", event => {
  event.preventDefault();
  const input = document.getElementById("newListItem");
  const error = document.getElementById("listItemError");
  const value = input.value.trim();
  const config = listConfigs[activeListName];
  const items = getList(activeListName);

  error.textContent = "";
  if (!value) {
    error.textContent = "يرجى إدخال اسم العنصر.";
    return;
  }
  if (items.some(item => item.toLowerCase() === value.toLowerCase())) {
    error.textContent = "هذا العنصر موجود مسبقًا.";
    return;
  }

  items.push(value);
  legalWriteJson(config.key, items);
  renderList(activeListName, value);

  listModal.hidden = true;
  document.getElementById("listItemError").textContent = "";

  if (reopenFinishModalAfterList) {
    finishCaseModal.hidden = false;
  }
  reopenFinishModalAfterList = false;

  showToast(`تمت إضافة "${value}" إلى قائمة ${config.label}.`);
});

function closeListModal() {
  listModal.hidden = true;
  document.getElementById("listItemError").textContent = "";
  reopenFinishModalAfterList = false;
}

document.querySelectorAll(".close-list-modal").forEach(btn =>
  btn.addEventListener("click", closeListModal)
);

listModal.addEventListener("click", event => {
  if (event.target === listModal) closeListModal();
});

document.querySelectorAll(".close-finish-modal").forEach(btn => btn.addEventListener("click", () => finishCaseModal.hidden = true));
finishCaseModal.addEventListener("click", event => { if (event.target === finishCaseModal) finishCaseModal.hidden = true; });

finishCaseForm.addEventListener("submit", event => {
  event.preventDefault();
  document.querySelectorAll("[data-finish-error]").forEach(el => el.textContent = "");

  const judgmentResult = document.getElementById("judgmentResult").value;
  let valid = true;

  if (!judgmentResult) {
    document.querySelector('[data-finish-error="judgmentResult"]').textContent = "اختر الحكم.";
    valid = false;
  }
  if (!valid) return;

  const caseId = document.getElementById("finishingCaseId").value;
  const index = cases.findIndex(item => item.id === caseId);
  if (index === -1) return;

  cases[index] = {
    ...cases[index],
    status: "منتهية",
    judgmentResult,
    finishedAt: new Date().toISOString()
  };

  saveCases();
  renderCases();
  finishCaseModal.hidden = true;
  showToast("تم إنهاء الدعوى وإظهار الحكم في الجدول.");
});


function renderDepartmentRepresentatives() {
  const grid = document.getElementById("representativesGrid");
  if (!grid) return;

  const representatives = legalGetUsers().filter(user =>
    user.department === currentUser.department && user.active !== false
  );

  grid.innerHTML = representatives.map(user => {
    const isCurrent = user.id === currentUser.id;
    return `
      <article class="representative-card ${isCurrent ? "current-representative" : ""}">
        <div class="representative-avatar">${escapeHtml((user.fullName || "م").trim().charAt(0) || "م")}</div>
        <div>
          <strong>${escapeHtml(user.fullName || "مستخدم")}</strong>
          <small>${escapeHtml(user.username || "")}</small>
          ${isCurrent ? '<span class="current-label">المستخدم الحالي</span>' : ""}
        </div>
      </article>
    `;
  }).join("");

  if (!representatives.length) {
    grid.innerHTML = "<p>لا يوجد ممثلون مرتبطون بهذه الإدارة.</p>";
  }
}

document.getElementById("logoutBtn").addEventListener("click", () => {
  sessionStorage.removeItem(LEGAL_SESSION_KEY);
  window.location.replace("index.html");
});

renderAllLists();
renderDepartmentRepresentatives();
renderCases();
