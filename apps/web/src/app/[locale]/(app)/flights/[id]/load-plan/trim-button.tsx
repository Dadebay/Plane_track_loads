"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Wand2 } from "lucide-react";
import { getDowDoi, optimizeTrim } from "@tua/wnb-core";
import { resolvePositions, type LoadPlanAhmData } from "@/lib/load-plan-calc";
import { useLoadDraftStore } from "./load-draft-store";

export function TrimButton({ ahmData, registration }: { ahmData: LoadPlanAhmData; registration: string }) {
  const t = useTranslations("loadPlan.trim");
  const items = useLoadDraftStore((s) => s.items);
  const fuel = useLoadDraftStore((s) => s.fuel);
  const cockpitCrew = useLoadDraftStore((s) => s.cockpitCrew);
  const courierCrew = useLoadDraftStore((s) => s.courierCrew);
  const setItems = useLoadDraftStore((s) => s.setItems);

  const [status, setStatus] = useState<"idle" | "running" | "success" | "noSolution">("idle");

  const canRun = items.length > 0 && cockpitCrew !== null && courierCrew !== null;

  function handleClick() {
    if (!canRun || cockpitCrew === null || courierCrew === null) return;
    setStatus("running");

    const positions = resolvePositions(ahmData.positions, items);
    let dowDoi: { dow: string; doi: string };
    try {
      dowDoi = getDowDoi(registration, cockpitCrew, courierCrew, ahmData.dowDoiMatrix[registration] ?? []);
    } catch {
      setStatus("noSolution");
      return;
    }

    const result = optimizeTrim({
      items,
      positions,
      dow: dowDoi.dow,
      doi: dowDoi.doi,
      weightLimits: ahmData.weightLimits,
      fuel,
      fuelIndexTable: ahmData.fuelIndexTable,
      indexFormula: ahmData.indexFormula,
      cgLimits: ahmData.cgLimits,
      stabCurve: ahmData.stabCurve,
      stabRounding: ahmData.stabRounding,
    });

    // Drop any stale uldType — a reassigned position's ambiguity (if any)
    // should be re-confirmed by the user via the assignment modal, not
    // silently inherited from wherever the item used to sit.
    setItems(result.items.map((item) => ({ ...item, uldType: undefined })));
    setStatus(result.success ? "success" : "noSolution");
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={!canRun || status === "running"}
        onClick={handleClick}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-fg hover:bg-bg-muted disabled:opacity-50"
      >
        <Wand2 className="h-4 w-4" aria-hidden="true" />
        {status === "running" ? t("optimizing") : t("optimize")}
      </button>
      {status === "success" ? <span className="text-xs text-success">{t("success")}</span> : null}
      {status === "noSolution" ? <span className="text-xs text-danger">{t("noSolution")}</span> : null}
    </div>
  );
}
