legalBootstrapStorage();

const form = document.getElementById("loginForm");
const usernameInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const usernameError = document.getElementById("emailError");
const passwordError = document.getElementById("passwordError");
const statusMessage = document.getElementById("statusMessage");
const togglePassword = document.querySelector(".toggle-password");

const passwordChangeModal = document.getElementById("passwordChangeModal");
const passwordChangeForm = document.getElementById("passwordChangeForm");
const currentPasswordInput = document.getElementById("currentPassword");
const newPasswordInput = document.getElementById("newPassword");
const confirmNewPasswordInput = document.getElementById("confirmNewPassword");
const currentPasswordError = document.getElementById("currentPasswordError");
const newPasswordError = document.getElementById("newPasswordError");
const confirmNewPasswordError = document.getElementById("confirmNewPasswordError");
const passwordChangeStatus = document.getElementById("passwordChangeStatus");

let pendingFirstLoginUserId = null;

usernameInput.addEventListener("input", () => {
  usernameInput.value = usernameInput.value.replace(/\D/g, "").slice(0, 10);
});

togglePassword.addEventListener("click", () => {
  const show = passwordInput.type === "password";
  passwordInput.type = show ? "text" : "password";
  togglePassword.setAttribute("aria-label", show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور");
});

function createSessionAndRedirect(user) {
  const session = {
    userId: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email || "",
    department: user.department,
    loginAt: new Date().toISOString()
  };

  sessionStorage.setItem(LEGAL_SESSION_KEY, JSON.stringify(session));
  window.location.href = "department.html";
}

function openPasswordChangeModal(user) {
  pendingFirstLoginUserId = user.id;
  passwordChangeForm.reset();
  currentPasswordError.textContent = "";
  newPasswordError.textContent = "";
  confirmNewPasswordError.textContent = "";
  passwordChangeStatus.textContent = "";
  passwordChangeModal.hidden = false;
  setTimeout(() => currentPasswordInput.focus(), 30);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  usernameError.textContent = "";
  passwordError.textContent = "";
  statusMessage.textContent = "";

  const enteredUsername = usernameInput.value.trim();
  const enteredPassword = passwordInput.value;

  if (!/^\d{10}$/.test(enteredUsername)) {
    usernameError.textContent = "يرجى إدخال رقم هوية صحيح مكون من 10 أرقام.";
    usernameInput.focus();
    return;
  }

  if (!enteredPassword) {
    passwordError.textContent = "يرجى إدخال كلمة المرور.";
    passwordInput.focus();
    return;
  }

  const users = legalGetUsers();
  const matchedUser = users.find((user) =>
    String(user.nationalId || "").trim() === enteredUsername
  );

  if (!matchedUser) {
    usernameError.textContent = "رقم الهوية غير مسجل في جدول المستخدمين.";
    usernameInput.focus();
    return;
  }

  if (matchedUser.active === false) {
    statusMessage.style.color = "#b42318";
    statusMessage.textContent = "هذا الحساب غير نشط. راجع مدير النظام.";
    return;
  }

  if (String(matchedUser.password) !== enteredPassword) {
    passwordError.textContent = "كلمة المرور غير صحيحة.";
    passwordInput.focus();
    return;
  }

  if (!matchedUser.department) {
    statusMessage.style.color = "#b42318";
    statusMessage.textContent = "الحساب غير مرتبط بإدارة تابعة.";
    return;
  }

  if (matchedUser.mustChangePassword !== false) {
    openPasswordChangeModal(matchedUser);
    return;
  }

  createSessionAndRedirect(matchedUser);
});

passwordChangeForm.addEventListener("submit", (event) => {
  event.preventDefault();

  currentPasswordError.textContent = "";
  newPasswordError.textContent = "";
  confirmNewPasswordError.textContent = "";
  passwordChangeStatus.textContent = "";

  const users = legalGetUsers();
  const userIndex = users.findIndex(user => user.id === pendingFirstLoginUserId);

  if (userIndex < 0) {
    passwordChangeStatus.style.color = "#b42318";
    passwordChangeStatus.textContent = "تعذر العثور على بيانات المستخدم.";
    return;
  }

  const user = users[userIndex];
  const oldPassword = currentPasswordInput.value;
  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmNewPasswordInput.value;

  if (oldPassword !== String(user.password)) {
    currentPasswordError.textContent = "كلمة المرور السابقة غير صحيحة.";
    currentPasswordInput.focus();
    return;
  }

  if (newPassword.length < 6) {
    newPasswordError.textContent = "كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف.";
    newPasswordInput.focus();
    return;
  }

  if (newPassword === oldPassword) {
    newPasswordError.textContent = "يجب أن تختلف كلمة المرور الجديدة عن السابقة.";
    newPasswordInput.focus();
    return;
  }

  if (confirmPassword !== newPassword) {
    confirmNewPasswordError.textContent = "تأكيد كلمة المرور غير مطابق.";
    confirmNewPasswordInput.focus();
    return;
  }

  users[userIndex] = {
    ...user,
    password: newPassword,
    mustChangePassword: false,
    passwordChangedAt: new Date().toISOString()
  };

  legalSaveUsers(users);

  passwordChangeStatus.style.color = "#067647";
  passwordChangeStatus.textContent = "تم تعديل كلمة المرور بنجاح.";

  setTimeout(() => {
    passwordChangeModal.hidden = true;
    createSessionAndRedirect(users[userIndex]);
  }, 450);
});
