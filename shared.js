
const LEGAL_USERS_KEY = "legalPlatformUsers";
const LEGAL_DEPARTMENTS_KEY = "legalPlatformDepartments";
const LEGAL_SESSION_KEY = "legalPlatformSession";

const LEGAL_DEFAULT_USERS = [
  {
    id: "usr-hail-001",
    fullName: "سليمان بن يوسف العتيق",
    nationalId: "1011716899",
    email: "s.alateeq@moe.gov.sa",
    department: "تعليم منطقة حائل",
    username: "1011716899",
    password: "123456",
    active: true,
    mustChangePassword: true
  },
  {
    id: "usr-hail-002",
    fullName: "الهنوف بنت علي الغسلان",
    nationalId: "1023456789",
    email: "h.alghaslan@moe.gov.sa",
    department: "تعليم منطقة حائل",
    username: "1023456789",
    password: "654321",
    active: true,
    mustChangePassword: true
  }
];

const LEGAL_DEFAULT_DEPARTMENTS = [
  "تعليم منطقة حائل",
  "تعليم منطقة الرياض",
  "تعليم منطقة مكة المكرمة",
  "تعليم منطقة المدينة المنورة",
  "تعليم المنطقة الشرقية",
  "الإدارة العامة للترافع",
  "الإدارة العامة للشؤون القانونية"
];

function legalReadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (_) {
    return fallback;
  }
}

function legalWriteJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function legalBootstrapStorage() {
  let users = legalReadJson(LEGAL_USERS_KEY, []);
  if (!users.length) {
    users = LEGAL_DEFAULT_USERS.map(item => ({ ...item }));
    legalWriteJson(LEGAL_USERS_KEY, users);
  } else {
    users = users.map((user, index) => ({
      id: user.id || `usr-${Date.now()}-${index}`,
      fullName: user.fullName || "",
      nationalId: user.nationalId || "",
      email: user.email || "",
      department: user.department || "",
      username: String(user.nationalId || "").trim(),
      password: user.password || "",
      active: user.active !== false,
      mustChangePassword: user.mustChangePassword !== false
    }));
    legalWriteJson(LEGAL_USERS_KEY, users);
  }

  let departments = legalReadJson(LEGAL_DEPARTMENTS_KEY, []);
  if (!departments.length) {
    departments = [...LEGAL_DEFAULT_DEPARTMENTS];
    legalWriteJson(LEGAL_DEPARTMENTS_KEY, departments);
  }

  return { users, departments };
}

function legalGetUsers() {
  return legalBootstrapStorage().users;
}

function legalSaveUsers(users) {
  legalWriteJson(LEGAL_USERS_KEY, users);
}


const LEGAL_CASES_KEY = "legalPlatformCases";
const LEGAL_PLAINTIFF_ROLES_KEY = "legalPlatformPlaintiffRoles";
const LEGAL_CLAIM_TYPES_KEY = "legalPlatformClaimTypes";
const LEGAL_COURTS_KEY = "legalPlatformCourts";
const LEGAL_JUDGMENT_RESULTS_KEY = "legalPlatformJudgmentResults";
const LEGAL_JUDGMENT_PRONOUNCEMENTS_KEY = "legalPlatformJudgmentPronouncements";

const LEGAL_DEFAULT_PLAINTIFF_ROLES = ["مدعي على الجهة", "مدعى عليه"];
const LEGAL_DEFAULT_CLAIM_TYPES = ["تحسين الوضع الوظيفي", "إلغاء قرار إداري"];
const LEGAL_DEFAULT_COURTS = ["المحكمة الإدارية الرقمية"];
const LEGAL_DEFAULT_JUDGMENT_RESULTS = ["الحكم لصالح الجهة", "الحكم ضد الجهة"];
const LEGAL_DEFAULT_JUDGMENT_PRONOUNCEMENTS = ["رفض الدعوى", "عدم قبول الدعوى"];

function legalEnsureList(key, defaults) {
  let list = legalReadJson(key, []);
  if (!list.length) {
    list = [...defaults];
    legalWriteJson(key, list);
  }
  return list;
}


const LEGAL_DEPARTMENT_WORKSPACES_KEY = "legalPlatformDepartmentWorkspaces";

function legalGetDepartmentWorkspaces() {
  try {
    const raw = localStorage.getItem(LEGAL_DEPARTMENT_WORKSPACES_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

function legalSaveDepartmentWorkspaces(workspaces) {
  localStorage.setItem(LEGAL_DEPARTMENT_WORKSPACES_KEY, JSON.stringify(workspaces));
}

function legalGetDepartmentWorkspace(department) {
  const workspaces = legalGetDepartmentWorkspaces();

  if (!workspaces[department]) {
    const oldCases = legalReadJson(LEGAL_CASES_KEY, [])
      .filter(item => item.department === department);

    workspaces[department] = {
      department,
      cases: oldCases,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    legalSaveDepartmentWorkspaces(workspaces);
  }

  return workspaces[department];
}

function legalSaveDepartmentWorkspace(department, workspace) {
  const workspaces = legalGetDepartmentWorkspaces();

  workspaces[department] = {
    ...workspace,
    department,
    updatedAt: new Date().toISOString()
  };

  legalSaveDepartmentWorkspaces(workspaces);
}


const LEGAL_CASE_REPRESENTATIVES_KEY = "legalPlatformCaseRepresentatives";
const LEGAL_DEFAULT_CASE_REPRESENTATIVES = [
  "عبداللطيف رشود العفنان",
  "وضحاء زويد الشمري"
];


const LEGAL_APPEAL_COURTS_KEY = "legalPlatformAppealCourts";
const LEGAL_DEFAULT_APPEAL_COURTS = ["محكمة الاستئناف بالرياض"];


const LEGAL_APPELLANT_TYPES_KEY = "legalPlatformAppellantTypes";
const LEGAL_DEFAULT_APPELLANT_TYPES = ["مستأنف", "مستأنف ضده"];


const LEGAL_CASE_TYPES_KEY = "legalPlatformCaseTypes";
const LEGAL_DEFAULT_CASE_TYPES = ["مالية", "إدارية"];
