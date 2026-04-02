"use client";
import { useState } from "react";
import { useData } from "@/context/DataContext";
import { Search, SlidersHorizontal } from "lucide-react";

function statusColor(pct: number) {
  if (pct < 20) return "var(--alert-critical)";
  if (pct < 50) return "var(--alert-warning)";
  return "var(--alert-success)";
}

function badge(s: string) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    critical: { bg: "rgba(204,0,0,0.1)", color: "var(--alert-critical)", label: "Critical" },
    warning: { bg: "rgba(184,119,0,0.1)", color: "var(--alert-warning)", label: "Lagging" },
    "on-track": { bg: "rgba(0,119,0,0.1)", color: "var(--alert-success)", label: "On Track" },
  };
  return map[s] ?? map.warning;
}

export default function SchemeTracker() {
  const { schemes } = useData();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterVertical, setFilterVertical] = useState("all");

  const filtered = schemes.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.vertical.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || s.status === filterStatus;
    const matchVertical = filterVertical === "all" || s.vertical === filterVertical;
    return matchSearch && matchStatus && matchVertical;
  });

  const allVerticals = Array.from(new Set(schemes.map(s => s.vertical)));

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Scheme Tracker</h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>33 schemes across 12 verticals — live IFMS vs targets</p>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 200px" }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search schemes..."
            style={{
              width: "100%", padding: "8px 10px 8px 30px", background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: 6, color: "var(--text-primary)", fontSize: 13, outline: "none",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["all", "critical", "warning", "on-track"].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              style={{
                padding: "6px 12px", borderRadius: 5, fontSize: 11, cursor: "pointer", fontWeight: filterStatus === s ? 600 : 400,
                border: `1px solid ${filterStatus === s ? "var(--text-primary)" : "var(--border)"}`,
                background: filterStatus === s ? "var(--text-primary)" : "transparent",
                color: filterStatus === s ? "var(--bg-primary)" : "var(--text-muted)",
              }}
            >
              {s === "all" ? "All" : s === "on-track" ? "On Track" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
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

      {/* Summary stats */}
      <div style={{ display: "flex", gap: 16 }}>
        {[
          { label: "Total Schemes", value: schemes.length, color: "var(--text-primary)" },
          { label: "Critical", value: schemes.filter(s => s.status === "critical").length, color: "var(--alert-critical)" },
          { label: "Lagging", value: schemes.filter(s => s.status === "warning").length, color: "var(--alert-warning)" },
          { label: "On Track", value: schemes.filter(s => s.status === "on-track").length, color: "var(--alert-success)" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 18px" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--text-muted)" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--bg-surface)" }}>
              {["Scheme", "Vertical", "Budget (₹ Cr)", "SO Order", "IFMS Actual", "% Utilised", "Status"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: h === "Scheme" || h === "Vertical" ? "left" : "right", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--text-muted)", fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => {
              const b = badge(s.status);
              return (
                <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "11px 14px", fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{s.name}</td>
                  <td style={{ padding: "11px 14px", fontSize: 11, color: "var(--text-muted)" }}>{s.vertical}</td>
                  <td style={{ padding: "11px 14px", textAlign: "right", fontSize: 12, fontVariantNumeric: "tabular-nums", color: "var(--text-secondary)" }}>{s.budget.toFixed(0)}</td>
                  <td style={{ padding: "11px 14px", textAlign: "right", fontSize: 12, fontVariantNumeric: "tabular-nums", color: "var(--text-secondary)" }}>{s.so.toFixed(0)}</td>
                  <td style={{ padding: "11px 14px", textAlign: "right", fontSize: 12, fontVariantNumeric: "tabular-nums", color: "var(--text-secondary)" }}>{s.ifms.toFixed(0)}</td>
                  <td style={{ padding: "11px 14px", textAlign: "right" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                      <div style={{ width: 56, height: 5, background: "var(--border)", borderRadius: 2 }}>
                        <div style={{ height: "100%", width: `${Math.min(s.pct, 100)}%`, background: statusColor(s.pct), borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: statusColor(s.pct), minWidth: 40, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{s.pct.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td style={{ padding: "11px 14px", textAlign: "right" }}>
                    <span style={{ fontSize: 9, letterSpacing: 0.8, fontWeight: 600, textTransform: "uppercase", padding: "3px 7px", borderRadius: 3, background: b.bg, color: b.color }}>
                      {b.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No schemes match your filters.</div>
        )}
      </div>
    </div>
  );
}
