"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { X, Trash2, AlertTriangle } from "lucide-react";
import { Decimal } from "decimal.js";
import { positionIndex, type Position } from "@tua/wnb-core";
import type { DraftLoadItem } from "@/lib/load-plan-calc";
import { formatIndex, formatWeight } from "@/lib/format-number";
import { useLoadDraftStore } from "./load-draft-store";

const CONTENT_CODES = ["B", "C", "M", "P", "S", "E"] as const;

const inputClass = "h-11 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg sm:h-9";
const labelClass = "flex flex-col gap-1 text-xs font-medium text-fg-muted";

export function PositionAssignmentModal({
  code,
  variants,
  existing,
  readOnly = false,
  uldTares = {},
  onClose,
}: {
  code: string | null;
  variants: Position[];
  existing: DraftLoadItem | null;
  /** A finalized plan cannot be edited (CLAUDE.md rule #5) — the modal
   * still opens, so the controller can read what is loaded. */
  readOnly?: boolean;
  /** ULD type code -> printed tare, from uld-types.json. */
  uldTares?: Record<string, string>;
  onClose: () => void;
}) {
  const t = useTranslations("loadPlan.assignment");
  const tCommon = useTranslations("common");
  const upsertItem = useLoadDraftStore((s) => s.upsertItem);
  const removeItem = useLoadDraftStore((s) => s.removeItem);

  const [uldCode, setUldCode] = useState(existing?.uldCode ?? "");
  const [awb, setAwb] = useState(existing?.awb ?? "");
  // Tare / net / gross. AHM 560 works in gross ULD weights, so gross is the
  // number that reaches W&B and the documents — but the ramp weighs net and
  // reads tare off the ULD plate, so all three are entered and gross is
  // derived. The server re-derives it and never trusts what is sent here.
  const [tareWeight, setTareWeight] = useState(existing?.tareWeight ?? "");
  const [netWeight, setNetWeight] = useState(existing?.netWeight ?? "");
  const [weight, setWeight] = useState(existing?.weight ?? "");
  const [contentCode, setContentCode] = useState(existing?.contentCode ?? "");
  const [uldType, setUldType] = useState(existing?.uldType ?? variants[0]?.uldType ?? "");

  if (!code) return null;

  const selectedVariant = variants.find((v) => v.uldType === uldType) ?? variants[0];

  const hasBreakdown = tareWeight !== "" && netWeight !== "";
  // Decimal, not float: 0.1 + 0.2 has to be 0.3 on a loadsheet.
  const grossWeight = hasBreakdown
    ? new Decimal(tareWeight || "0").plus(new Decimal(netWeight || "0")).toString()
    : weight;

  // The number the loadmaster would otherwise look up by hand on the
  // printed CARGO LOADING INDEX TABLE, recomputed on every keystroke.
  const parsedWeight = Number(grossWeight);
  const hasWeight = grossWeight !== "" && Number.isFinite(parsedWeight) && parsedWeight > 0;
  const liveIndex = hasWeight && selectedVariant ? positionIndex(grossWeight, selectedVariant.indexPerKg) : null;
  const isOverloaded = hasWeight && selectedVariant ? parsedWeight > Number(selectedVariant.maxGross) : false;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code) return;
    upsertItem({
      position: code,
      weight: grossWeight,
      tareWeight: hasBreakdown ? tareWeight : undefined,
      netWeight: hasBreakdown ? netWeight : undefined,
      uldCode: uldCode || undefined,
      awb: awb || undefined,
      contentCode: contentCode || undefined,
      uldType: variants.length > 1 ? uldType : undefined,
    });
    onClose();
  }

  function handleRemove() {
    if (!code) return;
    removeItem(code);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg border border-border bg-bg-subtle shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold text-fg">{t("title", { position: code })}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-fg-muted hover:bg-bg-muted">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
          {variants.length > 1 ? (
            <label className={labelClass}>
              {t("selectVariant" as never)}
              <select value={uldType} onChange={(e) => setUldType(e.target.value)} className={inputClass}>
                {variants.map((v) => (
                  <option key={v.uldType} value={v.uldType}>
                    {v.uldType} — {t("maxGross", { max: formatWeight(v.maxGross) })}
                  </option>
                ))}
              </select>
            </label>
          ) : selectedVariant ? (
            <p className="text-xs text-fg-subtle">{t("maxGross", { max: formatWeight(selectedVariant.maxGross) })}</p>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              {t("uldCode")}
              <input value={uldCode} onChange={(e) => setUldCode(e.target.value.toUpperCase())} className={inputClass} />
            </label>
            <label className={labelClass}>
              {t("awb")}
              <input value={awb} onChange={(e) => setAwb(e.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              {t("tareWeight")}
              <input
                type="number"
                min="0"
                step="0.1"
                inputMode="decimal"
                value={tareWeight}
                onChange={(e) => setTareWeight(e.target.value)}
                placeholder={selectedVariant && uldTares[selectedVariant.uldType] ? uldTares[selectedVariant.uldType] : ""}
                disabled={readOnly}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              {t("netWeight")}
              <input
                type="number"
                min="0"
                step="0.1"
                inputMode="decimal"
                value={netWeight}
                onChange={(e) => setNetWeight(e.target.value)}
                disabled={readOnly}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              {t("grossWeight")}
              <input
                required
                type="number"
                min="0"
                step="0.1"
                inputMode="decimal"
                // Derived and locked as soon as tare and net are both given,
                // so the three can never disagree on screen.
                value={grossWeight}
                onChange={(e) => setWeight(e.target.value)}
                readOnly={hasBreakdown}
                disabled={readOnly}
                aria-describedby={hasBreakdown ? "gross-derived" : undefined}
                className={`${inputClass} ${hasBreakdown ? "bg-bg-muted" : ""}`}
              />
              {hasBreakdown ? (
                <span id="gross-derived" className="text-[11px] font-normal text-fg-subtle">
                  {t("grossDerived")}
                </span>
              ) : null}
            </label>
            <label className={labelClass}>
              {t("contentCode")}
              <select value={contentCode} onChange={(e) => setContentCode(e.target.value)} className={inputClass}>
                <option value="">—</option>
                {CONTENT_CODES.map((c) => (
                  <option key={c} value={c}>
                    {c} — {t(`contentCodes.${c}` as never)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedVariant ? (
            <div
              className={`flex items-center justify-between rounded-md border px-3 py-2.5 ${
                isOverloaded ? "border-danger bg-danger-bg" : "border-border bg-bg"
              }`}
            >
              <span className="text-xs font-medium uppercase tracking-wide text-fg-subtle">{t("index")}</span>
              <span className="font-mono text-base font-semibold tabular-nums text-fg">
                {liveIndex === null ? "—" : formatIndex(liveIndex)}
              </span>
            </div>
          ) : null}

          {isOverloaded && selectedVariant ? (
            <p className="flex items-start gap-1.5 text-xs font-medium text-danger">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t("overMaxGross", { max: formatWeight(selectedVariant.maxGross) })}
            </p>
          ) : null}

          {readOnly ? (
            <p className="rounded-md border border-border bg-bg-muted px-3 py-2 text-xs text-fg-subtle">
              {t("readOnly")}
            </p>
          ) : null}

          <div className="flex justify-between gap-2 border-t border-border pt-4">
            {existing && !readOnly ? (
              <button
                type="button"
                onClick={handleRemove}
                className="inline-flex h-11 items-center gap-1.5 rounded-md border border-danger px-3 text-sm font-medium text-danger hover:bg-danger-bg sm:h-9"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {t("remove")}
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-11 rounded-md border border-border px-4 text-sm font-medium text-fg hover:bg-bg-muted sm:h-9"
              >
                {tCommon("cancel")}
              </button>
              <button
                type="submit"
                disabled={readOnly}
                className="h-11 rounded-md bg-brand-500 px-4 text-sm font-semibold text-fg-on-brand disabled:opacity-50 sm:h-9"
              >
                {tCommon("save")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
