(() => {
legalBootstrapStorage();
let users = legalGetUsers().map(user => ({ ...user, username: String(user.nationalId || "").trim() }));
let pendingDeleteId = null;
let departments = legalReadJson(LEGAL_DEPARTMENTS_KEY, [...LEGAL_DEFAULT_DEPARTMENTS]);

const departmentModal = document.getElementById("departmentModal");
const departmentForm = document.getElementById("departmentForm");
const newDepartmentName = document.getElementById("newDepartmentName");
const departmentNameError = document.getElementById("departmentNameError");

const tbody = document.getElementById("usersTableBody");
const emptyState = document.getElementById("emptyState");
const userModal = document.getElementById("userModal");
const deleteModal = document.getElementById("deleteModal");
const userForm = document.getElementById("userForm");
const searchInput = document.getElementById("searchInput");
const toast = document.getElementById("toast");

const fields = {
  editingId: document.getElementById("editingId"),
  fullName: document.getElementById("fullName"),
  nationalId: document.getElementById("nationalId"),
  email: document.getElementById("email"),
  department: document.getElementById("department"),
  password: document.getElementById("userPassword")
};

function loadDepartments() {
  const saved = localStorage.getItem(LEGAL_DEPARTMENTS_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch (_) {}
  }
  legalWriteJson(LEGAL_DEPARTMENTS_KEY, LEGAL_DEFAULT_DEPARTMENTS);
  return [...LEGAL_DEFAULT_DEPARTMENTS];
}

function saveDepartments() {
  legalWriteJson(LEGAL_DEPARTMENTS_KEY, departments);
}

function renderDepartments(selectedValue = "") {
  const select = fields.department;
  select.innerHTML = '<option value="">اختر الإدارة</option>' +
    departments.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
  if (selectedValue && departments.includes(selectedValue)) {
    select.value = selectedValue;
  }
}

function loadUsers() {
  const saved = localStorage.getItem(LEGAL_USERS_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch (_) {}
  }
  legalSaveUsers(LEGAL_DEFAULT_USERS.map(item => ({...item})));
  return LEGAL_DEFAULT_USERS.map(item => ({...item}));
}

function saveUsers() {
  legalSaveUsers(users);
}

function escapeHtml(value = "") {
  return value.replace(/[&<>"']/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[char]));
}

function renderUsers(filter = "") {
  const q = filter.trim().toLowerCase();
  const filtered = users.filter(user =>
    [user.fullName, user.nationalId, user.email || "", user.department, user.username]
      .some(value => value.toLowerCase().includes(q))
  );

  tbody.innerHTML = filtered.map((user, index) => `
    <tr>
      <td class="serial">${index + 1}</td>
      <td>${escapeHtml(user.fullName)}</td>
      <td>${escapeHtml(user.nationalId)}</td>
      <td>${escapeHtml(user.email || "")}</td>
      <td>${escapeHtml(user.department)}</td>
      <td>${escapeHtml(user.nationalId)}</td>
      <td><span class="password-mask" title="${escapeHtml(user.password)}">••••••••</span></td>
      <td>
        <div class="actions">
          <button class="action-btn edit-btn" type="button" data-action="edit" data-id="${user.id}" title="تعديل">✎</button>
          <button class="action-btn delete-btn" type="button" data-action="delete" data-id="${user.id}" title="حذف">🗑</button>
        </div>
      </td>
    </tr>
  `).join("");

  emptyState.hidden = filtered.length !== 0;
  updateStats();
}

function updateStats() {
  document.getElementById("totalUsers").textContent = users.length;
  document.getElementById("activeUsers").textContent = users.filter(u => u.active !== false).length;
  document.getElementById("departmentsCount").textContent = new Set(users.map(u => u.department)).size;
}

function openModal(mode = "add", user = null) {
  clearErrors();
  userForm.reset();

  if (mode === "edit" && user) {
    document.getElementById("modalTitle").textContent = "تعديل بيانات المستخدم";
    document.getElementById("saveUserBtn").innerHTML = "<span>✓</span> حفظ التعديل";
    fields.editingId.value = user.id;
    fields.fullName.value = user.fullName;
    fields.nationalId.value = user.nationalId;
    fields.email.value = user.email || "";
    renderDepartments(user.department);
    fields.department.value = user.department;
    fields.password.value = user.password;
  } else {
    document.getElementById("modalTitle").textContent = "إضافة مستخدم جديد";
    document.getElementById("saveUserBtn").innerHTML = "<span>＋</span> إضافة";
    fields.editingId.value = "";
    renderDepartments();
  }

  userModal.hidden = false;
  setTimeout(() => fields.fullName.focus(), 30);
}

function closeModal() {
  userModal.hidden = true;
  userForm.reset();
  clearErrors();
}

function clearErrors() {
  document.querySelectorAll("[data-error-for]").forEach(el => el.textContent = "");
}

function setError(fieldName, message) {
  document.querySelector(`[data-error-for="${fieldName}"]`).textContent = message;
}

function validateForm() {
  clearErrors();
  let valid = true;

  if (!fields.fullName.value.trim()) {
    setError("fullName", "يرجى إدخال الاسم.");
    valid = false;
  }

  if (!/^\d{10}$/.test(fields.nationalId.value.trim())) {
    setError("nationalId", "رقم الهوية يجب أن يتكون من 10 أرقام.");
    valid = false;
  }

  if (!fields.email.value.trim()) {
    setError("email", "يرجى إدخال البريد الإلكتروني.");
    valid = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.value.trim())) {
    setError("email", "يرجى إدخال بريد إلكتروني صحيح.");
    valid = false;
  }

  if (!fields.department.value) {
    setError("department", "يرجى اختيار الإدارة التابعة.");
    valid = false;
  }

  if (fields.password.value.length < 6) {
    setError("userPassword", "كلمة المرور يجب ألا تقل عن 6 أحرف.");
    valid = false;
  }

  const duplicateNationalId = users.some(user =>
    user.nationalId === fields.nationalId.value.trim() &&
    user.id !== fields.editingId.value
  );
  if (duplicateNationalId) {
    setError("nationalId", "رقم الهوية مسجل لمستخدم آخر.");
    valid = false;
  }

  const duplicateEmail = users.some(user =>
    (user.email || "").toLowerCase() === fields.email.value.trim().toLowerCase() &&
    user.id !== fields.editingId.value
  );
  if (duplicateEmail) {
    setError("email", "البريد الإلكتروني مسجل لمستخدم آخر.");
    valid = false;
  }

  return valid;
}

function showToast(message, danger = false) {
  toast.textContent = message;
  toast.style.background = danger ? "#b42318" : "#067647";
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2600);
}

document.getElementById("openAddModal").addEventListener("click", () => openModal());

document.querySelectorAll(".close-modal").forEach(button => {
  button.addEventListener("click", closeModal);
});

userModal.addEventListener("click", event => {
  if (event.target === userModal) closeModal();
});

document.querySelector(".show-password").addEventListener("click", event => {
  const show = fields.password.type === "password";
  fields.password.type = show ? "text" : "password";
  event.currentTarget.setAttribute("aria-label", show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور");
});

fields.nationalId.addEventListener("input", () => {
  fields.nationalId.value = fields.nationalId.value.replace(/\D/g, "").slice(0, 10);
});

userForm.addEventListener("submit", event => {
  event.preventDefault();
  if (!validateForm()) return;

  const data = {
    fullName: fields.fullName.value.trim(),
    nationalId: fields.nationalId.value.trim(),
    email: fields.email.value.trim(),
    department: fields.department.value,
    username: fields.nationalId.value.trim(),
    password: fields.password.value,
    active: true,
    mustChangePassword: true
  };

  if (fields.editingId.value) {
    const index = users.findIndex(user => user.id === fields.editingId.value);
    users[index] = { ...users[index], ...data };
    showToast("تم تعديل بيانات المستخدم بنجاح.");
  } else {
    users.push({ id: (crypto.randomUUID ? crypto.randomUUID() : `usr-${Date.now()}-${Math.random().toString(16).slice(2)}`), ...data });
    showToast("تمت إضافة المستخدم إلى الجدول بنجاح.");
  }

  saveUsers();
  renderUsers(searchInput.value);
  closeModal();
});

tbody.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const user = users.find(item => item.id === button.dataset.id);
  if (!user) return;

  if (button.dataset.action === "edit") {
    openModal("edit", user);
  } else if (button.dataset.action === "delete") {
    pendingDeleteId = user.id;
    deleteModal.hidden = false;
  }
});

document.getElementById("cancelDelete").addEventListener("click", () => {
  pendingDeleteId = null;
  deleteModal.hidden = true;
});

document.getElementById("confirmDelete").addEventListener("click", () => {
  users = users.filter(user => user.id !== pendingDeleteId);
  saveUsers();
  renderUsers(searchInput.value);
  pendingDeleteId = null;
  deleteModal.hidden = true;
  showToast("تم حذف المستخدم بنجاح.", true);
});

deleteModal.addEventListener("click", event => {
  if (event.target === deleteModal) {
    pendingDeleteId = null;
    deleteModal.hidden = true;
  }
});

searchInput.addEventListener("input", () => renderUsers(searchInput.value));

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    if (!userModal.hidden) closeModal();
    if (!deleteModal.hidden) {
      pendingDeleteId = null;
      deleteModal.hidden = true;
    }
  }
});

renderDepartments();

document.getElementById("openDepartmentModal").addEventListener("click", () => {
  departmentForm.reset();
  departmentNameError.textContent = "";
  departmentModal.hidden = false;
  setTimeout(() => newDepartmentName.focus(), 30);
});

document.querySelectorAll(".close-department-modal").forEach(button => {
  button.addEventListener("click", () => {
    departmentModal.hidden = true;
    departmentForm.reset();
    departmentNameError.textContent = "";
  });
});

departmentModal.addEventListener("click", event => {
  if (event.target === departmentModal) {
    departmentModal.hidden = true;
    departmentForm.reset();
    departmentNameError.textContent = "";
  }
});

departmentForm.addEventListener("submit", event => {
  event.preventDefault();
  const name = newDepartmentName.value.trim();
  departmentNameError.textContent = "";

  if (!name) {
    departmentNameError.textContent = "يرجى إدخال اسم الإدارة.";
    return;
  }

  if (departments.some(item => item.toLowerCase() === name.toLowerCase())) {
    departmentNameError.textContent = "هذه الإدارة موجودة مسبقًا.";
    return;
  }

  departments.push(name);
  saveDepartments();
  renderDepartments(name);
  departmentModal.hidden = true;
  departmentForm.reset();
  showToast("تمت إضافة الإدارة إلى القائمة بنجاح.");
});

document.getElementById("deleteDepartmentBtn").addEventListener("click", () => {
  const selected = fields.department.value;

  if (!selected) {
    showToast("اختر الإدارة التي تريد حذفها أولًا.", true);
    return;
  }

  const isUsed = users.some(user => user.department === selected);
  if (isUsed) {
    showToast("لا يمكن حذف إدارة مرتبطة بمستخدم مسجل.", true);
    return;
  }

  const confirmed = window.confirm(`هل تريد حذف إدارة "${selected}" من القائمة؟`);
  if (!confirmed) return;

  departments = departments.filter(name => name !== selected);
  saveDepartments();
  renderDepartments();
  showToast("تم حذف الإدارة من القائمة بنجاح.", true);
});


renderUsers();

})();
