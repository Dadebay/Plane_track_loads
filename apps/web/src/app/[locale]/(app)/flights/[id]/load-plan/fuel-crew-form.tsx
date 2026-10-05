"use client";

import { useTranslations } from "next-intl";
import { validateTankAllocation } from "@tua/wnb-core";
import { blockFuelOf } from "@/lib/fuel-block";
import { formatWeight } from "@/lib/format-number";
import { TANK_SLOTS, useLoadDraftStore } from "./load-draft-store";

const inputClass = "h-11 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg sm:h-9";
const labelClass = "flex flex-col gap-1 text-xs font-medium text-fg-muted";

export function FuelCrewForm({ cockpitMaxSeats, courierMaxSeats }: { cockpitMaxSeats: number; courierMaxSeats: number }) {
  const tFuel = useTranslations("loadPlan.fuel");
  const tCrew = useTranslations("loadPlan.crew");

  const fuel = useLoadDraftStore((s) => s.fuel);
  const setFuel = useLoadDraftStore((s) => s.setFuel);
  const setBlockFuel = useLoadDraftStore((s) => s.setBlockFuel);
  const setTaxiFuel = useLoadDraftStore((s) => s.setTaxiFuel);
  const cockpitCrew = useLoadDraftStore((s) => s.cockpitCrew);
  const courierCrew = useLoadDraftStore((s) => s.courierCrew);
  const setCrew = useLoadDraftStore((s) => s.setCrew);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border p-3">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-subtle">{tFuel("title")}</h3>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            {tFuel("density")}
            <input
              type="number"
              step="0.001"
              value={fuel.density}
              onChange={(e) => setFuel({ ...fuel, density: e.target.value })}
              className={inputClass}
            />
          </label>
          <BlockFuelField
            label={tFuel("blockFuel")}
            derivedLabel={tFuel("takeoffFuelDerived", { takeoff: formatWeight(fuel.takeoffFuel || "0") })}
            belowTaxiLabel={tFuel("blockBelowTaxi")}
            takeoffFuel={fuel.takeoffFuel}
            taxiFuel={fuel.taxiFuel}
            onChange={setBlockFuel}
            inputClass={inputClass}
            labelClass={labelClass}
          />
          <label className={labelClass}>
            {tFuel("tripFuel")}
            <input
              type="number"
              step="1"
              value={fuel.tripFuel}
              onChange={(e) => setFuel({ ...fuel, tripFuel: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            {tFuel("taxiFuel")}
            <input
              type="number"
              step="1"
              value={fuel.taxiFuel}
              onChange={(e) => setTaxiFuel(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
      </div>

      <TankDistribution />

      <div className="rounded-lg border border-border p-3">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-subtle">{tCrew("title")}</h3>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            {tCrew("cockpit")}
            <select
              value={cockpitCrew ?? ""}
              onChange={(e) => setCrew(e.target.value ? Number(e.target.value) : null, courierCrew)}
              className={inputClass}
            >
              <option value="">—</option>
              {Array.from({ length: cockpitMaxSeats }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            {tCrew("courier")}
            <select
              value={courierCrew ?? ""}
              onChange={(e) => setCrew(cockpitCrew, e.target.value ? Number(e.target.value) : null)}
              className={inputClass}
            >
              <option value="">—</option>
              {Array.from({ length: courierMaxSeats + 1 }, (_, i) => i).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        {cockpitCrew === null || courierCrew === null ? (
          <p className="mt-2 text-xs text-fg-subtle">{tCrew("notSet")}</p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Per-tank distribution of the takeoff fuel — AHM 560 Appendix I s.75.
 *
 * Manual only: the approved AHM publishes no refuelling schedule, so there
 * is no automatic mode to offer. The running difference is shown live and in
 * Decimal, because the server will reject anything that does not sum exactly
 * (see wnb-core's validateTankAllocation).
 */
function TankDistribution() {
  const t = useTranslations("loadPlan.tanks");
  const fuel = useLoadDraftStore((s) => s.fuel);
  const allocations = useLoadDraftStore((s) => s.fuelAllocations);
  const setFuelAllocation = useLoadDraftStore((s) => s.setFuelAllocation);
  const clearFuelAllocations = useLoadDraftStore((s) => s.clearFuelAllocations);

  const weightOf = (tank: string, side: string) =>
    allocations.find((a) => a.tank === tank && a.side === side)?.weight ?? "";

  const check = allocations.length > 0 ? validateTankAllocation(allocations, fuel.takeoffFuel || "0") : null;

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">{t("title")}</h3>
        {allocations.length > 0 ? (
          <button
            type="button"
            onClick={clearFuelAllocations}
            className="h-8 rounded-md border border-border px-2 text-xs font-medium text-fg-muted hover:bg-bg-muted"
          >
            {t("clear")}
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {TANK_SLOTS.map((slot) => (
          <label key={`${slot.tank}-${slot.side}`} className={labelClass}>
            {t(`slot.${slot.tank}_${slot.side}` as never)}
            <input
              type="number"
              min="0"
              step="1"
              inputMode="decimal"
              value={weightOf(slot.tank, slot.side)}
              onChange={(e) => setFuelAllocation(slot.tank, slot.side, e.target.value)}
              className={inputClass}
            />
          </label>
        ))}
      </div>

      {check ? (
        <p
          role="status"
          aria-live="polite"
          className={`mt-3 text-xs ${check.balanced ? "text-success" : "text-danger"}`}
        >
          {check.balanced
            ? t("balanced", { total: formatWeight(check.allocated) })
            : t("difference", {
                allocated: formatWeight(check.allocated),
                total: formatWeight(check.total),
                difference: formatWeight(check.difference),
              })}
        </p>
      ) : (
        <p className="mt-3 text-xs text-fg-subtle">{t("empty")}</p>
      )}

      <p className="mt-1 text-[11px] text-fg-subtle">{t("manualOnly")}</p>
    </div>
  );
}

/**
 * The figure off the refuelling slip. Shown with the take-off fuel it
 * resolves to, so the number the loadsheet will print is on screen before
 * the sheet is produced rather than only on the paper.
 */
export function BlockFuelField({
  label,
  derivedLabel,
  belowTaxiLabel,
  takeoffFuel,
  taxiFuel,
  onChange,
  disabled,
  inputClass: inputClassName,
  labelClass: labelClassName,
}: {
  label: string;
  derivedLabel: string;
  belowTaxiLabel: string;
  takeoffFuel: string;
  taxiFuel: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  inputClass: string;
  labelClass: string;
}) {
  // A block figure under the taxi burn leaves nothing for the take-off roll,
  // so it is a typo rather than a flight. Saying so here beats a schema
  // rejection at save time, when the slip may no longer be in hand.
  const belowTaxi = takeoffFuel !== "" && Number(takeoffFuel) < 0;

  return (
    <label className={labelClassName}>
      {label}
      <input
        type="number"
        step="1"
        min="0"
        value={blockFuelOf(takeoffFuel, taxiFuel)}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={inputClassName}
      />
      <span className={`text-[11px] font-normal ${belowTaxi ? "text-danger" : "text-fg-subtle"}`}>
        {belowTaxi ? belowTaxiLabel : derivedLabel}
      </span>
    </label>
  );
}
