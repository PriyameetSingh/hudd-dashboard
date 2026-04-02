export enum UserRole {
  ACS = "ACS",
  PS_HUDD = "PS_HUDD",
  AS = "AS",
  FA = "FA",
  TASU = "TASU",
  NODAL_OFFICER = "NODAL_OFFICER",
  DIRECTOR = "DIRECTOR",
  VIEWER = "VIEWER",
}

export interface MockUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  assignedSchemes: string[];
}

export enum Permission {
  VIEW_ALL_DATA = "VIEW_ALL_DATA",
  VIEW_ASSIGNED_DATA = "VIEW_ASSIGNED_DATA",
  ENTER_FINANCIAL_DATA = "ENTER_FINANCIAL_DATA",
  ENTER_KPI_DATA = "ENTER_KPI_DATA",
  CREATE_ACTION_ITEMS = "CREATE_ACTION_ITEMS",
  UPDATE_ACTION_ITEMS = "UPDATE_ACTION_ITEMS",
  UPLOAD_PROOF = "UPLOAD_PROOF",
  APPROVE_FINANCIAL = "APPROVE_FINANCIAL",
  APPROVE_KPI = "APPROVE_KPI",
  APPROVE_ACTION_ITEMS = "APPROVE_ACTION_ITEMS",
  MANAGE_USERS = "MANAGE_USERS",
  MANAGE_SCHEMES = "MANAGE_SCHEMES",
  EXPORT_REPORTS = "EXPORT_REPORTS",
  VIEW_COMMAND_CENTRE = "VIEW_COMMAND_CENTRE",
  VIEW_ANALYTICS = "VIEW_ANALYTICS",
}

export type ActionItemPriority = "Critical" | "High" | "Medium" | "Low";
export type ActionItemStatus = "OPEN" | "IN_PROGRESS" | "PROOF_UPLOADED" | "UNDER_REVIEW" | "COMPLETED" | "OVERDUE";

export interface ActionItemUpdate {
  timestamp: string;
  actor: string;
  status: ActionItemStatus;
  note: string;
}

export interface ActionItemProof {
  name: string;
  link: string;
}

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  vertical: string;
  priority: ActionItemPriority;
  dueDate: string;
  status: ActionItemStatus;
  assignedTo: string;
  reviewer: string;
  schemeId: string;
  daysOverdue?: number;
  updates: ActionItemUpdate[];
  proofFiles: ActionItemProof[];
}

type KPICategory = "STATE" | "CENTRAL";
export type KPIType = "OUTPUT" | "OUTCOME" | "BINARY";
export type KPIStatus = "not_submitted" | "draft" | "submitted" | "submitted_pending" | "approved";

export interface KPISubmission {
  id: string;
  scheme: string;
  vertical: string;
  category: KPICategory;
  description: string;
  type: KPIType;
  unit: string;
  numerator?: number | null;
  denominator?: number | null;
  yes?: boolean | null;
  status: KPIStatus;
  lastUpdated: string;
  remarks?: string;
}

export type FinancialEntryStatus =
  | "submitted_this_week"
  | "submitted_pending"
  | "draft"
  | "overdue"
  | "not_started";

export interface FinancialEntry {
  id: string;
  scheme: string;
  vertical: string;
  status: FinancialEntryStatus;
  annualBudget: number;
  so: number;
  ifms: number;
  lastUpdated: string;
  locked: boolean;
  submitter: string;
}

export interface PendingApprovalSummary {
  role: UserRole;
  financial: number;
  kpi: number;
  actionItems: number;
}
