"use client";

import { useEffect, useState } from "react";
import { createKpiDefinition } from "@/src/lib/services/kpiService";
import { SchemeOverview } from "@/types";

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

type Props = {
  open: boolean;
  onClose: () => void;
  scheme: SchemeOverview | null;
  onSaved: () => void;
};

export default function AddKpiModal({ open, onClose, scheme, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"STATE" | "CENTRAL">("STATE");
  const [kpiType, setKpiType] = useState<"OUTPUT" | "OUTCOME" | "BINARY">("OUTPUT");
  const [subschemeId, setSubschemeId] = useState<string>("");
  const [unit, setUnit] = useState("");
  const [denominator, setDenominator] = useState("");

  useEffect(() => {
    if (!open || !scheme) return;
    setDescription("");
    setCategory("STATE");
    setKpiType("OUTPUT");
    setSubschemeId("");
    setUnit("");
    setDenominator("");
    setAlert(null);
  }, [open, scheme]);

  const handleSubmit = async () => {
    if (!scheme) return;
    const d = description.trim();
    if (!d) {
      setAlert("Description is required.");
      return;
    }
    setSaving(true);
    setAlert(null);
    try {
      const unitTrimmed = unit.trim() || null;
      const denominatorValue = denominator.trim() ? Number(denominator.trim()) : null;
      await createKpiDefinition({
        schemeId: scheme.id,
        subschemeId: subschemeId || null,
        category,
        description: d,
        kpiType,
        numeratorUnit: unitTrimmed,
        denominatorUnit: unitTrimmed,
        denominatorValue: isNaN(denominatorValue as number) ? null : denominatorValue,
      });
      onSaved();
      onClose();
    } catch (error: unknown) {
      setAlert(getErrorMessage(error, "Could not add KPI."));
    } finally {
      setSaving(false);
    }
  };

  if (!open || !scheme) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-kpi-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="add-kpi-modal-title" className="text-lg font-semibold text-[var(--text-primary)]">
              Add KPI
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {scheme.code} — {scheme.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-muted)]"
          >
            Close
          </button>
        </div>

        {alert && (
          <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-[var(--text-muted)]">
            {alert}
          </div>
        )}

        <div className="space-y-3">
          <label className="block text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
          </label>
          <label className="block text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as "STATE" | "CENTRAL")}
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
            >
              <option value="STATE">STATE</option>
              <option value="CENTRAL">CENTRAL</option>
            </select>
          </label>
          <label className="block text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
            KPI type
            <select
              value={kpiType}
              onChange={(e) => setKpiType(e.target.value as "OUTPUT" | "OUTCOME" | "BINARY")}
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
            >
              <option value="OUTPUT">OUTPUT</option>
              <option value="OUTCOME">OUTCOME</option>
              <option value="BINARY">BINARY</option>
            </select>
          </label>
          {scheme.subschemes.length > 0 && (
            <label className="block text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
              Subscheme (optional)
              <select
                value={subschemeId}
                onChange={(e) => setSubschemeId(e.target.value)}
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
              >
                <option value="">Scheme level (no subscheme)</option>
                {scheme.subschemes.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.code} — {sub.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
              Unit
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g. households"
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </label>
            <label className="block text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
              Denominator
              <input
                type="number"
                value={denominator}
                onChange={(e) => setDenominator(e.target.value)}
                placeholder="e.g. 100"
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={handleSubmit}
            className="rounded-xl bg-[var(--text-primary)] px-4 py-2 text-sm font-semibold text-[var(--bg-primary)] disabled:opacity-60"
          >
            {saving ? "Saving..." : "Add KPI"}
          </button>
        </div>
      </div>
    </div>
  );
}
