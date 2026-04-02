"use client";
import { getCurrentUser, UserRole } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useMemo, useEffect, useState } from "react";
import { useData } from "@/context/DataContext";
import { AlertTriangle, TrendingUp, TrendingDown, Zap, Clock, ArrowUpRight, FileDown } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import { fetchPendingApprovalSummaries } from "@/src/lib/services/approvalService";
import ApprovalCard from "@/src/components/ui/ApprovalCard";
import { PendingApprovalSummary } from "@/types";

function SparkLine({ data }: { data: number[] }) {
  const pts = data.map((v, i) => ({ v, i }));
  return (
    <ResponsiveContainer width="100%" height={32}>
      <LineChart data={pts}>
        <Line type="monotone" dataKey="v" stroke="var(--text-muted)" strokeWidth={1.5} dot={false} />
        <Tooltip
          contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", fontSize: 11, color: "var(--text-primary)" }}
          formatter={(v) => [`${v}%`, ""]}
          labelFormatter={() => ""}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

const ROLE_BANNER: Partial<Record<UserRole, string>> = {
  [UserRole.ACS]: "Full system view — all departments and schemes",
  [UserRole.PS_HUDD]: "HUDD department view — all verticals",
  [UserRole.AS]: "Assigned verticals view",
};

const APPROVAL_ROUTES: Partial<Record<UserRole, string>> = {
  [UserRole.ACS]: "/financial",
  [UserRole.PS_HUDD]: "/financial",
  [UserRole.AS]: "/kpis",
};

function statusColor(s: string) {
  if (s === "critical") return "var(--alert-critical)";
  if (s === "warning") return "var(--alert-warning)";
  return "var(--alert-success)";
}

function statusLabel(s: string) {
  if (s === "critical") return "CRITICAL";
  if (s === "warning") return "LAGGING";
  return "ON TRACK";
}

interface Props { setActive: (id: string) => void; }

export default function CommandCentre({ setActive }: Props) {
  const { totalBudget, verticals, nba: nbaRecommendations, actions: actionPoints } = useData();
  const router = useRouter();
  const [user, setUser] = useState<ReturnType<typeof getCurrentUser>>(null);
  const [pendingSummaries, setPendingSummaries] = useState<PendingApprovalSummary[]>([]);
  const criticalCount = verticals.filter(v => v.status === "critical").length;
  const overdueActions = actionPoints.filter(a => a.status === "overdue").length;
  const lapseRisk = (((9882.56 - 4796.84) / 9882.56) * 100).toFixed(1);

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const data = await fetchPendingApprovalSummaries();
      if (!active) return;
      setPendingSummaries(data);
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const pendingSummary = useMemo(() => {
    if (!user) return null;
    return pendingSummaries.find(entry => entry.role === user.role) ?? null;
  }, [user, pendingSummaries]);

  const banner = user ? ROLE_BANNER[user.role] : "Command Centre";
  const isViewer = user?.role === UserRole.VIEWER;

  const approvalCards = [
    {
      id: "financial",
      title: "Financial entries",
      description: "SO/IFMS submissions awaiting approval",
      count: pendingSummary?.financial ?? 0,
      href: "/financial",
    },
    {
      id: "kpi",
      title: "KPI submissions",
      description: "Outcome/output reports pending review",
      count: pendingSummary?.kpi ?? 0,
      href: "/kpis",
    },
    {
      id: "actions",
      title: "Action items",
      description: "Proofs and escalations awaiting review",
      count: pendingSummary?.actionItems ?? 0,
      href: "/action-items",
    },
  ];

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 20 }}>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "stretch" }}>
        <div style={{ flex: 1, borderRadius: 12, padding: "16px", background: "var(--bg-card)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)", marginBottom: 6 }}>Role context</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>{banner}</div>
          {isViewer && (
            <button
              onClick={() => window.print()}
              style={{
                marginTop: 12,
                display: "flex",
                alignItems: "center",
                gap: 6,
                borderRadius: 999,
                border: "1px solid var(--border)",
                padding: "6px 12px",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: 1,
                color: "var(--text-muted)",
                background: "var(--bg-surface)",
                cursor: "pointer",
                width: "fit-content",
              }}
            >
              <FileDown size={14} /> Export PDF
            </button>
          )}
        </div>
        <div style={{ width: 320, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-muted)" }}>Pending my approval</div>
          {approvalCards.map(card => (
            <ApprovalCard
              key={card.id}
              title={card.title}
              description={card.description}
              count={card.count}
              href={isViewer ? undefined : card.href}
            />
          ))}
        </div>
      </div>


      {/* Top strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          {
            label: "TOTAL BUDGET", value: "₹9,882 Cr", sub: "FY 2025–26",
            icon: <TrendingUp size={16} />, accent: false,
          },
          {
            label: "IFMS ACTUAL", value: "₹4,797 Cr", sub: `${totalBudget.pct}% utilised`,
            icon: <TrendingUp size={16} />, accent: false,
          },
          {
            label: "LAPSE RISK", value: `₹${(9882.56 - 4796.84).toFixed(0)} Cr`, sub: `${lapseRisk}% balance with 11d left`,
            icon: <AlertTriangle size={16} />, accent: true,
          },
          {
            label: "OVERDUE ACTIONS", value: overdueActions.toString(), sub: `${criticalCount} critical verticals`,
            icon: <Clock size={16} />, accent: true,
          },
        ].map(({ label, value, sub, icon, accent }) => (
          <div key={label} style={{
            background: "var(--bg-card)", border: `1px solid ${accent ? "var(--alert-critical)" : "var(--border)"}`,
            borderRadius: 8, padding: "16px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <span style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-muted)" }}>{label}</span>
              <span style={{ color: accent ? "var(--alert-critical)" : "var(--text-muted)" }}>{icon}</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: accent ? "var(--alert-critical)" : "var(--text-primary)", letterSpacing: -0.5, fontVariantNumeric: "tabular-nums" }}>{value}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Fiscal year burn-down bar */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)" }}>Fiscal Year Utilisation</span>
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{totalBudget.pct}% of ₹9,882 Cr</span>
        </div>
        <div style={{ height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${totalBudget.pct}%`, background: "var(--text-primary)", borderRadius: 4, transition: "width 1s" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: "var(--text-muted)" }}>
          <span>₹0</span><span>SO: ₹5,314 Cr</span><span>Target: ₹8,000 Cr</span><span>₹9,882 Cr</span>
        </div>
      </div>

      {/* Vertical grid + right panels */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>

        {/* 12 vertical cards */}
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)", marginBottom: 10 }}>12 Programme Verticals</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {verticals.map(v => (
              <button
                key={v.id}
                onClick={() => setActive("schemes")}
                style={{
                  background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8,
                  padding: "14px", cursor: "pointer", textAlign: "left", transition: "border-color 0.15s",
                  borderTop: `3px solid ${statusColor(v.status)}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 18 }}>{v.icon}</span>
                  <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: statusColor(v.status) }}>{statusLabel(v.status)}</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2, lineHeight: 1.3 }}>{v.name}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 8 }}>{v.kpi}</div>
                <div style={{ marginBottom: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 3 }}>
                    <span style={{ color: "var(--text-muted)" }}>IFMS</span>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{v.pct}%</span>
                  </div>
                  <div style={{ height: 4, background: "var(--border)", borderRadius: 2 }}>
                    <div style={{ height: "100%", width: `${Math.min(v.pct, 100)}%`, background: statusColor(v.status), borderRadius: 2 }} />
                  </div>
                </div>
                <SparkLine data={v.trend} />
              </button>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* NBA top 3 */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)" }}>Top Recommendations</span>
              <button onClick={() => setActive("agents")} style={{ fontSize: 10, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 2 }}>
                All <ArrowUpRight size={10} />
              </button>
            </div>
            {nbaRecommendations.slice(0, 3).map(r => (
              <div key={r.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                  <Zap size={12} style={{ color: r.priority === "critical" ? "var(--alert-critical)" : "var(--alert-warning)", flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.4 }}>{r.action.slice(0, 60)}…</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{r.officer}</span>
                  <span style={{ fontSize: 10, color: "var(--alert-success)" }}>{r.impact}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Overdue actions */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)" }}>Overdue Actions</span>
              <button onClick={() => setActive("actions")} style={{ fontSize: 10, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 2 }}>
                All {overdueActions} <ArrowUpRight size={10} />
              </button>
            </div>
            {actionPoints.filter(a => a.status === "overdue").slice(0, 4).map(a => (
              <div key={a.id} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontSize: 11, color: "var(--text-primary)", lineHeight: 1.3, marginBottom: 3 }}>{a.title.slice(0, 50)}…</div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{a.officer}</span>
                  <span style={{ fontSize: 10, color: "var(--alert-critical)", fontWeight: 600 }}>{a.daysOverdue}d overdue</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
