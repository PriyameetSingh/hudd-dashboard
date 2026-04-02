import * as XLSX from "xlsx";

function download(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename, { bookType: "xlsx" });
}

function styledSheet(headers: string[], rows: (string | number)[][], notes: string[]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Column widths
  ws["!cols"] = headers.map(h => ({ wch: Math.max(h.length + 4, 18) }));

  // Add notes in a separate "Notes" block below the data
  if (notes.length) {
    const startRow = rows.length + 3;
    XLSX.utils.sheet_add_aoa(ws, [["NOTES"], ...notes.map(n => [n])], { origin: { r: startRow, c: 0 } });
  }

  return ws;
}

export function downloadFinancialTemplate() {
  const headers = [
    "Plan Type",
    "Budget (₹ Cr)",
    "SO Order (₹ Cr)",
    "IFMS Actual (₹ Cr)",
    "% Utilised",
  ];
  const rows = [
    ["State Sector Scheme", 4365.00, 2689.25, 2311.57, 52.96],
    ["Centrally Sponsored Scheme", 2164.00, 1196.57, 752.56, 34.78],
    ["State Finance Commission", 1489.78, 1237.71, 1237.71, 83.08],
    ["Union Finance Commission", 1069.66, 60.41, 60.41, 5.65],
    ["Other Transfer (Stamp Duty)", 130.19, 129.68, 97.64, 75.00],
    ["Admin Expenditure", 688.93, 0, 336.95, 48.91],
  ];
  const notes = [
    "• Plan Type: Free text — name of the plan/fund category",
    "• Budget, SO Order, IFMS Actual: Numeric values in ₹ Crore (e.g. 4365.00)",
    "• % Utilised: Calculated as (IFMS Actual / Budget) × 100 — you may leave this column and it will be auto-computed on upload",
    "• Do not add or remove columns. Do not change header names.",
    "• You may add or remove rows. One row per plan type.",
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, styledSheet(headers, rows, notes), "Financial Data");
  download(wb, "HUDD_NEXUS_Financial_Template.xlsx");
}

export function downloadSchemesTemplate() {
  const headers = [
    "Scheme Name",
    "Vertical",
    "Budget (₹ Cr)",
    "SO Order (₹ Cr)",
    "IFMS Actual (₹ Cr)",
    "% Utilised",
  ];
  const rows = [
    ["PMAY-U", "Housing", 820.00, 320.50, 83.50, 10.19],
    ["Awas Bandhu", "Housing", 280.00, 140.20, 28.00, 10.00],
    ["24×7 Water Supply", "Water", 980.00, 542.00, 489.00, 49.90],
    ["AMRUT 2.0 Water", "AMRUT", 680.00, 380.00, 352.00, 51.80],
    ["SBM Solid Waste", "SBM", 220.00, 40.00, 22.20, 10.08],
    ["CRUT Urban Bus", "Mobility", 180.00, 120.00, 116.00, 64.40],
    ["LED Brownfield", "LED", 100.00, 80.00, 72.00, 72.00],
    ["SAHAJOG Profiling", "NULM", 120.00, 40.00, 32.60, 27.20],
  ];
  const notes = [
    "• Scheme Name: Full name of the scheme",
    "• Vertical: Programme vertical (e.g. Housing, Water, SBM, AMRUT, Mobility, LED, NULM, MSBY, BDA, UFC, SFC)",
    "• Budget, SO Order, IFMS Actual: Numeric values in ₹ Crore",
    "• % Utilised: (IFMS / Budget) × 100 — auto-computed on upload if omitted",
    "• Status (critical/warning/on-track) is derived automatically from % Utilised (<20% = critical, <60% = warning, ≥60% = on-track)",
    "• Do not change header names. You may add/remove rows freely.",
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, styledSheet(headers, rows, notes), "Scheme Data");
  download(wb, "HUDD_NEXUS_Schemes_Template.xlsx");
}

export function downloadActionsTemplate() {
  const headers = [
    "Title",
    "Description",
    "Officer",
    "Vertical",
    "Deadline (YYYY-MM-DD)",
    "Status",
    "Priority",
    "Days Overdue",
  ];
  const rows = [
    ["Release UFC tranches for Bhubaneswar sewerage works", "Unblock ₹280 Cr held due to compliance paperwork", "CE WATCO", "UFC", "2026-01-31", "overdue", "critical", 48],
    ["Expedite PMAY fund release for 5 priority ULBs", "Cuttack, Berhampur, Rourkela, Sambalpur, Puri pending", "MC-BDA", "Housing", "2026-02-10", "overdue", "critical", 38],
    ["Deploy TULIUP interns to 15 low-performing ULBs", "SAHAJOG profiling at 27% needs field acceleration", "Dir. SUDA", "NULM", "2026-02-15", "overdue", "high", 33],
    ["Submit EFC for new PMAY allocation", "Cabinet approval pending for enhanced allocation", "FA HUDD", "Housing", "2026-03-01", "in-progress", "high", 0],
    ["Complete LED retrofit for Cuttack Zone-3", "Last 12% of brownfield retrofitting in zone-3", "EE Cuttack", "LED", "2026-03-15", "in-progress", "medium", 0],
    ["Upload Q3 PMAY beneficiary data to MIS", "GoI reporting deadline approaching", "Dir. OUHM", "Housing", "2026-02-28", "pending", "medium", 0],
    ["Grievance audit — flag 30+ day pending cases", "242 cases reviewed, 198 resolved", "Dir. Governance", "Grievance", "2026-03-05", "completed", "low", 0],
  ];
  const notes = [
    "• Status allowed values: overdue | in-progress | pending | completed | escalated",
    "• Priority allowed values: critical | high | medium | low",
    "• Deadline format: YYYY-MM-DD (e.g. 2026-03-31)",
    "• Days Overdue: Number of days past deadline. Set to 0 if not overdue.",
    "• Do not change header names. You may add/remove rows freely.",
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, styledSheet(headers, rows, notes), "Action Points");
  download(wb, "HUDD_NEXUS_ActionPoints_Template.xlsx");
}

export function downloadULBTemplate() {
  const headers = [
    "ULB Name",
    "PMAY %",
    "SBM %",
    "Water %",
    "Grievance %",
    "Overall %",
  ];
  const rows = [
    ["Bhubaneswar", 24, 18, 72, 89, 51],
    ["Cuttack", 12, 8, 58, 71, 37],
    ["Rourkela", 9, 11, 61, 68, 37],
    ["Berhampur", 7, 6, 44, 55, 28],
    ["Sambalpur", 15, 22, 66, 78, 45],
    ["Puri", 18, 14, 70, 82, 46],
    ["Baripada", 4, 5, 38, 42, 22],
    ["Balasore", 6, 9, 42, 48, 26],
  ];
  const notes = [
    "• ULB Name: Official name of the Urban Local Body",
    "• PMAY %, SBM %, Water %, Grievance %: Scheme-specific utilisation/completion percentages for the ULB (0–100)",
    "• Overall %: Composite performance score. Can be computed as average of the four scheme scores, or a custom weighted average.",
    "• You may add all 114 ULBs. One row per ULB.",
    "• Do not change header names.",
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, styledSheet(headers, rows, notes), "ULB Performance");
  download(wb, "HUDD_NEXUS_ULB_Template.xlsx");
}
