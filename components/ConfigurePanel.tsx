"use client";
import { useState, useRef, useCallback, useMemo } from "react";
import { useData, DatasetKey } from "@/context/DataContext";
import {
  downloadFinancialTemplate,
  downloadSchemesTemplate,
  downloadActionsTemplate,
  downloadULBTemplate,
} from "@/lib/templates";
import { Upload, Download, CheckCircle2, AlertCircle, Loader2, X, FileSpreadsheet } from "lucide-react";

const roles = ["Principal Secretary", "Additional Secretary", "Director", "Finance Officer", "ULB Officer", "Viewer / Auditor"];
const verticals = ["SUJALA / WATCO", "SBM", "MSBY", "Urban Mobility", "Housing / OUHM", "LED Street Light", "SAHAJOG / NULM", "AMRUT 2.0", "Capacity Building", "BDA", "Grievance", "DDN"];

type ReviewColumn = {
  id: string;
  sheet: string;
  excelColumn: string;
  suggestedField: string | null;
  systemField: string;
  confidence: number;
  method: string;
  approved: boolean;
};

type ReviewScheme = {
  id: string;
  excelText: string;
  suggestedScheme: string | null;
  confidence: number;
  isNewScheme: boolean;
  approved: boolean;
};

type ReviewDataset = {
  key: DatasetKey;
  uploadId: number;
  columns: ReviewColumn[];
  schemes: ReviewScheme[];
};

function buildReviewDataset(key: DatasetKey, uploadId: number, items: any[]): ReviewDataset {
  const columns: ReviewColumn[] = (items ?? [])
    .filter(item => item.type === "column_mapping" && item.confidence > 0)
    .map((item, index) => ({
      id: `col-${uploadId}-${index}-${item.sheet}-${item.excel_column}`,
      sheet: item.sheet,
      excelColumn: item.excel_column,
      suggestedField: item.suggested_field ?? null,
      systemField: item.suggested_field && item.suggested_field !== "unknown" ? item.suggested_field : "",
      confidence: item.confidence ?? 0,
      method: item.method ?? "",
      approved: !!(item.suggested_field && item.suggested_field !== "unknown"),
    }));
  const schemes: ReviewScheme[] = (items ?? [])
    .filter(item => item.type === "scheme_mapping" && item.confidence > 0)
    .map((item, index) => ({
      id: `scheme-${uploadId}-${index}-${item.excel_text}`,
      excelText: item.excel_text,
      suggestedScheme: item.suggested_scheme ?? null,
      confidence: item.confidence ?? 0,
      isNewScheme: !!item.is_new_scheme,
      approved: !!item.suggested_scheme,
    }));
  return { key, uploadId, columns, schemes };
}

export default function ConfigurePanel() {
  const { uploadStatus, uploadFinancial, uploadSchemes, uploadActions, uploadULB, approveUpload, resetDataset } = useData();
  const [role, setRole] = useState("Principal Secretary");
  const [enabledVerticals, setEnabledVerticals] = useState<string[]>(verticals);
  const [alerts, setAlerts] = useState({ lapseRisk: true, overdueActions: true, agentAlerts: true, whatsapp: false });
  const [thresholds, setThresholds] = useState({ lapseWarning: 20, lapseCritical: 10, overdueWarning: 7, overdueCritical: 30 });
  const [reviewingDataset, setReviewingDataset] = useState<ReviewDataset | null>(null);

  const filteredColumns = useMemo(
    () => reviewingDataset?.columns.filter(c => c.confidence > 0) ?? [],
    [reviewingDataset],
  );
  const filteredSchemes = useMemo(
    () => reviewingDataset?.schemes.filter(s => s.confidence > 0) ?? [],
    [reviewingDataset],
  );

  const hasReviewableItems = filteredColumns.length > 0 || filteredSchemes.length > 0;

  function openReview(key: DatasetKey, uploadId: number | undefined, items: any[] = []) {
    if (!uploadId) return;
    setReviewingDataset(buildReviewDataset(key, uploadId, items));
  }

  function toggleVertical(v: string) {
    setEnabledVerticals(ev => ev.includes(v) ? ev.filter(x => x !== v) : [...ev, v]);
  }

  function transformReviewItems(dataset: ReviewDataset) {
    const transformedColumns = dataset.columns.map(column => ({
      ...column,
      systemField: column.approved ? column.systemField : null,
    }));
    const transformedSchemes = dataset.schemes.map(scheme => ({
      ...scheme,
      suggestedScheme: scheme.approved ? scheme.suggestedScheme : null,
    }));
    return { ...dataset, columns: transformedColumns, schemes: transformedSchemes };
  }

  function getApprovalPayload(dataset: ReviewDataset) {
    const transformedDataset = transformReviewItems(dataset);
    const payload = {
      column_mappings: transformedDataset.columns.map(column => ({
        sheet: column.sheet,
        excel_column: column.excelColumn,
        system_field: column.systemField,
        confidence: column.confidence,
      })),
      scheme_mappings: transformedDataset.schemes.map(scheme => ({
        excel_text: scheme.excelText,
        suggested_scheme: scheme.suggestedScheme,
        confidence: scheme.confidence,
        is_new_scheme: scheme.isNewScheme,
      })),
    };
    return payload;
  }

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Review Modal */}
      {reviewingDataset && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000, padding: 20
        }}>
          <div style={{
            background: "var(--bg-primary)", borderRadius: 12, width: "100%", maxWidth: 600,
            maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden"
          }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600 }}>Review Mappings</h3>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Confirm or adjust AI-suggested column mappings</p>
              </div>
              <button onClick={() => setReviewingDataset(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase" }}>
                    <th style={{ paddingBottom: 12 }}>Excel Column</th>
                    <th style={{ paddingBottom: 12 }}>System Field</th>
                    <th style={{ paddingBottom: 12 }}>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {!hasReviewableItems && (
                    <tr>
                      <td colSpan={3} style={{ padding: 12, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                        No confidence &gt; 0. You may still approve to let the pipeline continue, or re-upload a cleaner file.
                      </td>
                    </tr>
                  )}
                  {filteredColumns.map(column => (
                    <tr key={column.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "12px 0" }}>
                        <div style={{ fontWeight: 500 }}>{column.excelColumn}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{column.sheet}</div>
                      </td>
                      <td style={{ padding: "12px 0" }}>
                        <input
                          value={column.systemField}
                          onChange={e => {
                            const value = e.target.value;
                            setReviewingDataset(prev => prev ? {
                              ...prev,
                              columns: prev.columns.map(c => c.id === column.id ? { ...c, systemField: value, approved: !!value.trim() } : c)
                            } : null);
                          }}
                          placeholder={column.suggestedField || "Enter system field"}
                          style={{ width: "100%", padding: "6px 8px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, color: "var(--text-primary)" }}
                        />
                      </td>
                      <td style={{ padding: "12px 0", display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 40, height: 4, background: "var(--border)", borderRadius: 2 }}> 
                            <div style={{ width: `${Math.round(column.confidence * 100)}%`, height: "100%", background: column.confidence > 0.8 ? "var(--alert-success)" : "var(--alert-warning)", borderRadius: 2 }} />
                          </div>
                          <span style={{ fontSize: 11 }}>{Math.round(column.confidence * 100)}%</span>
                        </div>
                        <button
                          onClick={() => setReviewingDataset(prev => prev ? {
                            ...prev,
                            columns: prev.columns.map(c => c.id === column.id ? { ...c, approved: !c.approved } : c)
                          } : null)}
                          style={{ border: "none", background: column.approved ? "var(--alert-success)" : "var(--border)", color: column.approved ? "#0f260a" : "var(--text-muted)", borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontSize: 11 }}
                        >{column.approved ? "Included" : "Exclude"}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredSchemes.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>Scheme name suggestions</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase" }}>
                        <th style={{ paddingBottom: 12 }}>Excel Text</th>
                        <th style={{ paddingBottom: 12 }}>Suggested Scheme</th>
                        <th style={{ paddingBottom: 12 }}>Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSchemes.map(scheme => (
                        <tr key={scheme.id} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "12px 0", fontWeight: 500 }}>{scheme.excelText}</td>
                          <td style={{ padding: "12px 0" }}>
                            <input
                              value={scheme.suggestedScheme ?? ""}
                              onChange={e => {
                                const value = e.target.value;
                                setReviewingDataset(prev => prev ? {
                                  ...prev,
                                  schemes: prev.schemes.map(s => s.id === scheme.id ? { ...s, suggestedScheme: value, approved: !!value.trim() } : s)
                                } : null);
                              }}
                              placeholder="Confirm or edit suggestion"
                              style={{ width: "100%", padding: "6px 8px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, color: "var(--text-primary)" }}
                            />
                          </td>
                          <td style={{ padding: "12px 0", display: "flex", flexDirection: "column", gap: 4 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ width: 40, height: 4, background: "var(--border)", borderRadius: 2 }}> 
                                <div style={{ width: `${Math.round(scheme.confidence * 100)}%`, height: "100%", background: scheme.confidence > 0.8 ? "var(--alert-success)" : "var(--alert-warning)", borderRadius: 2 }} />
                              </div>
                              <span style={{ fontSize: 11 }}>{Math.round(scheme.confidence * 100)}%</span>
                            </div>
                            <button
                              onClick={() => setReviewingDataset(prev => prev ? {
                                ...prev,
                                schemes: prev.schemes.map(s => s.id === scheme.id ? { ...s, approved: !s.approved } : s)
                              } : null)}
                              style={{ border: "none", background: scheme.approved ? "var(--alert-success)" : "var(--border)", color: scheme.approved ? "#0f260a" : "var(--text-muted)", borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontSize: 11 }}
                            >{scheme.approved ? "Included" : "Exclude"}</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div style={{ padding: 20, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button 
                onClick={() => setReviewingDataset(null)}
                style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", fontSize: 13 }}
              >Cancel</button>
              <button 
                onClick={async () => {
                  if (!reviewingDataset) return;
                  await approveUpload(reviewingDataset.uploadId, reviewingDataset.key, getApprovalPayload(reviewingDataset));
                  setReviewingDataset(null);
                }}
                style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "var(--text-primary)", color: "var(--bg-primary)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
              >Approve & Process</button>
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Configure Dashboard</h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Adapt the interface to your role, preferences, and notification rules</p>
      </div>

      {/* Role */}
      <Section title="Role / View Mode">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {roles.map(r => (
            <button
              key={r}
              onClick={() => setRole(r)}
              style={{
                padding: "7px 14px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                border: `1px solid ${role === r ? "var(--text-primary)" : "var(--border)"}`,
                background: role === r ? "var(--text-primary)" : "transparent",
                color: role === r ? "var(--bg-primary)" : "var(--text-muted)",
                fontWeight: role === r ? 600 : 400,
              }}
            >{r}</button>
          ))}
        </div>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
          {role === "Principal Secretary" && "Full command view: NBA, anomalies, fund heatmap, escalations."}
          {role === "Additional Secretary" && "Vertical deep-dive: scheme-level data, officer actions, inter-scheme comparison."}
          {role === "Director" && "Vertical-specific: scheme breakdown, ULB performance, linked action items."}
          {role === "Finance Officer" && "Financial focus: budget vs IFMS reconciliation, lapse-risk, SO pipeline."}
          {role === "ULB Officer" && "ULB-specific: own KPIs, assigned action items, progress entry."}
          {role === "Viewer / Auditor" && "Read-only: full dashboard access, no data entry."}
        </p>
      </Section>

      {/* Visible verticals */}
      <Section title="Visible Verticals">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {verticals.map(v => {
            const on = enabledVerticals.includes(v);
            return (
              <button
                key={v}
                onClick={() => toggleVertical(v)}
                style={{
                  padding: "6px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer",
                  border: `1px solid ${on ? "var(--text-primary)" : "var(--border)"}`,
                  background: on ? "var(--text-primary)" : "transparent",
                  color: on ? "var(--bg-primary)" : "var(--text-muted)",
                }}
              >{v}</button>
            );
          })}
        </div>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>{enabledVerticals.length} of {verticals.length} verticals visible.</p>
      </Section>

      {/* Alert thresholds */}
      <Section title="Alert Thresholds">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {[
            { label: "Lapse Warning Threshold (%)", key: "lapseWarning", min: 5, max: 50 },
            { label: "Lapse Critical Threshold (%)", key: "lapseCritical", min: 1, max: 20 },
            { label: "Overdue Warning (days)", key: "overdueWarning", min: 1, max: 30 },
            { label: "Overdue Critical (days)", key: "overdueCritical", min: 7, max: 90 },
          ].map(({ label, key, min, max }) => (
            <div key={key}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                  {thresholds[key as keyof typeof thresholds]}
                </span>
              </div>
              <input
                type="range" min={min} max={max}
                value={thresholds[key as keyof typeof thresholds]}
                onChange={e => setThresholds(t => ({ ...t, [key]: Number(e.target.value) }))}
                style={{ width: "100%", accentColor: "var(--text-primary)" }}
              />
            </div>
          ))}
        </div>
      </Section>

      {/* Notifications */}
      <Section title="Notification Settings">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { key: "lapseRisk", label: "Fund Lapse Risk Alerts", desc: "Notify when IFMS % drops below threshold with <90 days to FY end" },
            { key: "overdueActions", label: "Overdue Action Alerts", desc: "Notify when action points cross the overdue threshold" },
            { key: "agentAlerts", label: "AI Agent Notifications", desc: "Surface anomaly detection results and NBA recommendations" },
            { key: "whatsapp", label: "WhatsApp Integration", desc: "Route officer-specific alerts to WhatsApp (requires API setup)" },
          ].map(({ key, label, desc }) => (
            <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{label}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{desc}</div>
              </div>
              <button
                onClick={() => setAlerts(a => ({ ...a, [key]: !a[key as keyof typeof a] }))}
                style={{
                  width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer",
                  background: alerts[key as keyof typeof alerts] ? "var(--text-primary)" : "var(--border)",
                  position: "relative", transition: "background 0.2s", flexShrink: 0,
                }}
              >
                <div style={{
                  position: "absolute", top: 3, width: 16, height: 16, borderRadius: "50%",
                  background: "var(--bg-primary)", transition: "left 0.2s",
                  left: alerts[key as keyof typeof alerts] ? 21 : 3,
                }} />
              </button>
            </div>
          ))}
        </div>
      </Section>

      {/* Data Upload */}
      <Section title="Upload Data (Excel / CSV)">
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>
          Replace dashboard data by uploading your own files. Download a template first — it includes the required column headers, sample rows, and format notes. Accepted formats: <strong style={{ color: "var(--text-secondary)" }}>.xlsx</strong> and <strong style={{ color: "var(--text-secondary)" }}>.csv</strong>.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <UploadRow
            label="Financial Data"
            description="Budget, SO orders, and IFMS actuals by plan type"
            datasetKey="financial"
            status={uploadStatus.financial}
            onDownloadTemplate={downloadFinancialTemplate}
            onUpload={uploadFinancial}
            onReset={() => resetDataset("financial")}
            onReview={(items) => openReview("financial", uploadStatus.financial.uploadId, items)}
          />
          <UploadRow
            label="Scheme Data"
            description="All scheme-wise budget and IFMS figures"
            datasetKey="schemes"
            status={uploadStatus.schemes}
            onDownloadTemplate={downloadSchemesTemplate}
            onUpload={uploadSchemes}
            onReset={() => resetDataset("schemes")}
            onReview={(items) => openReview("schemes", uploadStatus.schemes.uploadId, items)}
          />
          <UploadRow
            label="Action Points"
            description="Decision action items with officer, deadline, status"
            datasetKey="actions"
            status={uploadStatus.actions}
            onDownloadTemplate={downloadActionsTemplate}
            onUpload={uploadActions}
            onReset={() => resetDataset("actions")}
            onReview={(items) => openReview("actions", uploadStatus.actions.uploadId, items)}
          />
          <UploadRow
            label="ULB Performance"
            description="KPI scores for all Urban Local Bodies"
            datasetKey="ulb"
            status={uploadStatus.ulb}
            onDownloadTemplate={downloadULBTemplate}
            onUpload={uploadULB}
            onReset={() => resetDataset("ulb")}
            onReview={(items) => openReview("ulb", uploadStatus.ulb.uploadId, items)}
          />
        </div>
      </Section>

      <button style={{ padding: "12px 24px", background: "var(--text-primary)", color: "var(--bg-primary)", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, alignSelf: "flex-start" }}>
        Save Configuration
      </button>
    </div>
  );
}

interface UploadRowProps {
  label: string;
  description: string;
  datasetKey: string;
  status: { status: string; fileName?: string; rowCount?: number; error?: string; uploadId?: number; reviewItems?: any[] };
  onDownloadTemplate: () => void;
  onUpload: (file: File) => Promise<void>;
  onReset: () => void;
  onReview: (items: any[]) => void;
}

function UploadRow({ label, description, status, onDownloadTemplate, onUpload, onReset, onReview }: UploadRowProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
    if (fileRef.current) fileRef.current.value = "";
  }, [onUpload]);

  const isDragOver = false;

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr auto",
      alignItems: "center", gap: 16,
      padding: "14px 16px", borderRadius: 8,
      border: "1px solid var(--border)",
      background: "var(--bg-surface)",
    }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <FileSpreadsheet size={20} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{label}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{description}</div>
          {status.status === "success" && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5, fontSize: 11, color: "var(--alert-success)" }}>
              <CheckCircle2 size={11} />
              <span>{status.fileName} — {status.rowCount} rows loaded</span>
              <button onClick={onReset} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center", marginLeft: 4 }} title="Reset to default">
                <X size={11} />
              </button>
            </div>
          )}
          {status.status === "error" && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5, fontSize: 11, color: "var(--alert-critical)" }}>
              <AlertCircle size={11} />
              <span>{status.error}</span>
            </div>
          )}
          {(status.status === "loading" || status.status === "processing") && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5, fontSize: 11, color: "var(--text-muted)" }}>
              <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />
              <span>{status.status === "loading" ? `Uploading ${status.fileName}…` : `Processing ${status.fileName}…`}</span>
            </div>
          )}
          {status.status === "review_pending" && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5, fontSize: 11, color: "var(--alert-warning)" }}>
              <AlertCircle size={11} />
              <span>Mapping review required</span>
              <button 
                onClick={() => onReview(status.reviewItems || [])}
                style={{ background: "var(--alert-warning)", border: "none", cursor: "pointer", color: "#fff", padding: "2px 8px", borderRadius: 4, marginLeft: 4, fontWeight: 600 }}
              >Review</button>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button
          onClick={onDownloadTemplate}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "7px 12px",
            background: "transparent", border: "1px solid var(--border)", borderRadius: 6,
            cursor: "pointer", color: "var(--text-secondary)", fontSize: 11, fontWeight: 500,
            whiteSpace: "nowrap",
          }}
          title="Download Excel template"
        >
          <Download size={12} /> Template
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={status.status === "loading" || status.status === "processing"}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "7px 12px",
            background: "var(--text-primary)", border: "none", borderRadius: 6,
            cursor: (status.status === "loading" || status.status === "processing") ? "not-allowed" : "pointer",
            color: "var(--bg-primary)", fontSize: 11, fontWeight: 600,
            opacity: (status.status === "loading" || status.status === "processing") ? 0.6 : 1,
            whiteSpace: "nowrap",
          }}
          title="Upload Excel or CSV file"
        >
          <Upload size={12} /> Upload
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFile}
          style={{ display: "none" }}
        />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "20px" }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)", marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}
