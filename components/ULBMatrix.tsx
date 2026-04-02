"use client";
import { useData } from "@/context/DataContext";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from "recharts";

function score(v: number) {
  if (v >= 70) return "var(--alert-success)";
  if (v >= 40) return "var(--alert-warning)";
  return "var(--alert-critical)";
}

export default function ULBMatrix() {
  const { ulbs: ulbPerformance } = useData();
  const sorted = [...ulbPerformance].sort((a, b) => b.overall - a.overall);

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>ULB Performance Matrix</h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>114 Urban Local Bodies — ranked by composite performance score</p>
      </div>

      {/* Top 3 / Bottom 3 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "16px" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--alert-success)", marginBottom: 12 }}>Top Performers</div>
          {sorted.slice(0, 3).map((u, i) => (
            <div key={u.ulb} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: "var(--border-strong)", minWidth: 24 }}>#{i + 1}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{u.ulb}</div>
                <div style={{ height: 4, background: "var(--border)", borderRadius: 2, marginTop: 4 }}>
                  <div style={{ height: "100%", width: `${u.overall}%`, background: "var(--alert-success)", borderRadius: 2 }} />
                </div>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--alert-success)", fontVariantNumeric: "tabular-nums", minWidth: 36, textAlign: "right" }}>{u.overall}%</span>
            </div>
          ))}
        </div>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "16px" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--alert-critical)", marginBottom: 12 }}>Needs Attention</div>
          {sorted.slice(-3).reverse().map((u, i) => (
            <div key={u.ulb} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: "var(--border-strong)", minWidth: 24 }}>⚠</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{u.ulb}</div>
                <div style={{ height: 4, background: "var(--border)", borderRadius: 2, marginTop: 4 }}>
                  <div style={{ height: "100%", width: `${u.overall}%`, background: "var(--alert-critical)", borderRadius: 2 }} />
                </div>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--alert-critical)", fontVariantNumeric: "tabular-nums", minWidth: 36, textAlign: "right" }}>{u.overall}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Full table */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--bg-surface)" }}>
              {["ULB", "PMAY %", "SBM %", "Water %", "Grievance %", "Overall"].map(h => (
                <th key={h} style={{ padding: "10px 16px", textAlign: h === "ULB" ? "left" : "right", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--text-muted)", fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((u, i) => (
              <tr key={u.ulb} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "11px 16px", fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{u.ulb}</td>
                {[u.pmay, u.sbm, u.water, u.grievance].map((v, j) => (
                  <td key={j} style={{ padding: "11px 16px", textAlign: "right" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: score(v), fontVariantNumeric: "tabular-nums" }}>{v}%</span>
                  </td>
                ))}
                <td style={{ padding: "11px 16px", textAlign: "right" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                    <div style={{ width: 50, height: 5, background: "var(--border)", borderRadius: 2 }}>
                      <div style={{ height: "100%", width: `${u.overall}%`, background: score(u.overall), borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: score(u.overall), fontVariantNumeric: "tabular-nums", minWidth: 30, textAlign: "right" }}>{u.overall}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Radar for top ULB */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "20px" }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)", marginBottom: 16 }}>Bhubaneswar — KPI Radar</div>
        <ResponsiveContainer width="100%" height={260}>
          <RadarChart data={[
            { metric: "PMAY", value: 24 },
            { metric: "SBM", value: 18 },
            { metric: "Water", value: 72 },
            { metric: "Grievance", value: 89 },
            { metric: "LED", value: 78 },
            { metric: "NULM", value: 35 },
          ]}>
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
            <Radar dataKey="value" stroke="var(--text-primary)" fill="var(--text-primary)" fillOpacity={0.12} strokeWidth={1.5} />
            <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", fontSize: 11, color: "var(--text-primary)" }} formatter={(v) => [`${v}%`, ""]} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
