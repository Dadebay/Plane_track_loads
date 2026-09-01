"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { X, Plus, Trash2 } from "lucide-react";
import { DatePicker } from "@tua/ui";
import { createFlight, updateFlight, type FlightFormInput } from "./actions";

export interface StationOption {
  id: string;
  iata: string;
  name: string;
}

export interface AircraftOption {
  id: string;
  registration: string;
}

export interface EditingFlight {
  id: string;
  flightNo: string;
  date: string; // yyyy-mm-dd
  serviceType: string;
  aircraftId: string;
  status: string;
  legs: { fromStationId: string; toStationId: string; via: string; stdDep: string; staArr: string }[];
}

interface LegDraft {
  fromStationId: string;
  toStationId: string;
  via: string;
  stdDep: string;
  staArr: string;
}

const FLIGHT_STATUSES = ["RESERVED", "PLANNED", "LOADING", "FINALIZED", "DEPARTED", "ARRIVED", "CANCELLED"] as const;

const emptyLeg: LegDraft = { fromStationId: "", toStationId: "", via: "", stdDep: "", staArr: "" };
const inputClass = "h-11 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg sm:h-9";
const labelClass = "flex flex-col gap-1 text-xs font-medium text-fg-muted";

export function FlightFormModal({
  open,
  onClose,
  onSaved,
  stations,
  aircraft,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  stations: StationOption[];
  aircraft: AircraftOption[];
  editing: EditingFlight | null;
}) {
  const t = useTranslations("flights.form");
  const tSchedule = useTranslations("flights.schedule");
  const tStatus = useTranslations("flights.status");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const [flightNo, setFlightNo] = useState(editing?.flightNo ?? "");
  const [date, setDate] = useState(editing?.date ?? "");
  const [serviceType, setServiceType] = useState(editing?.serviceType ?? "");
  const [aircraftId, setAircraftId] = useState(editing?.aircraftId ?? aircraft[0]?.id ?? "");
  const [status, setStatus] = useState(editing?.status ?? "RESERVED");
  const [legs, setLegs] = useState<LegDraft[]>(
    editing?.legs.length ? editing.legs.map((l) => ({ ...l })) : [{ ...emptyLeg }],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ message: string; flightNo?: string } | null>(null);

  if (!open) return null;

  function updateLeg(index: number, patch: Partial<LegDraft>) {
    setLegs((prev) => prev.map((leg, i) => (i === index ? { ...leg, ...patch } : leg)));
  }

  function addLeg() {
    setLegs((prev) => [...prev, { ...emptyLeg }]);
  }

  function removeLeg(index: number) {
    setLegs((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const input: FlightFormInput = {
      flightNo,
      date,
      serviceType,
      aircraftId,
      status: editing ? (status as FlightFormInput["status"]) : undefined,
      legs: legs.map((leg) => ({
        fromStationId: leg.fromStationId,
        toStationId: leg.toStationId,
        via: leg.via || undefined,
        stdDep: leg.stdDep,
        staArr: leg.staArr,
      })),
    };

    const result = editing ? await updateFlight(editing.id, input) : await createFlight(input);
    setSaving(false);

    if (!result.ok) {
      setError({ message: result.error ?? "validation", flightNo: result.conflictFlightNo });
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-bg-subtle shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold text-fg">{editing ? tSchedule("editFlight") : tSchedule("addFlight")}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-fg-muted hover:bg-bg-muted">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-5">
          {error ? (
            <p className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger" role="alert">
              {t(error.message, error.flightNo ? { flightNo: error.flightNo } : undefined)}
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              {t("flightNo")}
              <input required value={flightNo} onChange={(e) => setFlightNo(e.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              {t("date")}
              <DatePicker
                value={date}
                onChange={setDate}
                required
                locale={locale}
                labels={{ clear: tCommon("clear"), today: tCommon("today") }}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              {t("serviceType")}
              <input
                required
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              {t("aircraft")}
              <select required value={aircraftId} onChange={(e) => setAircraftId(e.target.value)} className={inputClass}>
                {aircraft.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.registration}
                  </option>
                ))}
              </select>
            </label>
            {editing ? (
              <label className={labelClass}>
                {tCommon("status")}
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
                  {FLIGHT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {tStatus(s.toLowerCase())}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-fg">{t("legs")}</h3>
              <button
                type="button"
                onClick={addLeg}
                className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-sm font-medium text-fg hover:bg-bg-muted"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                {t("addLeg")}
              </button>
            </div>

            {legs.map((leg, i) => (
              <div key={i} className="flex flex-col gap-3 rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-fg-subtle">{t("leg", { n: i + 1 })}</span>
                  {legs.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeLeg(i)}
                      aria-label={t("removeLeg")}
                      className="rounded-md p-1 text-danger hover:bg-danger-bg"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className={labelClass}>
                    {t("from")}
                    <select
                      required
                      value={leg.fromStationId}
                      onChange={(e) => updateLeg(i, { fromStationId: e.target.value })}
                      className={inputClass}
                    >
                      <option value="" disabled>
                        —
                      </option>
                      {stations.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.iata} — {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={labelClass}>
                    {t("to")}
                    <select
                      required
                      value={leg.toStationId}
                      onChange={(e) => updateLeg(i, { toStationId: e.target.value })}
                      className={inputClass}
                    >
                      <option value="" disabled>
                        —
                      </option>
                      {stations.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.iata} — {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={labelClass}>
                    {t("via")}
                    <input value={leg.via} onChange={(e) => updateLeg(i, { via: e.target.value })} className={inputClass} />
                  </label>
                  <div />
                  <label className={labelClass}>
                    {t("stdDep")}
                    <input
                      required
                      type="datetime-local"
                      value={leg.stdDep}
                      onChange={(e) => updateLeg(i, { stdDep: e.target.value })}
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    {t("staArr")}
                    <input
                      required
                      type="datetime-local"
                      value={leg.staArr}
                      onChange={(e) => updateLeg(i, { staArr: e.target.value })}
                      className={inputClass}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-md border border-border px-4 text-sm font-medium text-fg hover:bg-bg-muted sm:h-9"
            >
              {tCommon("cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-11 rounded-md bg-brand-500 px-4 text-sm font-semibold text-fg-on-brand disabled:opacity-50 sm:h-9"
            >
              {saving ? t("saving") : t("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
