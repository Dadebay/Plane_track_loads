"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader, StatusBadge } from "@tua/ui";
import type { LoadPlanAhmData, DraftLoadItem } from "@/lib/load-plan-calc";
import { LoadPlanQueryProvider } from "./query-provider";
import { useLoadDraftStore, type LoadDraftInit } from "./load-draft-store";
import { useLiveWnb } from "./use-live-wnb";
import { PositionList } from "./position-list";
import { AircraftDiagram } from "./aircraft-diagram";
import { PositionAssignmentModal } from "./position-assignment-modal";
import { groupByCode } from "./position-groups";
import { FuelCrewForm } from "./fuel-crew-form";
import { WnbPanel } from "./wnb-panel";
import { SaveBar } from "./save-bar";
import { TrimButton } from "./trim-button";

function LoadPlanContent({
  legId,
  flightNo,
  registration,
  fromIata,
  toIata,
  ahmData,
  initialDraft,
  planVersion,
  planStatus,
}: {
  legId: string;
  flightNo: string;
  registration: string;
  fromIata: string;
  toIata: string;
  ahmData: LoadPlanAhmData;
  initialDraft: LoadDraftInit;
  planVersion: number;
  planStatus: string | null;
}) {
  const t = useTranslations("loadPlan");
  const [tab, setTab] = useState<"positions" | "fuelCrew">("positions");
  const [openCode, setOpenCode] = useState<string | null>(null);

  const hasHydrated = useLoadDraftStore((s) => s.hasHydrated);
  const initialize = useLoadDraftStore((s) => s.initialize);
  const items = useLoadDraftStore((s) => s.items);

  useEffect(() => {
    if (hasHydrated) initialize(legId, initialDraft);
    // initialDraft is a fresh object every render from server props — only
    // re-run when the leg or hydration state actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydrated, legId]);

  const result = useLiveWnb(ahmData, registration);
  const overloadedPositions = new Set(result.positionOverloads.map((o) => o.position));

  const groups = groupByCode(ahmData.positions);
  const openGroup = groups.find((g) => g.code === openCode) ?? null;
  const itemByPosition = new Map(items.map((i) => [i.position, i]));

  if (!hasHydrated) {
    return <div className="p-6 text-sm text-fg-subtle">…</div>;
  }

  return (
    <div className="flex flex-col">
      <PageHeader title={`${t("title")} — ${flightNo}`} />
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 text-sm text-fg-subtle">
          <span>
            {fromIata}–{toIata} · {registration} · {t("version", { version: planVersion })}
          </span>
          {planStatus ? (
            <StatusBadge tone={planStatus === "FINALIZED" ? "success" : "neutral"}>
              {t(`status.${planStatus.toLowerCase()}` as never)}
            </StatusBadge>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTab("positions")}
                  className={`px-3 py-2 text-sm font-medium ${tab === "positions" ? "border-b-2 border-brand-500 text-fg" : "text-fg-subtle"}`}
                >
                  {t("positions.title")}
                </button>
                <button
                  type="button"
                  onClick={() => setTab("fuelCrew")}
                  className={`px-3 py-2 text-sm font-medium ${tab === "fuelCrew" ? "border-b-2 border-brand-500 text-fg" : "text-fg-subtle"}`}
                >
                  {t("fuel.title")} / {t("crew.title")}
                </button>
              </div>
              {tab === "positions" ? <TrimButton ahmData={ahmData} registration={registration} /> : null}
            </div>

            {tab === "positions" ? (
              <>
                <div className="sticky top-0 z-10 -mx-4 bg-bg px-4 pb-2 sm:hidden">
                  <AircraftDiagram positions={ahmData.positions} overloaded={overloadedPositions} onSelect={setOpenCode} compact />
                </div>
                <div className="hidden sm:block">
                  <AircraftDiagram positions={ahmData.positions} overloaded={overloadedPositions} onSelect={setOpenCode} />
                </div>
                <PositionList positions={ahmData.positions} overloaded={overloadedPositions} onSelect={setOpenCode} />
              </>
            ) : (
              <FuelCrewForm cockpitMaxSeats={ahmData.cockpitMaxSeats} courierMaxSeats={ahmData.courierMaxSeats} />
            )}
          </div>

          <div className="lg:sticky lg:top-4 lg:self-start">
            <WnbPanel result={result} />
          </div>
        </div>
      </div>

      <PositionAssignmentModal
        // Remounts the modal (resetting its internal form state) whenever
        // the target position changes — otherwise its useState initial
        // values only apply once and a newly-opened position starts
        // pre-filled with the previous position's stale weight/ULD/AWB.
        key={openGroup?.code ?? "none"}
        code={openGroup?.code ?? null}
        variants={openGroup?.variants ?? []}
        existing={openGroup ? (itemByPosition.get(openGroup.code) ?? null) : null}
        onClose={() => setOpenCode(null)}
      />

      <SaveBar legId={legId} ahmData={ahmData} registration={registration} result={result} />
    </div>
  );
}

export function LoadPlanShell(props: {
  legId: string;
  flightNo: string;
  registration: string;
  fromIata: string;
  toIata: string;
  ahmData: LoadPlanAhmData;
  initialDraft: LoadDraftInit;
  planVersion: number;
  planStatus: string | null;
}) {
  return (
    <LoadPlanQueryProvider>
      <LoadPlanContent {...props} />
    </LoadPlanQueryProvider>
  );
}

export type { DraftLoadItem };
