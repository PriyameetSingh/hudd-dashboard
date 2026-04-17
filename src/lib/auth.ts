import { deleteCookie, getCookie, setCookie } from "cookies-next";
import { MockUser, Permission, UserRole } from "@/types";

export { Permission, UserRole };
export type { MockUser };

const COOKIE_NAME = "hudd_mock_user";
const MAX_AGE_SECONDS = 8 * 60 * 60;

function serializeUser(user: MockUser) {
  return encodeURIComponent(JSON.stringify(user));
}

function parseUser(payload: string) {
  try {
    return JSON.parse(decodeURIComponent(payload)) as MockUser;
  } catch {
    return null;
  }
}

export function setCurrentUser(user: MockUser) {
  setCookie(COOKIE_NAME, serializeUser(user), { path: "/", maxAge: MAX_AGE_SECONDS });
}

export function getCurrentUser(): MockUser | null {
  const payload = getCookie(COOKIE_NAME);
  if (!payload || typeof payload !== "string") return null;
  return parseUser(payload);
}



export const MOCK_USERS: MockUser[] = [
  {
    id: "acs",
    name: "Smt. Ushaa Padhee",
    email: "usha.padhee@hudd.ori",
    role: UserRole.ACS,
    department: "Housing & Urban Development Department",
    assignedSchemes: ["PMAY-U", "SUJALA", "GARIMA"],
  },
  {
    id: "ps",
    name: "Shri Pradeep Jena",
    email: "pradeep.jena@hudd.ori",
    role: UserRole.PS_HUDD,
    department: "Housing & Urban Development Department",
    assignedSchemes: ["All schemes"],
  },
  {
    id: "as",
    name: "Shri Suvendu Das",
    email: "suvendu.das@hudd.ori",
    role: UserRole.AS,
    department: "Housing & Urban Development Department",
    assignedSchemes: ["All schemes"],
  },
  {
    id: "fa",
    name: "Shri Rakesh Mohanty",
    email: "rakesh.mohanty@hudd.ori",
    role: UserRole.FA,
    department: "Finance & Planning",
    assignedSchemes: ["All schemes"],
  },
  {
    id: "tasu",
    name: "Ms. Priya Nair",
    email: "priya.nair@hudd.ori",
    role: UserRole.TASU,
    department: "Technical & Advisory Support Unit",
    assignedSchemes: ["PMAY-U", "SUJALA", "GARIMA"],
  },
  {
    id: "nodal",
    name: "Shri Amit Kumar",
    email: "amit.kumar@hudd.ori",
    role: UserRole.NODAL_OFFICER,
    department: "HUDD Field Unit",
    assignedSchemes: ["PMAY-U", "SUJALA", "GARIMA"],
  },
  {
    id: "director",
    name: "Shri B.K. Mishra",
    email: "bk.mishra@hudd.ori",
    role: UserRole.DIRECTOR,
    department: "Directorate of DMA",
    assignedSchemes: ["DMA", "All schemes"],
  },
  {
    id: "viewer",
    name: "Shri Ramesh Patnaik",
    email: "ramesh.patnaik@hudd.ori",
    role: UserRole.VIEWER,
    department: "Audit & Compliance",
    assignedSchemes: ["All schemes"],
  },
];

export function clearCurrentUser() {
  deleteCookie(COOKIE_NAME, { path: "/" });
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ACS]: [
    Permission.VIEW_ALL_DATA,
    Permission.ENTER_FINANCIAL_DATA,
    Permission.ENTER_KPI_DATA,
    Permission.CREATE_ACTION_ITEMS,
    Permission.UPDATE_ACTION_ITEMS,
    Permission.APPROVE_FINANCIAL,
    Permission.APPROVE_KPI,
    Permission.APPROVE_ACTION_ITEMS,
    Permission.MANAGE_USERS,
    Permission.MANAGE_SCHEMES,
    Permission.EXPORT_REPORTS,
    Permission.VIEW_COMMAND_CENTRE,
    Permission.VIEW_ANALYTICS,
    Permission.UPLOAD_PROOF,
  ],
  [UserRole.PS_HUDD]: [
    Permission.VIEW_ALL_DATA,
    Permission.ENTER_FINANCIAL_DATA,
    Permission.CREATE_ACTION_ITEMS,
    Permission.UPDATE_ACTION_ITEMS,
    Permission.APPROVE_FINANCIAL,
    Permission.APPROVE_KPI,
    Permission.APPROVE_ACTION_ITEMS,
    Permission.MANAGE_USERS,
    Permission.MANAGE_SCHEMES,
    Permission.EXPORT_REPORTS,
    Permission.VIEW_COMMAND_CENTRE,
    Permission.VIEW_ANALYTICS,
  ],
  [UserRole.AS]: [
    Permission.VIEW_ALL_DATA,
    Permission.ENTER_FINANCIAL_DATA,
    Permission.APPROVE_FINANCIAL,
    Permission.APPROVE_ACTION_ITEMS,
    Permission.MANAGE_SCHEMES,
    Permission.EXPORT_REPORTS,
    Permission.VIEW_ANALYTICS,
  ],
  [UserRole.FA]: [
    Permission.VIEW_ALL_DATA,
    Permission.ENTER_FINANCIAL_DATA,
    Permission.APPROVE_FINANCIAL,
    Permission.UPLOAD_PROOF,
  ],
  [UserRole.TASU]: [
    Permission.VIEW_ASSIGNED_DATA,
    Permission.CREATE_ACTION_ITEMS,
    Permission.UPDATE_ACTION_ITEMS,
    Permission.VIEW_ANALYTICS,
    Permission.MANAGE_PERMISSIONS,
  ],
  [UserRole.NODAL_OFFICER]: [
    Permission.VIEW_ASSIGNED_DATA,
    Permission.ENTER_KPI_DATA,
    Permission.UPLOAD_PROOF,
    Permission.VIEW_ANALYTICS,
  ],
  [UserRole.DIRECTOR]: [
    Permission.VIEW_ALL_DATA,
    Permission.VIEW_ANALYTICS,
    Permission.EXPORT_REPORTS,
  ],
  [UserRole.VIEWER]: [
    Permission.VIEW_ALL_DATA,
    Permission.VIEW_COMMAND_CENTRE,
    Permission.VIEW_ANALYTICS,
  ],
};

export function hasPermission(user: MockUser | null, permission: Permission) {
  if (!user) return false;
  return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
}

export function canAccessScheme(user: MockUser | null, schemeCode: string) {
  if (!user) return false;
  if (roleHasViewAll(user)) return true;
  return user.assignedSchemes.some(s => s.toLowerCase() === schemeCode.toLowerCase());
}

function roleHasViewAll(user: MockUser) {
  return hasPermission(user, Permission.VIEW_ALL_DATA);
}
