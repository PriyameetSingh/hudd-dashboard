export type SortDirection = "asc" | "desc";
export type ChartType = "bar" | "line" | "table";
export type StatusThresholds = { criticalBelow: number; warningBelow: number };

export interface FinancialSpec {
  chartType: ChartType;
  sortKey: "type" | "budget" | "so" | "ifms" | "pct";
  sortDir: SortDirection;
  hiddenColumns: string[];
  thresholds: StatusThresholds;
  highlightedRows: string[];
  showMonthlyTrend: boolean;
  monthlyChartType: ChartType;
  rowLabels: Record<string, string>;
}

export interface SchemeSpec {
  sortKey: "name" | "vertical" | "budget" | "so" | "ifms" | "pct";
  sortDir: SortDirection;
  hiddenColumns: string[];
  thresholds: StatusThresholds;
  highlightedSchemes: string[];
  hiddenVerticals: string[];
  filterStatus: "all" | "critical" | "warning" | "on-track";
}

export interface ULBSpec {
  sortKey: "ulb" | "pmay" | "sbm" | "water" | "grievance" | "overall";
  sortDir: SortDirection;
  hiddenColumns: string[];
  highlightedULBs: string[];
  thresholds: { good: number; warn: number };
  radarULB: string;
  topN: number;
}

export interface ActionSpec {
  sortKey: "deadline" | "daysOverdue" | "priority";
  sortDir: SortDirection;
  hiddenStatuses: string[];
  hiddenVerticals: string[];
  viewMode: "kanban" | "table";
}

export interface DashboardSpec {
  version: number;
  financial: FinancialSpec;
  schemes: SchemeSpec;
  ulb: ULBSpec;
  actions: ActionSpec;
}

export const DEFAULT_SPEC: DashboardSpec = {
  version: 0,
  financial: {
    chartType: "bar",
    sortKey: "type",
    sortDir: "asc",
    hiddenColumns: [],
    thresholds: { criticalBelow: 20, warningBelow: 60 },
    highlightedRows: [],
    showMonthlyTrend: true,
    monthlyChartType: "line",
    rowLabels: {},
  },
  schemes: {
    sortKey: "pct",
    sortDir: "asc",
    hiddenColumns: [],
    thresholds: { criticalBelow: 20, warningBelow: 60 },
    highlightedSchemes: [],
    hiddenVerticals: [],
    filterStatus: "all",
  },
  ulb: {
    sortKey: "overall",
    sortDir: "desc",
    hiddenColumns: [],
    highlightedULBs: [],
    thresholds: { good: 70, warn: 40 },
    radarULB: "Bhubaneswar",
    topN: 0,
  },
  actions: {
    sortKey: "daysOverdue",
    sortDir: "desc",
    hiddenStatuses: [],
    hiddenVerticals: [],
    viewMode: "kanban",
  },
};

export function applyPatch(current: DashboardSpec, patch: Partial<DashboardSpec>): DashboardSpec {
  function mergeArrayAdd(arr: string[], item: string): string[] {
    return arr.includes(item) ? arr : [...arr, item];
  }
  function mergeArrayRemove(arr: string[], item: string): string[] {
    return arr.filter(x => x.toLowerCase() !== item.toLowerCase());
  }

  return {
    ...current,
    version: current.version + 1,
    financial: patch.financial ? { ...current.financial, ...patch.financial } : current.financial,
    schemes: patch.schemes ? { ...current.schemes, ...patch.schemes } : current.schemes,
    ulb: patch.ulb ? { ...current.ulb, ...patch.ulb } : current.ulb,
    actions: patch.actions ? { ...current.actions, ...patch.actions } : current.actions,
  };
}
