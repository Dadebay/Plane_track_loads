"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import {
  StatusBadge,
} from "@tua/ui";
import { PageHeader } from "@/components/page-header";
import { Link } from "@/i18n/navigation";
import type { LoadPlanAhmData, DraftLoadItem } from "@/lib/load-plan-calc";
import { LoadPlanQueryProvider } from "./query-provider";
import { useLoadDraftStore, type LoadDraftInit } from "./load-draft-store";
import { useLiveWnb } from "./use-live-wnb";
import { PositionList } from "./position-list";
import { AircraftDiagram } from "./aircraft-diagram";
import { PositionWorkspace } from "./position-workspace";
import { PositionAssignmentModal } from "./position-assignment-modal";
import { groupByCode } from "./position-groups";
import { FuelCrewForm } from "./fuel-crew-form";
import { FuelDistributionModal } from "./fuel-distribution-modal";
import { DowDoiModal } from "./dow-doi-modal";
import { ErrorLog } from "./error-log";
import { WnbPanel } from "./wnb-panel";
import { LoadPlanSidebar } from "./load-plan-sidebar";
import { SaveBar } from "./save-bar";
import { TrimButton } from "./trim-button";

function LoadPlanContent({
  legId,
  flightNo,
  registration,
  fromIata,
  toIata,
  stdDepDate,
  stdDepTime,
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
  stdDepDate: string;
  stdDepTime: string;
  ahmData: LoadPlanAhmData;
  initialDraft: LoadDraftInit;
  planVersion: number;
  planStatus: string | null;
}) {
  const t = useTranslations("loadPlan");
  const [tab, setTab] = useState<"positions" | "fuelCrew">("positions");
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [fuelOpen, setFuelOpen] = useState(false);
  const [dowOpen, setDowOpen] = useState(false);

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
  // A finalized plan is immutable (CLAUDE.md rule #5) — the workspace shows
  // it, greyed, rather than hiding it or letting a tap look like it worked.
  const isFinalized = planStatus === "FINALIZED";

  const groups = groupByCode(ahmData.positions);
  const openGroup = groups.find((g) => g.code === openCode) ?? null;
  const itemByPosition = new Map(items.map((i) => [i.position, i]));

  if (!hasHydrated) {
    // Loading state: the draft lives in IndexedDB, so the first paint has
    // nothing to show yet. Announced, not just a spinner.
    return (
      <div role="status" aria-live="polite" className="p-6 text-sm text-fg-subtle">
        {t("loading")}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title={`${t("title")} — ${flightNo}`}
        actions={
          // A load plan is reached from the flight list and there is no other
          // way out of it; without this the only exit is the browser's back
          // button, which a tablet in a ramp cradle may not show.
          <Link
            href="/flights"
            className="inline-flex h-11 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-fg hover:bg-bg-muted sm:h-9"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t("backToFlights")}
          </Link>
        }
      />
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

        {/* Figures on the left, the aircraft on the right — the shape a
            load controller reads: the numbers stay in one place while the
            deck scrolls. Below xl the two stack, deck first, because a
            phone is used at the aircraft. */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[19rem_minmax(0,1fr)]">
          <div className="order-2 xl:order-1 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:self-start xl:overflow-y-auto">
            <LoadPlanSidebar
              result={result}
              flightNo={flightNo}
              registration={registration}
              fromIata={fromIata}
              toIata={toIata}
              date={stdDepDate}
              time={stdDepTime}
              mzfw={ahmData.weightLimits.mzfw}
              onOpenFuel={() => setFuelOpen(true)}
              onOpenDow={() => setDowOpen(true)}
            />
          </div>

          <div className="order-1 flex flex-col gap-3 xl:order-2">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-bg-subtle/40 px-3 py-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
                {t("sidebar.allWeights")}
              </span>
              <span className="font-mono text-[11px] text-fg-subtle">{registration}</span>
            </div>

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
                {/* Desktop gets the full configuration-row workspace; the
                    phone keeps the compact mini-map above plus the position
                    list below, which is the readable shape at 375 px. */}
                <div className="hidden sm:block">
                  <PositionWorkspace
                    ahmData={ahmData}
                    overloaded={overloadedPositions}
                    readOnly={isFinalized}
                    onSelect={setOpenCode}
                  />
                </div>
                <div className="sm:hidden">
                  <PositionList
                    positions={ahmData.positions}
                    overloaded={overloadedPositions}
                    indexRows={result.positionIndexes.rows}
                    onSelect={setOpenCode}
                  />
                </div>
              </>
            ) : (
              <FuelCrewForm cockpitMaxSeats={ahmData.cockpitMaxSeats} courierMaxSeats={ahmData.courierMaxSeats} />
            )}

            <WnbPanel result={result} cgLimits={ahmData.cgLimits} />

            <ErrorLog result={result} />
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
        readOnly={isFinalized}
        uldTares={ahmData.uldTares}
        onClose={() => setOpenCode(null)}
      />

      <DowDoiModal open={dowOpen} onClose={() => setDowOpen(false)} breakdown={ahmData.dowDoiBreakdown} />

      <FuelDistributionModal
        open={fuelOpen}
        onClose={() => setFuelOpen(false)}
        fuelIndexTable={ahmData.fuelIndexTable}
        readOnly={isFinalized}
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
  stdDepDate: string;
  stdDepTime: string;
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
