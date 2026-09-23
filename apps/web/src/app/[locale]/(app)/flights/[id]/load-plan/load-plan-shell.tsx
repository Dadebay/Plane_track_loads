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
import type { WorkspaceCell } from "@/lib/position-workspace";
import { LoadPlanQueryProvider } from "./query-provider";
import { useLoadDraftStore, type LoadDraftInit } from "./load-draft-store";
import { useLiveWnb } from "./use-live-wnb";
import { PositionList } from "./position-list";
import { AircraftDiagram } from "./aircraft-diagram";
import { PositionWorkspace } from "./position-workspace";
import { PositionAssignmentModal } from "./position-assignment-modal";
import { groupByCode, pickVariant } from "./position-groups";
import { FuelCrewForm } from "./fuel-crew-form";
import { FuelDistributionModal } from "./fuel-distribution-modal";
import { DowDoiModal } from "./dow-doi-modal";
import { ErrorLog } from "./error-log";
import { WnbPanel } from "./wnb-panel";
import { LoadPlanSidebar } from "./load-plan-sidebar";
import { SaveBar } from "./save-bar";
import { AmendingNotice, FinalizedBar } from "./finalized-bar";
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
  // Which cell was opened, not just which code: a code published on two
  // mutually exclusive configuration rows would otherwise open on the
  // wrong row (see pickVariant).
  const [open, setOpen] = useState<{ code: string; uldType: string | null } | null>(null);
  const [blocked, setBlocked] = useState<WorkspaceCell | null>(null);
  const openCell = (code: string, uldType?: string) => setOpen({ code, uldType: uldType ?? null });
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
  //
  // Correcting one is not an exception to that rule but an application of
  // it: `amending` unlocks the plate to compose the *next* version, and
  // saving records that version while the finalized one is kept and marked
  // superseded. Local state, because nothing is decided until it is saved —
  // pressing the button must not itself write anything.
  const [amending, setAmending] = useState(false);
  const isFinalized = planStatus === "FINALIZED" && !amending;

  const groups = groupByCode(ahmData.positions);
  const openGroup = groups.find((g) => g.code === open?.code) ?? null;
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
            {fromIata}–{toIata} · {registration} ·{" "}
            {/* While a correction is being composed the header names the
                version being written, not the one it replaces. */}
            {t("version", { version: amending ? planVersion + 1 : planVersion })}
          </span>
          {planStatus ? (
            <StatusBadge tone={isFinalized ? "success" : "neutral"}>
              {t(`status.${(amending ? "DRAFT" : planStatus).toLowerCase()}` as never)}
            </StatusBadge>
          ) : null}
        </div>

        {amending ? <AmendingNotice version={planVersion} onCancel={() => setAmending(false)} /> : null}

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
                  <AircraftDiagram positions={ahmData.positions} overloaded={overloadedPositions} onSelect={(code) => openCell(code)} compact />
                </div>
                {/* Desktop gets the full configuration-row workspace; the
                    phone keeps the compact mini-map above plus the position
                    list below, which is the readable shape at 375 px. */}
                <div className="hidden sm:block">
                  <PositionWorkspace
                    ahmData={ahmData}
                    overloaded={overloadedPositions}
                    readOnly={isFinalized}
                    onSelect={openCell}
                    onBlocked={setBlocked}
                    highlight={
                      blocked
                        ? { blockedKey: blocked.key, blockerKeys: blocked.blockedBy.map((b) => b.key) }
                        : null
                    }
                  />
                </div>
                <div className="sm:hidden">
                  <PositionList
                    positions={ahmData.positions}
                    overloaded={overloadedPositions}
                    indexRows={result.positionIndexes.rows}
                    onSelect={(code) => openCell(code)}
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
        initialUldType={
          openGroup
            ? pickVariant(openGroup.variants, open?.uldType ?? null, itemByPosition.get(openGroup.code)?.uldType)
            : ""
        }
        readOnly={isFinalized}
        uldTares={ahmData.uldTares}
        onClose={() => setOpen(null)}
      />

      <DowDoiModal open={dowOpen} onClose={() => setDowOpen(false)} breakdown={ahmData.dowDoiBreakdown} />

      <FuelDistributionModal
        open={fuelOpen}
        onClose={() => setFuelOpen(false)}
        fuelIndexTable={ahmData.fuelIndexTable}
        readOnly={isFinalized}
      />

      <BlockedCellDialog cell={blocked} onClose={() => setBlocked(null)} />

      {planStatus === "FINALIZED" && !amending ? (
        <FinalizedBar version={planVersion} onAmend={() => setAmending(true)} />
      ) : (
        <SaveBar legId={legId} ahmData={ahmData} registration={registration} result={result} />
      )}
    </div>
  );
}

/**
 * Why a position cannot be used.
 *
 * AHM 560 prints mutually exclusive configuration rows, so loading one
 * position takes its neighbours on the other rows out of play. Clicking
 * such a cell used to do nothing at all — the controller was left to work
 * out the rule from a greyed-out box. This says which position took it and
 * why, in their own language.
 */
function BlockedCellDialog({ cell, onClose }: { cell: WorkspaceCell | null; onClose: () => void }) {
  const t = useTranslations("loadPlan.workspace");
  if (!cell) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("blockedTitle", { position: cell.code })}
      // Bottom-left, never centred: centring put the card on top of the
      // very cells it is ringing, and the left is where the figures panel
      // sits rather than the plate. The backdrop stays light for the same
      // reason — the plate behind it is half the explanation.
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 p-4 sm:justify-start"
      onClick={onClose}
      onKeyDown={(event) => event.key === "Escape" && onClose()}
    >
      <div
        className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-border bg-bg p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-fg">{t("blockedTitle", { position: cell.code })}</h2>

        {/* The same two colours the plate is ringing behind this dialog:
            danger for the position that cannot be used, accent for the
            loaded one holding its floor. Colour is never the only signal —
            each card is labelled in words as well. */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 rounded-lg border-2 border-danger bg-danger-bg px-3 py-2">
            <span className="font-mono text-base font-bold text-danger">{cell.code}</span>
            <span className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wide text-danger">
                {t("blockedCardTitle")}
              </span>
              <span className="text-xs text-fg-muted">{cell.rowLabel}</span>
            </span>
          </div>

          {cell.blockedBy.map((blocker) => (
            <div
              key={blocker.key}
              className="flex items-center gap-3 rounded-lg border-2 border-info bg-info-bg px-3 py-2"
            >
              <span className="font-mono text-base font-bold text-info">{blocker.code}</span>
              <span className="flex flex-col">
                <span className="text-xs font-semibold uppercase tracking-wide text-info">
                  {t("blockerCardTitle")}
                </span>
                <span className="text-xs text-fg-muted">{blocker.rowLabel}</span>
              </span>
            </div>
          ))}
        </div>

        <p className="text-sm leading-relaxed text-fg-muted">{t("blockedExplanation")}</p>

        <button
          type="button"
          onClick={onClose}
          autoFocus
          className="h-11 self-end rounded-md bg-brand-500 px-5 text-sm font-semibold text-white hover:bg-brand-600 sm:h-9"
        >
          {t("close")}
        </button>
      </div>
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
