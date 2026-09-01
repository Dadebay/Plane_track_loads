"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { X, Trash2 } from "lucide-react";
import type { Position } from "@tua/wnb-core";
import type { DraftLoadItem } from "@/lib/load-plan-calc";
import { useLoadDraftStore } from "./load-draft-store";

const CONTENT_CODES = ["B", "C", "M", "P", "S", "E"] as const;

const inputClass = "h-11 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg sm:h-9";
const labelClass = "flex flex-col gap-1 text-xs font-medium text-fg-muted";

export function PositionAssignmentModal({
  code,
  variants,
  existing,
  onClose,
}: {
  code: string | null;
  variants: Position[];
  existing: DraftLoadItem | null;
  onClose: () => void;
}) {
  const t = useTranslations("loadPlan.assignment");
  const tCommon = useTranslations("common");
  const upsertItem = useLoadDraftStore((s) => s.upsertItem);
  const removeItem = useLoadDraftStore((s) => s.removeItem);

  const [uldCode, setUldCode] = useState(existing?.uldCode ?? "");
  const [awb, setAwb] = useState(existing?.awb ?? "");
  const [weight, setWeight] = useState(existing?.weight ?? "");
  const [contentCode, setContentCode] = useState(existing?.contentCode ?? "");
  const [uldType, setUldType] = useState(existing?.uldType ?? variants[0]?.uldType ?? "");

  if (!code) return null;

  const selectedVariant = variants.find((v) => v.uldType === uldType) ?? variants[0];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code) return;
    upsertItem({
      position: code,
      weight,
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
                    {v.uldType} — {t("maxGross", { max: v.maxGross })}
                  </option>
                ))}
              </select>
            </label>
          ) : selectedVariant ? (
            <p className="text-xs text-fg-subtle">{t("maxGross", { max: selectedVariant.maxGross })}</p>
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
              {t("weight")}
              <input
                required
                type="number"
                min="0"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className={inputClass}
              />
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

          <div className="flex justify-between gap-2 border-t border-border pt-4">
            {existing ? (
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
                className="h-11 rounded-md bg-brand-500 px-4 text-sm font-semibold text-fg-on-brand sm:h-9"
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
