"use client";
import { useState } from "react";
import { useData } from "@/context/DataContext";
import { Clock, CheckCircle, AlertCircle, Circle, ArrowUp } from "lucide-react";

type Status = "overdue" | "in-progress" | "pending" | "completed" | "escalated";

const columns: { id: Status; label: string; icon: React.ReactNode }[] = [
  { id: "overdue", label: "Overdue", icon: <AlertCircle size={13} /> },
  { id: "in-progress", label: "In Progress", icon: <Clock size={13} /> },
  { id: "pending", label: "Pending", icon: <Circle size={13} /> },
  { id: "completed", label: "Completed", icon: <CheckCircle size={13} /> },
];

const priorityColor: Record<string, string> = {
  critical: "var(--alert-critical)",
  high: "var(--alert-warning)",
  medium: "var(--text-muted)",
  low: "var(--border-strong)",
};

export default function ActionTracker() {
  const { actions: actionPoints } = useData();
  const [filterVertical, setFilterVertical] = useState("all");
  const allVerticals = Array.from(new Set(actionPoints.map(a => a.vertical)));

  const filtered = filterVertical === "all" ? actionPoints : actionPoints.filter(a => a.vertical === filterVertical);

  const byStatus = (status: Status) => filtered.filter(a => a.status === status);

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Action Points Tracker</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Kanban board — {actionPoints.filter(a => a.status === "overdue").length} overdue, {actionPoints.filter(a => a.status === "in-progress").length} in progress</p>
        </div>
        <select
          value={filterVertical}
          onChange={e => setFilterVertical(e.target.value)}
          style={{ padding: "7px 10px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)", fontSize: 12, cursor: "pointer", outline: "none" }}
        >
          <option value="all">All Verticals</option>
          {allVerticals.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>

      {/* Kanban */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, alignItems: "start" }}>
        {columns.map(col => {
          const items = byStatus(col.id);
          const colColor = col.id === "overdue" ? "var(--alert-critical)" : col.id === "completed" ? "var(--alert-success)" : "var(--text-muted)";
          return (
            <div key={col.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, padding: "0 2px" }}>
                <span style={{ color: colColor }}>{col.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, color: colColor }}>{col.label}</span>
                <span style={{ marginLeft: "auto", fontSize: 11, background: "var(--border)", padding: "1px 6px", borderRadius: 10, color: "var(--text-muted)" }}>{items.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map(a => (
                  <div
                    key={a.id}
                    style={{
                      background: "var(--bg-card)", border: "1px solid var(--border)",
                      borderLeft: `3px solid ${priorityColor[a.priority]}`,
                      borderRadius: 7, padding: "12px",
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.4, marginBottom: 8 }}>{a.title}</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 6, lineHeight: 1.4 }}>{a.description}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                      <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, background: "var(--bg-surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>{a.vertical}</span>
                      <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, background: "var(--bg-surface)", color: priorityColor[a.priority], border: `1px solid ${priorityColor[a.priority]}` }}>{a.priority.toUpperCase()}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{a.officer}</span>
                      {a.status === "overdue" ? (
                        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--alert-critical)", display: "flex", alignItems: "center", gap: 3 }}>
                          <ArrowUp size={10} /> {a.daysOverdue}d
                        </span>
                      ) : (
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{a.deadline}</span>
                      )}
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: 12, border: "1px dashed var(--border)", borderRadius: 7 }}>
                    None
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
