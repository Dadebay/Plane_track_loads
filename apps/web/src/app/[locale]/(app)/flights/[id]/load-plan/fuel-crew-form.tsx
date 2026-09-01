"use client";

import { useTranslations } from "next-intl";
import { useLoadDraftStore } from "./load-draft-store";

const inputClass = "h-11 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg sm:h-9";
const labelClass = "flex flex-col gap-1 text-xs font-medium text-fg-muted";

export function FuelCrewForm({ cockpitMaxSeats, courierMaxSeats }: { cockpitMaxSeats: number; courierMaxSeats: number }) {
  const tFuel = useTranslations("loadPlan.fuel");
  const tCrew = useTranslations("loadPlan.crew");

  const fuel = useLoadDraftStore((s) => s.fuel);
  const setFuel = useLoadDraftStore((s) => s.setFuel);
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
          <label className={labelClass}>
            {tFuel("takeoffFuel")}
            <input
              type="number"
              step="1"
              value={fuel.takeoffFuel}
              onChange={(e) => setFuel({ ...fuel, takeoffFuel: e.target.value })}
              className={inputClass}
            />
          </label>
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
              onChange={(e) => setFuel({ ...fuel, taxiFuel: e.target.value })}
              className={inputClass}
            />
          </label>
        </div>
      </div>

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
