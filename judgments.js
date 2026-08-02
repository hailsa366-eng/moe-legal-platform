legalBootstrapStorage();

const APPEALS_PAGE_STORE_KEY = "legalPlatformAppealsPageData";
const FINAL_JUDGMENTS_KEY = "legalPlatformFinalJudgments";

const rawSession = sessionStorage.getItem(LEGAL_SESSION_KEY);
let currentUser = null;
let renderedJudgments = [];

if (!rawSession) {
  window.location.replace("index.html");
} else {
  try {
    const session = JSON.parse(rawSession);
    currentUser = legalGetUsers().find(user =>
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
    window.location.replace("index.html");
  }
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function readArray(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function normalize(value) {
  return String(value || "").trim();
}

function belongsToDepartment(item) {
  const recordDepartment = normalize(item.department);
  const userDepartment = normalize(currentUser.department);
  return !recordDepartment || recordDepartment === userDepartment;
}

function recordKey(item) {
  return normalize(item.id) ||
    `${normalize(item.originalCaseNumber || item.caseNumber)}::${normalize(item.appealCaseNumber)}`;
}

function mergeRecords(target, source) {
  const key = recordKey(source);
  const index = target.findIndex(item => recordKey(item) === key);
  if (index >= 0) {
    target[index] = {...target[index], ...source};
  } else {
    target.push({...source});
  }
}

function getAllFinalJudgments() {
  const workspace = legalGetDepartmentWorkspace(currentUser.department);
  const workspaceAppeals = Array.isArray(workspace.appeals) ? workspace.appeals : [];
  const pageAppeals = readArray(APPEALS_PAGE_STORE_KEY);
  const finalRecords = readArray(FINAL_JUDGMENTS_KEY);
  const combined = [];

  finalRecords.filter(belongsToDepartment).forEach(item => mergeRecords(combined, item));
  workspaceAppeals.filter(belongsToDepartment).forEach(item => mergeRecords(combined, item));
  pageAppeals.filter(belongsToDepartment).forEach(item => mergeRecords(combined, item));

  return combined
    .filter(item =>
      normalize(item.appealJudgment) &&
      (
        normalize(item.appealStatus) === "منتهية" ||
        normalize(item.transferredToJudgmentsAt) ||
        normalize(item.appealFinishedAt)
      )
    )
    .sort((a, b) =>
      new Date(b.transferredToJudgmentsAt || b.appealFinishedAt || 0) -
      new Date(a.transferredToJudgmentsAt || a.appealFinishedAt || 0)
    );
}

function attachmentDownload(file, label) {
  if (!file || !file.data) {
    const fileName = file && file.name ? ` (${escapeHtml(file.name)})` : "";
    return `<span class="attachment-empty">لا يوجد ملف قابل للفتح${fileName}</span>`;
  }

  return `
    <a class="attachment-download-button"
       href="${file.data}"
       download="${escapeHtml(file.name || label)}">
      <span>⬇</span>
      <span>${escapeHtml(file.name || label)}</span>
    </a>
  `;
}

function render() {
  renderedJudgments = getAllFinalJudgments();
  const body = document.getElementById("judgmentsTableBody");
  const emptyState = document.getElementById("judgmentsEmptyState");

  body.innerHTML = renderedJudgments.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(item.plaintiffName || "—")}</td>
      <td>${escapeHtml(item.originalCaseNumber || item.caseNumber || "—")}</td>
      <td>${escapeHtml(item.appealCaseNumber || "—")}</td>
      <td>${escapeHtml(item.plaintiffRole || "—")}</td>
      <td>${escapeHtml(item.appellantType || "—")}</td>
      <td>${escapeHtml(item.claimType || "—")}</td>
      <td>${escapeHtml(item.judgmentResult || "—")}</td>
      <td>${escapeHtml(item.appealJudgment || "—")}</td>
      <td>${escapeHtml(item.caseRepresentative || "—")}</td>
      <td>
        <button type="button"
                class="show-attachments-button"
                data-show-attachments="${escapeHtml(recordKey(item) || String(index))}">
          ▧ إظهار المرفقات
        </button>
      </td>
    </tr>
  `).join("");

  emptyState.hidden = renderedJudgments.length > 0;
}

function findJudgmentRecord(id) {
  return renderedJudgments.find((item, index) =>
    String(recordKey(item) || index) === String(id)
  );
}

function openAttachmentsModal(id) {
  const item = findJudgmentRecord(id);
  if (!item) return;

  document.getElementById("attachmentsCaseSummary").textContent =
    `${item.plaintiffName || "—"} — الدعوى الإدارية رقم ${item.originalCaseNumber || item.caseNumber || "—"} — الاستئناف رقم ${item.appealCaseNumber || "—"}`;

  document.getElementById("administrativeAttachmentView").innerHTML =
    attachmentDownload(item.administrativeJudgmentAttachment, "مرفق الحكم الإداري");

  document.getElementById("appealAttachmentView").innerHTML =
    attachmentDownload(item.appealJudgmentAttachment, "مرفق حكم الاستئناف");

  document.getElementById("attachmentsModal").hidden = false;
}

function closeAttachmentsModal() {
  document.getElementById("attachmentsModal").hidden = true;
}

document.getElementById("sidebarDepartment").textContent = currentUser.department;
document.getElementById("profileName").textContent = currentUser.fullName;
document.getElementById("profileUsername").textContent = currentUser.username;
document.getElementById("profileAvatar").textContent =
  currentUser.fullName.trim().charAt(0) || "م";

render();

document.getElementById("judgmentsTableBody").addEventListener("click", event => {
  const button = event.target.closest("[data-show-attachments]");
  if (button) openAttachmentsModal(button.dataset.showAttachments);
});

document.querySelectorAll(".close-attachments-modal").forEach(button => {
  button.addEventListener("click", closeAttachmentsModal);
});

document.getElementById("attachmentsModal").addEventListener("click", event => {
  if (event.target.id === "attachmentsModal") closeAttachmentsModal();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeAttachmentsModal();
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  sessionStorage.removeItem(LEGAL_SESSION_KEY);
  window.location.replace("index.html");
});
