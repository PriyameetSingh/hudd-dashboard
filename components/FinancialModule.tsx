"use client";
import { useData } from "@/context/DataContext";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend, ReferenceLine } from "recharts";

function statusColor(pct: number) {
  if (pct < 20) return "var(--alert-critical)";
  if (pct < 50) return "var(--alert-warning)";
  return "var(--alert-success)";
}

export default function FinancialModule() {
  const { financial: financialData, totalBudget, monthly: monthlySpend } = useData();
  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Financial Overview</h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Budget vs Expenditure — FY 2025–26 as of March 20, 2026</p>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {[
          { label: "Total Budget", value: "₹9,882 Cr", sub: "All plan types" },
          { label: "SO Orders", value: "₹5,314 Cr", sub: `${((5313.62/9882.56)*100).toFixed(1)}% of budget` },
          { label: "IFMS Actual", value: "₹4,797 Cr", sub: `${totalBudget.pct}% utilised` },
        ].map(({ label, value, sub }) => (
          <div key={label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "20px" }}>
            <div style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Budget breakdown table */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)" }}>Plan-wise Breakdown</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--bg-surface)" }}>
              {["Plan Type", "Budget (₹ Cr)", "SO Order", "IFMS Actual", "% Utilised", "Status"].map(h => (
                <th key={h} style={{ padding: "10px 16px", textAlign: h === "Plan Type" ? "left" : "right", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--text-muted)", fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {financialData.map((row, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{row.type}</td>
                <td style={{ padding: "12px 16px", textAlign: "right", fontSize: 13, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>{row.budget.toFixed(2)}</td>
                <td style={{ padding: "12px 16px", textAlign: "right", fontSize: 13, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>{row.so > 0 ? row.so.toFixed(2) : "—"}</td>
                <td style={{ padding: "12px 16px", textAlign: "right", fontSize: 13, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>{row.ifms.toFixed(2)}</td>
                <td style={{ padding: "12px 16px", textAlign: "right" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                    <div style={{ width: 60, height: 6, background: "var(--border)", borderRadius: 3 }}>
                      <div style={{ height: "100%", width: `${row.pct}%`, background: statusColor(row.pct), borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: statusColor(row.pct), fontVariantNumeric: "tabular-nums", minWidth: 44, textAlign: "right" }}>{row.pct}%</span>
                  </div>
                </td>
                <td style={{ padding: "12px 16px", textAlign: "right" }}>
                  <span style={{
                    fontSize: 9, letterSpacing: 0.8, fontWeight: 600, textTransform: "uppercase",
                    padding: "3px 7px", borderRadius: 3,
                    background: row.pct < 20 ? "rgba(204,0,0,0.1)" : row.pct < 50 ? "rgba(184,119,0,0.1)" : "rgba(0,119,0,0.1)",
                    color: statusColor(row.pct),
                  }}>
                    {row.pct < 20 ? "Critical" : row.pct < 50 ? "Lagging" : "On Track"}
                  </span>
                </td>
              </tr>
            ))}
            <tr style={{ borderTop: "2px solid var(--border-strong)", background: "var(--bg-surface)" }}>
              <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>TOTAL</td>
              <td style={{ padding: "12px 16px", textAlign: "right", fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>9,882.56</td>
              <td style={{ padding: "12px 16px", textAlign: "right", fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>5,313.62</td>
              <td style={{ padding: "12px 16px", textAlign: "right", fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>4,796.84</td>
              <td style={{ padding: "12px 16px", textAlign: "right" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--alert-warning)" }}>48.54%</span>
              </td>
              <td style={{ padding: "12px 16px", textAlign: "right" }}>
                <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", padding: "3px 7px", borderRadius: 3, background: "rgba(184,119,0,0.1)", color: "var(--alert-warning)" }}>Lagging</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Bar chart */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "16px" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)", marginBottom: 16 }}>Budget vs IFMS by Plan Type</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={financialData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="type" tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickFormatter={v => v.split(" ").slice(-1)[0]} />
              <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} />
              <Tooltip
                contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", fontSize: 11, color: "var(--text-primary)" }}
                formatter={(v) => [typeof v === "number" ? `₹${v.toFixed(0)} Cr` : "—", ""]}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="budget" name="Budget" fill="var(--border-strong)" radius={[2, 2, 0, 0]} />
              <Bar dataKey="ifms" name="IFMS" fill="var(--text-primary)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly spend trend */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "16px" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)", marginBottom: 16 }}>Cumulative Spend vs Forecast (₹ Cr)</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthlySpend} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: "var(--text-muted)" }} />
              <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} />
              <Tooltip
                contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", fontSize: 11, color: "var(--text-primary)" }}
                formatter={(v) => [v != null ? `₹${v} Cr` : "—", ""]}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <ReferenceLine x="Feb" stroke="var(--text-muted)" strokeDasharray="4 2" label={{ value: "Today", fontSize: 9, fill: "var(--text-muted)" }} />
              <Line type="monotone" dataKey="actual" name="Actual" stroke="var(--text-primary)" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
              <Line type="monotone" dataKey="forecast" name="Forecast" stroke="var(--text-muted)" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
