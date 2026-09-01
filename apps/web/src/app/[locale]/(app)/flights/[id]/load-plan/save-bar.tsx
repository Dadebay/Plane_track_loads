"use client";

import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, WifiOff } from "lucide-react";
import type { LiveWnbResult, LoadPlanAhmData } from "@/lib/load-plan-calc";
import { saveLoadPlan } from "./actions";
import { useLoadDraftStore } from "./load-draft-store";

export function SaveBar({
  legId,
  result,
}: {
  legId: string;
  ahmData: LoadPlanAhmData;
  registration: string;
  result: LiveWnbResult;
}) {
  const t = useTranslations("loadPlan");
  const tWnb = useTranslations("wnb");
  const items = useLoadDraftStore((s) => s.items);
  const fuel = useLoadDraftStore((s) => s.fuel);
  const cockpitCrew = useLoadDraftStore((s) => s.cockpitCrew);
  const courierCrew = useLoadDraftStore((s) => s.courierCrew);

  const mutation = useMutation({
    mutationKey: ["saveLoadPlan", legId],
    mutationFn: (finalize: boolean) => saveLoadPlan({ legId, items, fuel, cockpitCrew, courierCrew, finalize }),
  });

  const canSave = !result.blockingError && result.allWithinEnvelope && cockpitCrew !== null && courierCrew !== null;

  function errorMessage(): string | null {
    if (!mutation.data || mutation.data.ok) return null;
    switch (mutation.data.error) {
      case "cgOutOfEnvelope":
        return t("saveBlockedEnvelope", { phase: mutation.data.errorDetail?.phase ?? "" });
      case "weightLimitExceeded":
        return mutation.data.errorDetail?.message ?? tWnb("errors.weightLimitExceeded");
      case "positionOverload":
        return t("saveBlockedWeight", {
          limitName: mutation.data.errorDetail?.position ?? "",
          actual: "",
          max: "",
        });
      case "crewNotSet":
        return t("crew.notSet" as never);
      default:
        return mutation.data.error ?? null;
    }
  }

  const error = errorMessage();

  return (
    <div className="sticky bottom-0 flex flex-col gap-2 border-t border-border bg-bg p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex-1 text-sm">
        {mutation.isPaused ? (
          <span className="flex items-center gap-1.5 text-warning">
            <WifiOff className="h-4 w-4" aria-hidden="true" />
            {t("offlineQueued")}
          </span>
        ) : error ? (
          <span className="flex items-center gap-1.5 text-danger">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            {error}
          </span>
        ) : mutation.isSuccess && mutation.data.ok ? (
          <span className="text-success">{t("saveSuccess")}</span>
        ) : null}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!canSave || mutation.isPending}
          onClick={() => mutation.mutate(false)}
          className="h-11 rounded-md border border-border px-4 text-sm font-medium text-fg hover:bg-bg-muted disabled:opacity-50 sm:h-9"
        >
          {mutation.isPending ? t("saving") : t("save")}
        </button>
        <button
          type="button"
          disabled={!canSave || mutation.isPending}
          onClick={() => mutation.mutate(true)}
          className="h-11 rounded-md bg-brand-500 px-4 text-sm font-semibold text-fg-on-brand disabled:opacity-50 sm:h-9"
        >
          {t("finalize")}
        </button>
      </div>
    </div>
  );
}
