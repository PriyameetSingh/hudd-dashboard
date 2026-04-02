"use client";
import { useState, useRef, useEffect } from "react";
import { DashboardSpec, DEFAULT_SPEC, applyPatch } from "@/lib/dashboardSpec";
import { parseSpec } from "@/lib/specParser";
import { DraftData, DatasetKey, FinancialRow, SchemeRow, ActionRow, ULBRow } from "@/context/DataContext";
import { X, Send, Check, XCircle, RotateCcw, Sparkles, Lock } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
} from "recharts";

// ─────────────────────────────────────────────────────────────
// Suggested chips per dataset
// ─────────────────────────────────────────────────────────────
const SUGGESTIONS: Record<DatasetKey, string[]> = {
  financial: ["Sort by IFMS descending", "Highlight UFC", "Set critical threshold to 10%", "Hide SO column", "Show as bar chart", "Rename Union Finance Commission to UFC"],
  schemes: ["Sort by % utilised ascending", "Show only critical schemes", "Highlight PMAY-U", "Hide vertical column", "Set critical threshold to 15%"],
  ulb: ["Sort by overall descending", "Show top 5 ULBs", "Highlight Bhubaneswar", "Hide grievance column", "Set radar to Cuttack"],
  actions: ["Sort by days overdue", "Show actions as table", "Hide completed", "Highlight overdue actions"],
};

// ─────────────────────────────────────────────────────────────
// Tiny spec-driven previews
// ─────────────────────────────────────────────────────────────

function statusColor(pct: number, spec: DashboardSpec["financial"] | DashboardSpec["schemes"]) {
  const t = spec.thresholds;
  if (pct < t.criticalBelow) return "var(--alert-critical)";
  if (pct < t.warningBelow) return "var(--alert-warning)";
  return "var(--alert-success)";
}

function FinancialPreview({ data, spec }: { data: FinancialRow[]; spec: DashboardSpec["financial"] }) {
  const display = [...data]
    .sort((a, b) => {
      const k = spec.sortKey as keyof FinancialRow;
      const av = a[k] as string | number;
      const bv = b[k] as string | number;
      return spec.sortDir === "asc" ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
    });

  const visibleCols = (["budget", "so", "ifms", "pct"] as const).filter(c => !spec.hiddenColumns.includes(c));
  const colLabels: Record<string, string> = { budget: "Budget (₹ Cr)", so: "SO Order", ifms: "IFMS Actual", pct: "% Util." };

  const chartData = display.map(r => ({
    name: (spec.rowLabels[r.type] ?? r.type).split(" ").slice(-2).join(" "),
    Budget: r.budget, IFMS: r.ifms,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)", marginBottom: 4 }}>Financial Data — {data.length} rows</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: "var(--bg-surface)" }}>
            <th style={{ padding: "8px 10px", textAlign: "left", color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase" }}>Plan Type</th>
            {visibleCols.map(c => <th key={c} style={{ padding: "8px 10px", textAlign: "right", color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase" }}>{colLabels[c]}</th>)}
          </tr>
        </thead>
        <tbody>
          {display.map((r, i) => {
            const label = spec.rowLabels[r.type] ?? r.type;
            const highlighted = spec.highlightedRows.some(h => r.type.toLowerCase().includes(h.toLowerCase()) || label.toLowerCase().includes(h.toLowerCase()));
            return (
              <tr key={i} style={{ borderTop: "1px solid var(--border)", background: highlighted ? "rgba(255,255,255,0.04)" : "transparent" }}>
                <td style={{ padding: "8px 10px", fontWeight: highlighted ? 700 : 400, color: "var(--text-primary)", borderLeft: highlighted ? "3px solid var(--text-primary)" : "3px solid transparent" }}>{label}</td>
                {visibleCols.map(c => (
                  <td key={c} style={{ padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: c === "pct" ? statusColor(r.pct, spec) : "var(--text-secondary)", fontWeight: c === "pct" ? 600 : 400 }}>
                    {c === "pct" ? `${r.pct}%` : r[c as keyof FinancialRow]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {spec.chartType !== "table" && (
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={chartData} margin={{ left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: "var(--text-muted)" }} />
            <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} />
            <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", fontSize: 10 }} />
            <Bar dataKey="Budget" fill="var(--border-strong)" radius={[2,2,0,0]} />
            <Bar dataKey="IFMS" fill="var(--text-primary)" radius={[2,2,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function SchemePreview({ data, spec }: { data: SchemeRow[]; spec: DashboardSpec["schemes"] }) {
  const display = [...data]
    .filter(r => spec.filterStatus === "all" || r.status === spec.filterStatus)
    .filter(r => !spec.hiddenVerticals.some(v => r.vertical.toUpperCase().includes(v)))
    .sort((a, b) => {
      const k = spec.sortKey as keyof SchemeRow;
      const av = a[k] as string | number;
      const bv = b[k] as string | number;
      return spec.sortDir === "asc" ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
    });

  const visibleCols = (["vertical", "budget", "so", "ifms", "pct"] as const).filter(c => !spec.hiddenColumns.includes(c));
  const colLabels: Record<string, string> = { vertical: "Vertical", budget: "Budget", so: "SO", ifms: "IFMS", pct: "% Util." };

  return (
    <div>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)", marginBottom: 8 }}>Scheme Data — {display.length} of {data.length} schemes</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: "var(--bg-surface)" }}>
            <th style={{ padding: "7px 10px", textAlign: "left", color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase" }}>Scheme</th>
            {visibleCols.map(c => <th key={c} style={{ padding: "7px 10px", textAlign: "right", color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase" }}>{colLabels[c]}</th>)}
          </tr>
        </thead>
        <tbody>
          {display.slice(0, 12).map((r, i) => {
            const highlighted = spec.highlightedSchemes.some(h => r.name.toLowerCase().includes(h.toLowerCase()));
            const color = statusColor(r.pct, spec);
            return (
              <tr key={i} style={{ borderTop: "1px solid var(--border)", background: highlighted ? "rgba(255,255,255,0.04)" : "transparent" }}>
                <td style={{ padding: "7px 10px", fontWeight: highlighted ? 700 : 400, color: "var(--text-primary)", borderLeft: highlighted ? `3px solid ${color}` : "3px solid transparent" }}>{r.name}</td>
                {visibleCols.map(c => (
                  <td key={c} style={{ padding: "7px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: c === "pct" ? color : "var(--text-secondary)", fontWeight: c === "pct" ? 600 : 400, fontSize: 11 }}>
                    {c === "pct" ? `${r.pct.toFixed(1)}%` : c === "vertical" ? r[c] : (r[c as keyof SchemeRow] as number)?.toFixed?.(0) ?? r[c as keyof SchemeRow]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {display.length > 12 && <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6, textAlign: "center" }}>+{display.length - 12} more rows</p>}
    </div>
  );
}

function ULBPreview({ data, spec }: { data: ULBRow[]; spec: DashboardSpec["ulb"] }) {
  const sorted = [...data]
    .sort((a, b) => {
      const k = spec.sortKey as keyof ULBRow;
      const av = a[k] as string | number;
      const bv = b[k] as string | number;
      return spec.sortDir === "asc" ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
    });
  const display = spec.topN > 0 ? sorted.slice(0, spec.topN) : sorted;
  const cols = (["pmay", "sbm", "water", "grievance", "overall"] as const).filter(c => !spec.hiddenColumns.includes(c));

  function scoreCol(v: number) {
    if (v >= spec.thresholds.good) return "var(--alert-success)";
    if (v >= spec.thresholds.warn) return "var(--alert-warning)";
    return "var(--alert-critical)";
  }

  return (
    <div>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)", marginBottom: 8 }}>ULB Performance — {display.length} ULBs</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: "var(--bg-surface)" }}>
            <th style={{ padding: "7px 10px", textAlign: "left", color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase" }}>ULB</th>
            {cols.map(c => <th key={c} style={{ padding: "7px 10px", textAlign: "right", color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase" }}>{c.toUpperCase()}</th>)}
          </tr>
        </thead>
        <tbody>
          {display.map((r, i) => {
            const highlighted = spec.highlightedULBs.some(h => r.ulb.toLowerCase() === h.toLowerCase());
            return (
              <tr key={i} style={{ borderTop: "1px solid var(--border)", background: highlighted ? "rgba(255,255,255,0.04)" : "transparent" }}>
                <td style={{ padding: "7px 10px", fontWeight: highlighted ? 700 : 400, color: "var(--text-primary)", borderLeft: highlighted ? "3px solid var(--text-primary)" : "3px solid transparent" }}>{r.ulb}</td>
                {cols.map(c => <td key={c} style={{ padding: "7px 10px", textAlign: "right", fontWeight: 600, color: scoreCol(r[c]), fontVariantNumeric: "tabular-nums" }}>{r[c]}%</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ActionPreview({ data, spec }: { data: ActionRow[]; spec: DashboardSpec["actions"] }) {
  const display = [...data]
    .filter(r => !spec.hiddenStatuses.includes(r.status))
    .filter(r => !spec.hiddenVerticals.some(v => r.vertical.toLowerCase().includes(v.toLowerCase())))
    .sort((a, b) => {
      if (spec.sortKey === "daysOverdue") return spec.sortDir === "desc" ? b.daysOverdue - a.daysOverdue : a.daysOverdue - b.daysOverdue;
      if (spec.sortKey === "priority") {
        const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        return spec.sortDir === "asc" ? (order[a.priority] ?? 2) - (order[b.priority] ?? 2) : (order[b.priority] ?? 2) - (order[a.priority] ?? 2);
      }
      return spec.sortDir === "asc" ? a.deadline.localeCompare(b.deadline) : b.deadline.localeCompare(a.deadline);
    });

  const pColor: Record<string, string> = { critical: "var(--alert-critical)", high: "var(--alert-warning)", medium: "var(--text-muted)", low: "var(--border-strong)" };

  return (
    <div>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)", marginBottom: 8 }}>Action Points — {display.length} items</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {display.slice(0, 8).map(a => (
          <div key={a.id} style={{ padding: "10px 12px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderLeft: `3px solid ${pColor[a.priority]}`, borderRadius: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{a.title}</span>
              {a.daysOverdue > 0 && <span style={{ fontSize: 10, color: "var(--alert-critical)", fontWeight: 700 }}>{a.daysOverdue}d overdue</span>}
            </div>
            <div style={{ display: "flex", gap: 8, fontSize: 10, color: "var(--text-muted)" }}>
              <span>{a.officer}</span>·<span>{a.vertical}</span>·<span style={{ textTransform: "capitalize" }}>{a.status}</span>
            </div>
          </div>
        ))}
        {display.length > 8 && <p style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center" }}>+{display.length - 8} more</p>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Chat message types
// ─────────────────────────────────────────────────────────────

type MsgRole = "assistant" | "user" | "pending-approval";

interface ChatMsg {
  id: number;
  role: MsgRole;
  content: string;
  patch?: Partial<DashboardSpec>;
  summary?: string;
}

// ─────────────────────────────────────────────────────────────
// Main ApprovalWorkflow component
// ─────────────────────────────────────────────────────────────

interface Props {
  datasetKey: DatasetKey;
  draftData: DraftData;
  initialSpec: DashboardSpec;
  onFreeze: (spec: DashboardSpec) => void;
  onDiscard: () => void;
}

const datasetLabels: Record<DatasetKey, string> = {
  financial: "Financial Data", schemes: "Scheme Data", actions: "Action Points", ulb: "ULB Performance",
};

export default function ApprovalWorkflow({ datasetKey, draftData, initialSpec, onFreeze, onDiscard }: Props) {
  const [spec, setSpec] = useState<DashboardSpec>(initialSpec);
  const [specHistory, setSpecHistory] = useState<DashboardSpec[]>([initialSpec]);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: 0, role: "assistant",
      content: `Preview loaded — **${datasetLabels[datasetKey]}**.\n\nYou can ask me to adjust how this data is displayed. Each change will show a confirmation step before being applied to the preview. When you're happy, click **Freeze & Apply**.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [msgId, setMsgId] = useState(1);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  function addMsg(msg: Omit<ChatMsg, "id">) {
    setMessages(m => [...m, { ...msg, id: msgId }]);
    setMsgId(n => n + 1);
  }

  function send(q?: string) {
    const query = q ?? input.trim();
    if (!query) return;
    setInput("");

    addMsg({ role: "user", content: query });

    if (query.toLowerCase() === "undo" || query.toLowerCase() === "revert") {
      if (specHistory.length > 1) {
        const prev = specHistory[specHistory.length - 2];
        setSpec(prev);
        setSpecHistory(h => h.slice(0, -1));
        addMsg({ role: "assistant", content: "Reverted to previous configuration." });
      } else {
        addMsg({ role: "assistant", content: "Nothing to undo — already at initial state." });
      }
      return;
    }

    const result = parseSpec(query, spec);
    if (result.ok) {
      // Show pending approval card
      addMsg({
        role: "pending-approval",
        content: result.summary,
        patch: result.patch,
        summary: result.summary,
      });
    } else {
      addMsg({ role: "assistant", content: result.reason });
    }
  }

  function applyChange(msgIdToApply: number, patch: Partial<DashboardSpec>, summary: string) {
    const newSpec = applyPatch(spec, patch);
    setSpec(newSpec);
    setSpecHistory(h => [...h, newSpec]);
    // Replace pending-approval card with applied confirmation
    setMessages(m => m.map(msg =>
      msg.id === msgIdToApply
        ? { ...msg, role: "assistant" as MsgRole, content: `✓ Applied: ${summary}` }
        : msg
    ));
  }

  function rejectChange(msgIdToReject: number) {
    setMessages(m => m.map(msg =>
      msg.id === msgIdToReject
        ? { ...msg, role: "assistant" as MsgRole, content: `✗ Change discarded.` }
        : msg
    ));
  }

  function renderMsg(markdown: string) {
    return markdown
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');
  }

  const currentData = {
    financial: draftData.financial ?? [],
    schemes: draftData.schemes ?? [],
    actions: draftData.actions ?? [],
    ulbs: draftData.ulbs ?? [],
  };

  const changeCount = spec.version;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "var(--bg-primary)", display: "flex", flexDirection: "column",
    }}>
      {/* Top bar */}
      <div style={{
        height: 52, borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", padding: "0 20px",
        justifyContent: "space-between", background: "var(--bg-surface)", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 28, height: 28, background: "var(--text-primary)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ color: "var(--bg-primary)", fontSize: 11, fontWeight: 700 }}>HN</span>
          </div>
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Draft Preview — {datasetLabels[datasetKey]}</span>
            {changeCount > 0 && <span style={{ marginLeft: 10, fontSize: 11, color: "var(--alert-warning)" }}>{changeCount} change{changeCount !== 1 ? "s" : ""} pending</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onDiscard}
            style={{ padding: "7px 14px", background: "transparent", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", color: "var(--text-muted)", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
          >
            <X size={13} /> Discard
          </button>
          <button
            onClick={() => onFreeze(spec)}
            style={{ padding: "7px 16px", background: "var(--text-primary)", color: "var(--bg-primary)", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}
          >
            <Lock size={13} /> Freeze & Apply
          </button>
        </div>
      </div>

      {/* Body — split pane */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 400px", overflow: "hidden" }}>

        {/* Left: preview */}
        <div style={{ overflowY: "auto", padding: "24px", borderRight: "1px solid var(--border)" }}>
          <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)" }}>Live Preview</span>
            {changeCount > 0 && (
              <button
                onClick={() => { setSpec(initialSpec); setSpecHistory([initialSpec]); }}
                style={{ fontSize: 11, color: "var(--text-muted)", background: "none", border: "1px solid var(--border)", borderRadius: 5, padding: "4px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
              >
                <RotateCcw size={11} /> Reset all
              </button>
            )}
          </div>

          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "20px" }}>
            {datasetKey === "financial" && currentData.financial.length > 0 && (
              <FinancialPreview data={currentData.financial} spec={spec.financial} />
            )}
            {datasetKey === "schemes" && currentData.schemes.length > 0 && (
              <SchemePreview data={currentData.schemes} spec={spec.schemes} />
            )}
            {datasetKey === "ulb" && currentData.ulbs.length > 0 && (
              <ULBPreview data={currentData.ulbs} spec={spec.ulb} />
            )}
            {datasetKey === "actions" && currentData.actions.length > 0 && (
              <ActionPreview data={currentData.actions} spec={spec.actions} />
            )}
          </div>

          {/* Spec summary */}
          <div style={{ marginTop: 16, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "14px" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)", marginBottom: 10 }}>Active Configuration</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {[
                datasetKey === "financial" && `Sort: ${spec.financial.sortKey} ${spec.financial.sortDir}`,
                datasetKey === "financial" && `Chart: ${spec.financial.chartType}`,
                datasetKey === "financial" && spec.financial.hiddenColumns.length > 0 && `Hidden: ${spec.financial.hiddenColumns.join(", ")}`,
                datasetKey === "financial" && spec.financial.highlightedRows.length > 0 && `Highlighted: ${spec.financial.highlightedRows.join(", ")}`,
                datasetKey === "schemes" && `Sort: ${spec.schemes.sortKey} ${spec.schemes.sortDir}`,
                datasetKey === "schemes" && spec.schemes.filterStatus !== "all" && `Filter: ${spec.schemes.filterStatus}`,
                datasetKey === "schemes" && spec.schemes.highlightedSchemes.length > 0 && `Highlighted: ${spec.schemes.highlightedSchemes.join(", ")}`,
                datasetKey === "ulb" && `Sort: ${spec.ulb.sortKey} ${spec.ulb.sortDir}`,
                datasetKey === "ulb" && spec.ulb.topN > 0 && `Top ${spec.ulb.topN} ULBs`,
                datasetKey === "ulb" && spec.ulb.highlightedULBs.length > 0 && `Highlighted: ${spec.ulb.highlightedULBs.join(", ")}`,
                datasetKey === "actions" && `Sort: ${spec.actions.sortKey} ${spec.actions.sortDir}`,
                datasetKey === "actions" && `View: ${spec.actions.viewMode}`,
                datasetKey === "actions" && spec.actions.hiddenStatuses.length > 0 && `Hidden: ${spec.actions.hiddenStatuses.join(", ")}`,
              ].filter(Boolean).map((tag, i) => (
                <span key={i} style={{ fontSize: 10, padding: "3px 8px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text-secondary)" }}>{tag as string}</span>
              ))}
              {changeCount === 0 && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Default configuration</span>}
            </div>
          </div>
        </div>

        {/* Right: chat */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-surface)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Sparkles size={13} style={{ color: "var(--text-muted)" }} />
              <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)" }}>Adjust Layout</span>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map(msg => (
              <div key={msg.id}>
                {msg.role === "user" && (
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <div style={{ maxWidth: "85%", background: "var(--text-primary)", color: "var(--bg-primary)", borderRadius: "12px 12px 2px 12px", padding: "9px 13px", fontSize: 12, lineHeight: 1.5 }}>
                      {msg.content}
                    </div>
                  </div>
                )}
                {msg.role === "assistant" && (
                  <div style={{ display: "flex" }}>
                    <div style={{ maxWidth: "90%", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "12px 12px 12px 2px", padding: "9px 13px", fontSize: 12, lineHeight: 1.6, color: "var(--text-primary)" }}
                      dangerouslySetInnerHTML={{ __html: renderMsg(msg.content) }} />
                  </div>
                )}
                {msg.role === "pending-approval" && msg.patch && (
                  <div style={{ background: "var(--bg-card)", border: "1px solid var(--alert-warning)", borderRadius: 8, padding: "12px 14px" }}>
                    <div style={{ fontSize: 11, color: "var(--alert-warning)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Pending Approval</div>
                    <div style={{ fontSize: 12, color: "var(--text-primary)", marginBottom: 10, lineHeight: 1.5 }}>{msg.content}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => applyChange(msg.id, msg.patch!, msg.summary!)}
                        style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", background: "var(--text-primary)", color: "var(--bg-primary)", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 600 }}
                      >
                        <Check size={11} /> Apply
                      </button>
                      <button
                        onClick={() => rejectChange(msg.id)}
                        style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 5, cursor: "pointer", fontSize: 11 }}
                      >
                        <XCircle size={11} /> Discard
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {/* Suggested chips */}
          <div style={{ padding: "8px 14px", display: "flex", gap: 6, flexWrap: "wrap", borderTop: "1px solid var(--border)" }}>
            {SUGGESTIONS[datasetKey].slice(0, 4).map(s => (
              <button
                key={s}
                onClick={() => send(s)}
                style={{ fontSize: 10, padding: "4px 10px", background: "transparent", border: "1px solid var(--border)", borderRadius: 20, cursor: "pointer", color: "var(--text-muted)" }}
              >{s}</button>
            ))}
          </div>

          {/* Input */}
          <div style={{ padding: "12px 14px", borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder="Describe a layout change…"
              style={{ flex: 1, padding: "9px 12px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text-primary)", fontSize: 12, outline: "none" }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim()}
              style={{ padding: "0 14px", background: "var(--text-primary)", color: "var(--bg-primary)", border: "none", borderRadius: 7, cursor: "pointer", opacity: input.trim() ? 1 : 0.4 }}
            >
              <Send size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
