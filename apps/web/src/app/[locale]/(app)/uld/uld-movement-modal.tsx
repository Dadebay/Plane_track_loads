"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { X } from "lucide-react";
import { getUldMovements, recordUldMovement, type UldMovementRow } from "./actions";
import type { StationOption } from "./uld-form-modal";

export interface FlightOption {
  id: string;
  flightNo: string;
  date: string;
}

const inputClass = "h-11 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg sm:h-9";
const labelClass = "flex flex-col gap-1 text-xs font-medium text-fg-muted";

export function UldMovementModal({
  open,
  onClose,
  onSaved,
  uld,
  stations,
  flights,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  uld: { id: string; code: string } | null;
  stations: StationOption[];
  flights: FlightOption[];
}) {
  const t = useTranslations("uld.movement");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const [movements, setMovements] = useState<UldMovementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [stationId, setStationId] = useState(stations[0]?.id ?? "");
  const [flightId, setFlightId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !uld) return;
    setLoading(true);
    getUldMovements(uld.id)
      .then(setMovements)
      .finally(() => setLoading(false));
  }, [open, uld]);

  if (!open || !uld) return null;

  async function handleRecord(e: React.FormEvent) {
    e.preventDefault();
    if (!uld) return;
    setSaving(true);
    const result = await recordUldMovement(uld.id, { stationId, flightId: flightId || undefined, note: note || undefined });
    setSaving(false);
    if (result.ok) {
      setNote("");
      setFlightId("");
      const fresh = await getUldMovements(uld.id);
      setMovements(fresh);
      onSaved();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg border border-border bg-bg-subtle shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold text-fg">
            {t("title")} — {uld.code}
          </h2>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-fg-muted hover:bg-bg-muted">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleRecord} className="flex flex-col gap-3 border-b border-border p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className={labelClass}>
              {t("station")}
              <select required value={stationId} onChange={(e) => setStationId(e.target.value)} className={inputClass}>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.iata}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              {t("flight")}
              <select value={flightId} onChange={(e) => setFlightId(e.target.value)} className={inputClass}>
                <option value="">—</option>
                {flights.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.flightNo} ({f.date})
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              {t("note")}
              <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
            </label>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-11 items-center justify-center self-start rounded-md bg-brand-500 px-4 text-sm font-semibold text-fg-on-brand disabled:opacity-50 sm:h-9"
          >
            {t("recordMovement")}
          </button>
        </form>

        <div className="p-5">
          {loading ? (
            <p className="text-sm text-fg-subtle">{tCommon("loading")}</p>
          ) : movements.length === 0 ? (
            <p className="text-sm text-fg-subtle">{t("noMovements")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {movements.map((m) => (
                <li key={m.id} className="flex flex-col gap-0.5 rounded-md border border-border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-fg">
                      {m.stationIata}
                      {m.flightNo ? ` · ${m.flightNo}` : ""}
                    </span>
                    <span className="text-xs text-fg-subtle">
                      {new Intl.DateTimeFormat(locale, {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(m.recordedAt))}
                    </span>
                  </div>
                  {m.note ? <span className="text-fg-subtle">{m.note}</span> : null}
                  {m.recordedByName ? (
                    <span className="text-xs text-fg-subtle">
                      {t("recordedBy")}: {m.recordedByName}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
