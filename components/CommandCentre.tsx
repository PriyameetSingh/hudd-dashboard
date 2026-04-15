"use client";

import { getCurrentUser, UserRole } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useMemo, useEffect, useState } from "react";
import { AlertTriangle, TrendingUp, Clock, ArrowUpRight } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { fetchPendingApprovalSummaries } from "@/src/lib/services/approvalService";
import { fetchCommandCentreDashboard } from "@/src/lib/services/dashboardService";
import type { CommandCentreDashboard } from "@/lib/command-centre-dashboard";
import ApprovalCard from "@/src/components/ui/ApprovalCard";
import { PendingApprovalSummary } from "@/types";
import AiAlertsCard from "@/components/command-centre/AiAlertsCard";
import CommandCentreSparkLine from "@/components/command-centre/CommandCentreSparkLine";

function statusColor(s: string) {
  if (s === "critical") return "var(--alert-critical)";
  if (s === "warning") return "var(--alert-warning)";
  return "var(--alert-success)";
}

function statusLabel(s: string) {
  if (s === "critical") return "CRITICAL";
  if (s === "warning") return "AT RISK";
  return "ON TRACK";
}

function formatCr(value: number) {
  if (value >= 100) return `₹${value.toFixed(0)} Cr`;
  return `₹${value.toFixed(2)} Cr`;
}

function pctTrendFromValue(pct: number): number[] {
  const p = Math.min(100, Math.max(0, pct));
  return [p * 0.45, p * 0.58, p * 0.68, p * 0.78, p * 0.88, p].map((x) => Math.round(x * 10) / 10);
}

interface Props {
  setActive: (id: string) => void;
}

export default function CommandCentre({ setActive }: Props) {
  const router = useRouter();
  const [user, setUser] = useState<ReturnType<typeof getCurrentUser>>(null);
  const [pendingSummaries, setPendingSummaries] = useState<PendingApprovalSummary[]>([]);
  const [dashboard, setDashboard] = useState<CommandCentreDashboard | null>(null);
  const [dashError, setDashError] = useState<string | null>(null);
  const [dashLoading, setDashLoading] = useState(true);

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

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await fetchCommandCentreDashboard();
        if (!alive) return;
        setDashboard(d);
        setDashError(null);
      } catch (e) {
        if (!alive) return;
        setDashError(e instanceof Error ? e.message : "Failed to load dashboard");
        setDashboard(null);
      } finally {
        if (alive) setDashLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const pendingSummary = useMemo(() => {
    if (!user) return null;
    return pendingSummaries.find((entry) => entry.role === user.role) ?? null;
  }, [user, pendingSummaries]);

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

  const totals = dashboard?.totals;
  const utilPct = totals ? totals.utilisationPct.toFixed(1) : "—";
  const lapsePct =
    totals && totals.totalBudgetCr > 0 ? ((totals.lapseRiskCr / totals.totalBudgetCr) * 100).toFixed(1) : "—";

  const ifmsChartData =
    dashboard?.ifmsTrend.map((p) => ({
      d: p.asOfDate.slice(5),
      ifms: Math.round(p.ifmsCr * 10) / 10,
    })) ?? [];

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "stretch" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 2fr)", gap: 12, flex: 1 }}>
          {dashLoading && (
            <>
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "16px",
                    minHeight: 88,
                    animation: "pulse 1.5s ease-in-out infinite",
                  }}
                />
              ))}
            </>
          )}
          {!dashLoading &&
            [
              {
                label: "TOTAL BUDGET",
                value: totals ? formatCr(totals.totalBudgetCr) : "—",
                sub: dashboard?.financialYearLabel ? `FY ${dashboard.financialYearLabel}` : "Latest FY",
                icon: <TrendingUp size={16} />,
                accent: false,
              },
              {
                label: "IFMS ACTUAL",
                value: totals ? formatCr(totals.totalIfmsCr) : "—",
                sub: totals ? `${utilPct}% utilised` : "—",
                icon: <TrendingUp size={16} />,
                accent: false,
              },
              {
                label: "BALANCE (UNUTILISED)",
                value: totals ? formatCr(totals.lapseRiskCr) : "—",
                sub: totals ? `${lapsePct}% of budget` : "—",
                icon: <AlertTriangle size={16} />,
                accent: Boolean(totals && totals.lapseRiskCr > totals.totalBudgetCr * 0.4),
              },
              {
                label: "OVERDUE ACTIONS",
                value: dashboard ? String(dashboard.overdueActionsCount) : "—",
                sub: `${dashboard?.criticalVerticalCount ?? 0} critical verticals`,
                icon: <Clock size={16} />,
                accent: Boolean(dashboard && dashboard.overdueActionsCount > 0),
              },
            ].map(({ label, value, sub, icon, accent }) => (
              <div
                key={label}
                style={{
                  background: "var(--bg-card)",
                  border: `1px solid ${accent ? "var(--alert-critical)" : "var(--border)"}`,
                  borderRadius: 8,
                  padding: "16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      color: "var(--text-muted)",
                    }}
                  >
                    {label}
                  </span>
                  <span style={{ color: accent ? "var(--alert-critical)" : "var(--text-muted)" }}>{icon}</span>
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: accent ? "var(--alert-critical)" : "var(--text-primary)",
                    letterSpacing: -0.5,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {value}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{sub}</div>
              </div>
            ))}
        </div>

        <div style={{ width: 320, display: "flex", flexDirection: "column", gap: 10 }}>
          <div
            style={{
              fontSize: 12,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            Pending my approval
          </div>
          {approvalCards.map((card) => (
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

      {dashError && (
        <div
          style={{
            borderRadius: 8,
            border: "1px solid var(--alert-warning)",
            padding: "12px 14px",
            fontSize: 13,
            color: "var(--text-primary)",
            background: "var(--bg-surface)",
          }}
        >
          {dashError}
        </div>
      )}

      {/* Fiscal year utilisation */}
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "16px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: "var(--text-muted)",
            }}
          >
            Fiscal year utilisation
          </span>
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
            {totals ? `${utilPct}% of ${formatCr(totals.totalBudgetCr)}` : "—"}
            {dashboard?.lastSnapshotDate ? ` · snapshots through ${dashboard.lastSnapshotDate}` : ""}
          </span>
        </div>
        <div style={{ height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${Math.min(100, totals?.utilisationPct ?? 0)}%`,
              background: "var(--text-primary)",
              borderRadius: 4,
              transition: "width 1s",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 6,
            fontSize: 10,
            color: "var(--text-muted)",
          }}
        >
          <span>₹0</span>
          <span>SO: {totals ? formatCr(totals.totalSoCr) : "—"}</span>
          <span>{totals ? formatCr(totals.totalBudgetCr) : "—"} budget</span>
        </div>
      </div>

      {/* IFMS trend */}
      {ifmsChartData.length > 0 && (
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "16px",
          }}
        >
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)", marginBottom: 8 }}>
            Department IFMS (₹ Cr) by snapshot date
          </div>
          <div style={{ height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ifmsChartData}>
                <XAxis dataKey="d" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    fontSize: 11,
                    color: "var(--text-primary)",
                  }}
                  formatter={(v) => [`${Number(v ?? 0)} Cr`, "IFMS"]}
                />
                <Area type="monotone" dataKey="ifms" stroke="var(--text-primary)" fill="var(--text-primary)" fillOpacity={0.12} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
        <div>
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: "var(--text-muted)",
              marginBottom: 10,
            }}
          >
            Verticals (aggregated)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {(dashboard?.verticals ?? []).map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setActive("schemes")}
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "14px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "border-color 0.15s",
                  borderTop: `3px solid ${statusColor(v.status)}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{v.schemeCount} schemes</span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      color: statusColor(v.status),
                    }}
                  >
                    {statusLabel(v.status)}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    marginBottom: 2,
                    lineHeight: 1.3,
                  }}
                >
                  {v.name}
                </div>
                <div style={{ marginBottom: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 3 }}>
                    <span style={{ color: "var(--text-muted)" }}>IFMS / budget</span>
                    <span
                      style={{
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {v.pct.toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ height: 4, background: "var(--border)", borderRadius: 2 }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(v.pct, 100)}%`,
                        background: statusColor(v.status),
                        borderRadius: 2,
                      }}
                    />
                  </div>
                </div>
                <CommandCentreSparkLine data={pctTrendFromValue(v.pct)} />
              </button>
            ))}
          </div>

          {dashboard && dashboard.topSchemes.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  color: "var(--text-muted)",
                  marginBottom: 8,
                }}
              >
                Top schemes by budget utilisation
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {dashboard.topSchemes.slice(0, 5).map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 11,
                      padding: "6px 8px",
                      borderRadius: 6,
                      background: "var(--bg-card)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{s.scheme}</span>
                    <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--text-secondary)" }}>
                      {s.pct.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <AiAlertsCard />

          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "14px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  color: "var(--text-muted)",
                }}
              >
                Underperforming Schemes (financial Progress)
              </span>
              <button
                type="button"
                onClick={() => router.push("/financial/schemes-board")}
                style={{
                  fontSize: 10,
                  color: "var(--text-muted)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                Board <ArrowUpRight size={10} />
              </button>
            </div>
            {(dashboard?.bottomSchemes ?? []).slice(0, 4).map((s) => (
              <div
                key={s.id}
                style={{ marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid var(--border)" }}
              >
                <div style={{ fontSize: 11, color: "var(--text-primary)", lineHeight: 1.3, marginBottom: 3 }}>
                  {s.scheme.length > 42 ? `${s.scheme.slice(0, 42)}…` : s.scheme}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{s.vertical}</span>
                  <span style={{ fontSize: 10, color: "var(--alert-warning)", fontWeight: 600 }}>
                    {s.pct.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "14px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  color: "var(--text-muted)",
                }}
              >
                Overdue actions
              </span>
              <button
                type="button"
                onClick={() => setActive("actions")}
                style={{
                  fontSize: 10,
                  color: "var(--text-muted)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                All {dashboard?.overdueActionsCount ?? 0} <ArrowUpRight size={10} />
              </button>
            </div>
            {(dashboard?.overdueActionsPreview ?? []).map((a) => (
              <div key={a.id} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontSize: 11, color: "var(--text-primary)", lineHeight: 1.3, marginBottom: 3 }}>
                  {a.title.length > 50 ? `${a.title.slice(0, 50)}…` : a.title}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{a.officer}</span>
                  <span style={{ fontSize: 10, color: "var(--alert-critical)", fontWeight: 600 }}>
                    {a.daysOverdue}d overdue
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
