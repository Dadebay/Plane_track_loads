"use client";

import { useTranslations } from "next-intl";
import { X, Info } from "lucide-react";
import { Decimal } from "decimal.js";
import { getFuelIndex, validateTankAllocation, type FuelIndexTable, type TankAllocation } from "@tua/wnb-core";
import { formatIndex, formatWeight } from "@/lib/format-number";
import { useLoadDraftStore } from "./load-draft-store";

/**
 * Tank-by-tank fuel distribution — AHM 560 Appendix I s.75.
 *
 * Laid out the way a refuelling sheet is read: left wing, centreline, right
 * wing, with the two wings mirrored so an asymmetry is visible as an
 * asymmetry rather than as two numbers in a list.
 *
 * Three of the figures Aerometa's equivalent screen shows are deliberately
 * blank here:
 *
 *   * **per-tank index** — FUEL INDEX PER TANK TABLE is transcribed but
 *     flagged provisional: the approved scan is ~174 ppi and 6 cannot be
 *     told from 8 at the printed precision (AHM560_ERRATA.md Kayıt 10).
 *     wnb-core's getTankFuelIndex() throws rather than return a number from
 *     it, and this screen must not quietly print one either.
 *   * **lateral moment** — FUEL LATERAL MOMENT PER TANK TABLE was not
 *     transcribed at all, for the same reason.
 *   * **automatic distribution** — the approved AHM publishes no refuelling
 *     schedule. A plausible-looking fill order would be an invented
 *     operational procedure, which is worse than an invented constant.
 *
 * What *is* shown is exact: the running total against the takeoff fuel in
 * Decimal, and the total fuel index from STANDARD FUEL INDEX TABLE, which is
 * verified data.
 */

const inputClass =
  "h-11 w-full rounded-md border border-border bg-bg px-3 text-right font-mono text-sm tabular-nums text-fg sm:h-9";
const tankLabelClass = "text-[11px] font-semibold uppercase tracking-wide text-fg-muted";

interface TankSlot {
  tank: TankAllocation["tank"];
  side: TankAllocation["side"];
  labelKey: string;
}

/** The plate's own grouping: a left wing, a right wing, and the centreline
 * pair between them. Inner tanks are inboard of the outer ones, so they sit
 * on top of each column. */
const COLUMNS: { headingKey: string; slots: TankSlot[] }[] = [
  {
    headingKey: "leftWing",
    slots: [
      { tank: "INNER", side: "LEFT", labelKey: "innerTank" },
      { tank: "OUTER", side: "LEFT", labelKey: "outerTank" },
    ],
  },
  {
    headingKey: "centerAndTrim",
    slots: [
      { tank: "CENTER", side: "CENTRE", labelKey: "centerTank" },
      { tank: "TRIM", side: "CENTRE", labelKey: "trimTank" },
    ],
  },
  {
    headingKey: "rightWing",
    slots: [
      { tank: "INNER", side: "RIGHT", labelKey: "innerTank" },
      { tank: "OUTER", side: "RIGHT", labelKey: "outerTank" },
    ],
  },
];

export function FuelDistributionModal({
  open,
  onClose,
  fuelIndexTable,
  readOnly = false,
}: {
  open: boolean;
  onClose: () => void;
  /** STANDARD FUEL INDEX TABLE — verified, unlike the per-tank table. */
  fuelIndexTable: FuelIndexTable;
  readOnly?: boolean;
}) {
  const t = useTranslations("loadPlan.fuelModal");
  const tFuel = useTranslations("loadPlan.fuel");
  const tCommon = useTranslations("common");

  const fuel = useLoadDraftStore((s) => s.fuel);
  const setFuel = useLoadDraftStore((s) => s.setFuel);
  const allocations = useLoadDraftStore((s) => s.fuelAllocations);
  const setFuelAllocation = useLoadDraftStore((s) => s.setFuelAllocation);
  const clearFuelAllocations = useLoadDraftStore((s) => s.clearFuelAllocations);

  if (!open) return null;

  const weightOf = (slot: TankSlot) =>
    allocations.find((a) => a.tank === slot.tank && a.side === slot.side)?.weight ?? "";

  const check = validateTankAllocation(allocations, fuel.takeoffFuel || "0");

  // The total-fuel index comes from the verified STANDARD FUEL INDEX TABLE,
  // not from the provisional per-tank one. Out-of-range or an unparseable
  // density throws — that is a real input error, shown as "—" rather than a
  // crash, because the controller is still typing.
  let totalFuelIndex: string | null = null;
  try {
    if (fuel.takeoffFuel && Number(fuel.takeoffFuel) > 0) {
      totalFuelIndex = getFuelIndex(fuel.takeoffFuel, fuel.density, fuelIndexTable).toDecimalPlaces(2).toString();
    }
  } catch {
    totalFuelIndex = null;
  }

  const asymmetric = check.asymmetry.filter((entry) => !new Decimal(entry.difference).isZero());

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("title")}
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-border bg-bg-subtle shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold text-fg">{t("title")}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={tCommon("close")}
            className="rounded-md p-1.5 text-fg-muted hover:bg-bg-muted"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          {/* Density / mode / total — the three inputs the distribution
              depends on, kept above the tanks so a change to any of them is
              visibly upstream of the numbers below. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-fg-muted">
              {tFuel("density")}
              <input
                type="number"
                step="0.001"
                value={fuel.density}
                disabled={readOnly}
                onChange={(e) => setFuel({ ...fuel, density: e.target.value })}
                className={inputClass}
              />
            </label>

            <div className="flex flex-col gap-1 text-xs font-medium text-fg-muted">
              <span id="refuel-mode-label">{t("refuelMode")}</span>
              <div
                role="group"
                aria-labelledby="refuel-mode-label"
                className="flex h-11 items-stretch overflow-hidden rounded-md border border-border sm:h-9"
              >
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  title={t("automaticUnavailable")}
                  className="flex-1 cursor-not-allowed bg-bg-muted/40 text-xs text-fg-subtle"
                >
                  {t("modeAutomatic")}
                </button>
                <button
                  type="button"
                  aria-pressed="true"
                  className="flex-1 bg-brand-600 text-xs font-semibold text-white"
                >
                  {t("modeManual")}
                </button>
              </div>
            </div>

            <label className="flex flex-col gap-1 text-xs font-medium text-fg-muted">
              {t("totalFuel")}
              <input
                type="number"
                step="1"
                min="0"
                value={fuel.takeoffFuel}
                disabled={readOnly}
                onChange={(e) => setFuel({ ...fuel, takeoffFuel: e.target.value })}
                className={inputClass}
              />
            </label>
          </div>

          <p className="flex items-start gap-1.5 rounded-md border border-border bg-bg-muted/30 px-3 py-2 text-[11px] text-fg-subtle">
            <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t("automaticUnavailable")}
          </p>

          {/* Tanks, wing by wing. */}
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                {t("tanksConfiguration")}
              </h3>
              {allocations.length > 0 && !readOnly ? (
                <button
                  type="button"
                  onClick={clearFuelAllocations}
                  className="h-8 rounded-md border border-border px-2 text-xs font-medium text-fg-muted hover:bg-bg-muted"
                >
                  {t("clear")}
                </button>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {COLUMNS.map((column) => (
                <div key={column.headingKey} className="rounded-lg border border-border p-3">
                  <h4 className="mb-3 text-center text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                    {t(column.headingKey as never)}
                  </h4>
                  <div className="flex flex-col gap-3">
                    {column.slots.map((slot) => (
                      <div key={`${slot.tank}-${slot.side}`} className="flex flex-col gap-1">
                        <label className={tankLabelClass} htmlFor={`tank-${slot.tank}-${slot.side}`}>
                          {t(slot.labelKey as never)}
                        </label>
                        <input
                          id={`tank-${slot.tank}-${slot.side}`}
                          type="number"
                          min="0"
                          step="1"
                          inputMode="decimal"
                          value={weightOf(slot)}
                          disabled={readOnly}
                          onChange={(e) => setFuelAllocation(slot.tank, slot.side, e.target.value)}
                          className={inputClass}
                        />
                        {/* Per-tank index stays blank on purpose — see the
                            module comment. The reason travels with it so a
                            controller is never left guessing. */}
                        <span className="text-[10px] text-fg-subtle" title={t("tankIndexUnavailable")}>
                          {t("tankIndexLabel")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Running total — the server rejects anything that does not sum
              exactly, so the difference is shown live rather than at save. */}
          <p
            role="status"
            aria-live="polite"
            className={`text-xs ${
              allocations.length === 0 ? "text-fg-subtle" : check.balanced ? "text-success" : "text-danger"
            }`}
          >
            {allocations.length === 0
              ? t("notDistributed")
              : check.balanced
                ? t("balanced", { total: formatWeight(check.allocated) })
                : t("difference", {
                    allocated: formatWeight(check.allocated),
                    total: formatWeight(check.total),
                    difference: formatWeight(check.difference),
                  })}
          </p>

          {asymmetric.length > 0 ? (
            <p className="text-xs text-warning">
              {t("asymmetry", {
                detail: asymmetric
                  .map((entry) => `${entry.tank} ${formatWeight(entry.difference)}`)
                  .join(" · "),
              })}
            </p>
          ) : null}

          {/* Summary strip. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCell label={t("fuelIndex")} value={totalFuelIndex ? formatIndex(totalFuelIndex) : "—"} />
            <SummaryCell label={t("lateralMoment")} value="—" hint={t("lateralMomentUnavailable")} />
            <label className="flex flex-col gap-1 text-xs font-medium text-fg-muted">
              {tFuel("taxiFuel")}
              <input
                type="number"
                step="1"
                min="0"
                value={fuel.taxiFuel}
                disabled={readOnly}
                onChange={(e) => setFuel({ ...fuel, taxiFuel: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-fg-muted">
              {tFuel("tripFuel")}
              <input
                type="number"
                step="1"
                min="0"
                value={fuel.tripFuel}
                disabled={readOnly}
                onChange={(e) => setFuel({ ...fuel, tripFuel: e.target.value })}
                className={inputClass}
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-md border border-border px-4 text-sm font-medium text-fg hover:bg-bg-muted sm:h-9"
          >
            {tCommon("close")}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryCell({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border px-3 py-2" title={hint}>
      <span className="text-xs font-medium text-fg-muted">{label}</span>
      <span className="font-mono text-sm tabular-nums text-fg">{value}</span>
      {hint ? <span className="text-[10px] leading-tight text-fg-subtle">{hint}</span> : null}
    </div>
  );
}
