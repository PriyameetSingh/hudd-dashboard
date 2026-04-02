import { DashboardSpec, applyPatch } from "./dashboardSpec";

export type ParseResult =
  | { ok: true; patch: Partial<DashboardSpec>; summary: string }
  | { ok: false; reason: string };

function lower(s: string) { return s.toLowerCase(); }

// Normalise column aliases
const COL_ALIASES: Record<string, string> = {
  "so order": "so", "so": "so",
  "ifms actual": "ifms", "ifms": "ifms",
  "budget": "budget",
  "% utilised": "pct", "utilised": "pct", "utilization": "pct",
  "pmay": "pmay", "sbm": "sbm", "water": "water", "grievance": "grievance", "overall": "overall",
  "vertical": "vertical",
};

// Normalise sort key aliases
const SORT_KEY_FINANCIAL: Record<string, string> = {
  "type": "type", "plan type": "type", "name": "type",
  "budget": "budget",
  "so": "so", "so order": "so",
  "ifms": "ifms", "ifms actual": "ifms", "expenditure": "ifms",
  "pct": "pct", "%": "pct", "utilised": "pct", "utilization": "pct", "utilisation": "pct",
};
const SORT_KEY_SCHEME: Record<string, string> = {
  "name": "name", "scheme": "name",
  "vertical": "vertical",
  "budget": "budget",
  "so": "so",
  "ifms": "ifms", "expenditure": "ifms",
  "pct": "pct", "%": "pct", "utilised": "pct",
};
const SORT_KEY_ULB: Record<string, string> = {
  "ulb": "ulb", "name": "ulb",
  "pmay": "pmay",
  "sbm": "sbm",
  "water": "water",
  "grievance": "grievance",
  "overall": "overall", "score": "overall",
};
const SORT_KEY_ACTION: Record<string, string> = {
  "deadline": "deadline", "date": "deadline",
  "overdue": "daysOverdue", "days overdue": "daysOverdue",
  "priority": "priority",
};

function normDir(s: string): "asc" | "desc" {
  if (/desc|high.to.low|worst.first|low.first/.test(s)) return "desc";
  if (/asc|low.to.high|best.first|high.first/.test(s)) return "asc";
  return "asc";
}

function detectDomain(input: string): "financial" | "schemes" | "ulb" | "actions" | null {
  if (/financ|budget|ifms|so order|plan type|expenditure/.test(input)) return "financial";
  if (/scheme|vertical|pmay|sbm|amrut|msby|nulm|led|housing|crut|bda/.test(input)) return "schemes";
  if (/ulb|bhubaneswar|cuttack|rourkela|berhampur|sambalpur|puri|baripada|balasore/.test(input)) return "ulb";
  if (/action|overdue|officer|kanban|deadline|task/.test(input)) return "actions";
  return null;
}

// ────────────────────────────────────────────────────────────
// Matcher cascade — order matters: most specific first
// ────────────────────────────────────────────────────────────

interface Matcher {
  test: (input: string) => boolean;
  parse: (input: string, current: DashboardSpec) => ParseResult;
}

const matchers: Matcher[] = [

  // ── Sort ────────────────────────────────────────────────
  {
    test: i => /\b(sort|order|rank)\b/.test(i),
    parse: (i, cur) => {
      const dir = /desc|high.to.low|worst|lowest/.test(i) ? "desc" : "asc";
      const dirLabel = dir === "desc" ? "highest first" : "lowest first";

      // Financial
      const fKey = Object.keys(SORT_KEY_FINANCIAL).find(k => i.includes(k));
      if (fKey && (i.includes("financ") || i.includes("budget") || i.includes("plan"))) {
        const sk = SORT_KEY_FINANCIAL[fKey] as DashboardSpec["financial"]["sortKey"];
        return { ok: true, patch: { financial: { ...cur.financial, sortKey: sk, sortDir: dir } }, summary: `Financial data sorted by ${fKey}, ${dirLabel}.` };
      }
      // Schemes
      const sKey = Object.keys(SORT_KEY_SCHEME).find(k => i.includes(k));
      if (sKey && (i.includes("scheme") || (!fKey && !i.includes("ulb") && !i.includes("action")))) {
        const sk = SORT_KEY_SCHEME[sKey] as DashboardSpec["schemes"]["sortKey"];
        return { ok: true, patch: { schemes: { ...cur.schemes, sortKey: sk, sortDir: dir } }, summary: `Schemes sorted by ${sKey}, ${dirLabel}.` };
      }
      // ULB
      const uKey = Object.keys(SORT_KEY_ULB).find(k => i.includes(k));
      if (uKey && i.includes("ulb")) {
        const sk = SORT_KEY_ULB[uKey] as DashboardSpec["ulb"]["sortKey"];
        return { ok: true, patch: { ulb: { ...cur.ulb, sortKey: sk, sortDir: dir } }, summary: `ULBs sorted by ${uKey}, ${dirLabel}.` };
      }
      // Actions
      const aKey = Object.keys(SORT_KEY_ACTION).find(k => i.includes(k));
      if (aKey) {
        const sk = SORT_KEY_ACTION[aKey] as DashboardSpec["actions"]["sortKey"];
        return { ok: true, patch: { actions: { ...cur.actions, sortKey: sk, sortDir: dir } }, summary: `Actions sorted by ${aKey}, ${dirLabel}.` };
      }
      return { ok: false, reason: `I understood you want to sort, but couldn't identify which field. Try: "sort schemes by % utilised descending".` };
    },
  },

  // ── Chart type ─────────────────────────────────────────
  {
    test: i => /\b(show.as|switch.to|use|display).*(bar|line|table)\b|\b(bar|line|table)\s*(chart|graph|view)\b/.test(i),
    parse: (i, cur) => {
      const type = /\bbar\b/.test(i) ? "bar" : /\bline\b/.test(i) ? "line" : "table";
      const isMonthly = /monthly|trend|month/.test(i);
      if (isMonthly) {
        return { ok: true, patch: { financial: { ...cur.financial, monthlyChartType: type } }, summary: `Monthly trend chart switched to ${type} chart.` };
      }
      const domain = detectDomain(i) ?? "financial";
      if (domain === "financial") {
        return { ok: true, patch: { financial: { ...cur.financial, chartType: type } }, summary: `Financial overview switched to ${type} chart.` };
      }
      return { ok: true, patch: { financial: { ...cur.financial, chartType: type } }, summary: `Chart type changed to ${type}.` };
    },
  },

  // ── Hide / remove column ────────────────────────────────
  {
    test: i => /\b(hide|remove|exclude)\b.*(column|col)\b|\b(column|col)\b.*(hide|remove)/.test(i),
    parse: (i, cur) => {
      const colMatch = Object.keys(COL_ALIASES).find(k => i.includes(k));
      if (!colMatch) return { ok: false, reason: `Couldn't identify which column to hide. Try: "hide SO column" or "remove IFMS column".` };
      const col = COL_ALIASES[colMatch];
      const domain = detectDomain(i) ?? "financial";
      if (domain === "ulb" || ["pmay", "sbm", "water", "grievance", "overall"].includes(col)) {
        const hidden = cur.ulb.hiddenColumns.includes(col) ? cur.ulb.hiddenColumns : [...cur.ulb.hiddenColumns, col];
        return { ok: true, patch: { ulb: { ...cur.ulb, hiddenColumns: hidden } }, summary: `"${col.toUpperCase()}" column hidden in ULB table.` };
      }
      if (domain === "schemes" || col === "vertical") {
        const hidden = cur.schemes.hiddenColumns.includes(col) ? cur.schemes.hiddenColumns : [...cur.schemes.hiddenColumns, col];
        return { ok: true, patch: { schemes: { ...cur.schemes, hiddenColumns: hidden } }, summary: `"${col.toUpperCase()}" column hidden in Scheme Tracker.` };
      }
      const hidden = cur.financial.hiddenColumns.includes(col) ? cur.financial.hiddenColumns : [...cur.financial.hiddenColumns, col];
      return { ok: true, patch: { financial: { ...cur.financial, hiddenColumns: hidden } }, summary: `"${col.toUpperCase()}" column hidden in Financial table.` };
    },
  },

  // ── Show / restore column ───────────────────────────────
  {
    test: i => /\b(show|restore|add back|unhide)\b.*(column|col)\b/.test(i),
    parse: (i, cur) => {
      const colMatch = Object.keys(COL_ALIASES).find(k => i.includes(k));
      if (!colMatch) return { ok: false, reason: `Couldn't identify which column to show. Try: "show SO column".` };
      const col = COL_ALIASES[colMatch];
      const domain = detectDomain(i) ?? "financial";
      if (domain === "ulb" || ["pmay", "sbm", "water", "grievance"].includes(col)) {
        return { ok: true, patch: { ulb: { ...cur.ulb, hiddenColumns: cur.ulb.hiddenColumns.filter(c => c !== col) } }, summary: `"${col.toUpperCase()}" column restored in ULB table.` };
      }
      return { ok: true, patch: { financial: { ...cur.financial, hiddenColumns: cur.financial.hiddenColumns.filter(c => c !== col) } }, summary: `"${col.toUpperCase()}" column restored.` };
    },
  },

  // ── Threshold commands ──────────────────────────────────
  {
    test: i => /\b(threshold|critical|warning|alert).*(below|under|at|to).*\d+/.test(i) || /\b(set|change|update).*(threshold|critical|warning).*\d+/.test(i),
    parse: (i, cur) => {
      const numMatch = i.match(/(\d+)\s*%?/);
      if (!numMatch) return { ok: false, reason: `Please specify a percentage, e.g. "set critical threshold to 15%".` };
      const val = parseInt(numMatch[1]);
      const isCritical = /critical/.test(i);
      const isWarning = /warning/.test(i);
      const domain = detectDomain(i) ?? "financial";
      if (domain === "ulb") {
        const t = isCritical ? { ...cur.ulb.thresholds, warn: val } : { ...cur.ulb.thresholds, good: val };
        return { ok: true, patch: { ulb: { ...cur.ulb, thresholds: t } }, summary: `ULB ${isCritical ? "warning" : "good"} threshold set to ${val}%.` };
      }
      const specKey = domain === "schemes" ? "schemes" : "financial";
      const t = isCritical
        ? { ...cur[specKey].thresholds, criticalBelow: val }
        : { ...cur[specKey].thresholds, warningBelow: val };
      return { ok: true, patch: { [specKey]: { ...cur[specKey], thresholds: t } }, summary: `${isCritical ? "Critical" : "Warning"} threshold set to ${val}% for ${specKey}.` };
    },
  },

  // ── Highlight / emphasise ────────────────────────────────
  {
    test: i => /\b(highlight|emphasise|emphasize|bold|pin|focus on)\b/.test(i),
    parse: (i, cur) => {
      const word = i.replace(/highlight|emphasise|emphasize|bold|pin|focus on/g, "").trim();
      // Try to resolve entity
      const ulbNames = ["bhubaneswar", "cuttack", "rourkela", "berhampur", "sambalpur", "puri", "baripada", "balasore"];
      const financialNames = ["state sector", "centrally sponsored", "state finance commission", "union finance commission", "ufc", "sfc", "stamp duty", "admin"];
      const ulbMatch = ulbNames.find(u => i.includes(u));
      if (ulbMatch) {
        const label = ulbMatch.charAt(0).toUpperCase() + ulbMatch.slice(1);
        const highlighted = cur.ulb.highlightedULBs.includes(label) ? cur.ulb.highlightedULBs : [...cur.ulb.highlightedULBs, label];
        return { ok: true, patch: { ulb: { ...cur.ulb, highlightedULBs: highlighted } }, summary: `${label} highlighted in ULB Matrix.` };
      }
      const finMatch = financialNames.find(f => i.includes(f));
      if (finMatch) {
        // Map short aliases to full names
        const nameMap: Record<string, string> = { "ufc": "Union Finance Commission", "sfc": "State Finance Commission" };
        const label = nameMap[finMatch] ?? (finMatch.charAt(0).toUpperCase() + finMatch.slice(1));
        const highlighted = cur.financial.highlightedRows.includes(label) ? cur.financial.highlightedRows : [...cur.financial.highlightedRows, label];
        return { ok: true, patch: { financial: { ...cur.financial, highlightedRows: highlighted } }, summary: `${label} highlighted in Financial table.` };
      }
      // Default: treat as scheme highlight
      const highlighted = cur.schemes.highlightedSchemes.includes(word) ? cur.schemes.highlightedSchemes : [...cur.schemes.highlightedSchemes, word];
      return { ok: true, patch: { schemes: { ...cur.schemes, highlightedSchemes: highlighted } }, summary: `"${word}" highlighted in Scheme Tracker.` };
    },
  },

  // ── Remove highlight ────────────────────────────────────
  {
    test: i => /\b(remove highlight|unhighlight|clear highlight|de-emphasise)\b/.test(i),
    parse: (i, cur) => {
      return {
        ok: true,
        patch: {
          financial: { ...cur.financial, highlightedRows: [] },
          schemes: { ...cur.schemes, highlightedSchemes: [] },
          ulb: { ...cur.ulb, highlightedULBs: [] },
        },
        summary: "All highlights cleared.",
      };
    },
  },

  // ── Hide vertical ────────────────────────────────────────
  {
    test: i => /\b(hide|remove|exclude)\b.*(vertical|grievance|housing|sbm|water|nulm|led|msby|amrut|bda|crut)/.test(i),
    parse: (i, cur) => {
      const vNames = ["grievance", "housing", "sbm", "water", "nulm", "led", "msby", "amrut", "bda", "crut", "ufc", "sfc"];
      const matched = vNames.find(v => i.includes(v));
      if (!matched) return { ok: false, reason: `Couldn't identify the vertical to hide.` };
      const label = matched.toUpperCase();
      const hidden = cur.schemes.hiddenVerticals.includes(label) ? cur.schemes.hiddenVerticals : [...cur.schemes.hiddenVerticals, label];
      return { ok: true, patch: { schemes: { ...cur.schemes, hiddenVerticals: hidden } }, summary: `${label} vertical hidden from Scheme Tracker.` };
    },
  },

  // ── Filter schemes by status ────────────────────────────
  {
    test: i => /show (only )?(critical|warning|on.track|lagging) schemes/.test(i),
    parse: (i, cur) => {
      const s = /critical/.test(i) ? "critical" : /warning|lagging/.test(i) ? "warning" : "on-track";
      return { ok: true, patch: { schemes: { ...cur.schemes, filterStatus: s } }, summary: `Schemes filtered to show only ${s} status.` };
    },
  },

  // ── Show all schemes ────────────────────────────────────
  {
    test: i => /show all schemes|reset filter|clear filter/.test(i),
    parse: (i, cur) => {
      return { ok: true, patch: { schemes: { ...cur.schemes, filterStatus: "all", hiddenVerticals: [] } }, summary: "All schemes shown, filters cleared." };
    },
  },

  // ── Action view mode ────────────────────────────────────
  {
    test: i => /\b(show|switch|view).*(action|task).*(table|kanban|list)|\b(table|kanban)\b.*(view|mode)/.test(i),
    parse: (i, cur) => {
      const mode = /table|list/.test(i) ? "table" : "kanban";
      return { ok: true, patch: { actions: { ...cur.actions, viewMode: mode } }, summary: `Action Points switched to ${mode} view.` };
    },
  },

  // ── Hide action status column ────────────────────────────
  {
    test: i => /hide (completed|overdue|pending|in.progress)/.test(i),
    parse: (i, cur) => {
      const s = /completed/.test(i) ? "completed" : /overdue/.test(i) ? "overdue" : /pending/.test(i) ? "pending" : "in-progress";
      const hidden = cur.actions.hiddenStatuses.includes(s) ? cur.actions.hiddenStatuses : [...cur.actions.hiddenStatuses, s];
      return { ok: true, patch: { actions: { ...cur.actions, hiddenStatuses: hidden } }, summary: `"${s}" actions hidden from Action Tracker.` };
    },
  },

  // ── Show monthly trend ───────────────────────────────────
  {
    test: i => /\b(show|hide|toggle)\b.*\b(monthly|trend)\b/.test(i),
    parse: (i, cur) => {
      const show = /show/.test(i) || (!/hide/.test(i));
      return { ok: true, patch: { financial: { ...cur.financial, showMonthlyTrend: show } }, summary: `Monthly trend chart ${show ? "shown" : "hidden"}.` };
    },
  },

  // ── Top N ULBs ────────────────────────────────────────
  {
    test: i => /top (\d+) ulb/.test(i),
    parse: (i, cur) => {
      const m = i.match(/top (\d+)/);
      const n = m ? parseInt(m[1]) : 10;
      return { ok: true, patch: { ulb: { ...cur.ulb, topN: n } }, summary: `ULB table limited to top ${n} ULBs.` };
    },
  },

  // ── Set radar ULB ────────────────────────────────────────
  {
    test: i => /radar.*for|show.*radar.*for|focus.*radar/.test(i) && /bhubaneswar|cuttack|rourkela|berhampur|sambalpur|puri|baripada|balasore/.test(i),
    parse: (i, cur) => {
      const ulbs = ["Bhubaneswar", "Cuttack", "Rourkela", "Berhampur", "Sambalpur", "Puri", "Baripada", "Balasore"];
      const match = ulbs.find(u => i.includes(u.toLowerCase())) ?? "Bhubaneswar";
      return { ok: true, patch: { ulb: { ...cur.ulb, radarULB: match } }, summary: `Radar chart updated to show ${match}.` };
    },
  },

  // ── Rename ────────────────────────────────────────────────
  {
    test: i => /\b(rename|label|call)\b/.test(i),
    parse: (i, cur) => {
      const m = i.match(/(?:rename|label|call)\s+["']?([^"']+?)["']?\s+(?:as|to)\s+["']?([^"']+)["']?/i);
      if (!m) return { ok: false, reason: `Try: "rename Union Finance Commission to UFC".` };
      const [, from, to] = m;
      return {
        ok: true,
        patch: { financial: { ...cur.financial, rowLabels: { ...cur.financial.rowLabels, [from.trim()]: to.trim() } } },
        summary: `"${from.trim()}" will now display as "${to.trim()}".`,
      };
    },
  },

  // ── Undo ─────────────────────────────────────────────────
  {
    test: i => /\bundo\b|\brevert\b/.test(i),
    parse: () => ({ ok: false, reason: "UNDO_SIGNAL" }),
  },
];

export function parseSpec(input: string, current: DashboardSpec): ParseResult {
  const i = lower(input.trim());
  for (const m of matchers) {
    if (m.test(i)) return m.parse(i, current);
  }
  return {
    ok: false,
    reason: `I didn't understand that. Try commands like:\n• "sort schemes by % utilised descending"\n• "highlight UFC"\n• "hide SO column"\n• "set critical threshold to 15%"\n• "show as bar chart"\n• "show only critical schemes"`,
  };
}
