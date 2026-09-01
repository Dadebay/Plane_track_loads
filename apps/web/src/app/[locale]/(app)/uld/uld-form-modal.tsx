"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { X, Wand2 } from "lucide-react";
import { buildUldCode, isValidUldCode } from "@/lib/uld-code";
import { createUld, updateUld, type UldFormInput } from "./actions";

export interface StationOption {
  id: string;
  iata: string;
  name: string;
}

export interface UldTypeInfo {
  typeCode: string;
  tareWeight: string;
  grossWeight: string;
  volume: string;
  deck: "MAIN" | "LOWER" | "LOWER_OR_MAIN";
}

export interface EditingUld {
  id: string;
  code: string;
  typeCode: string;
  serial: string;
  ownerCode: string;
  status: string;
  condition: string;
  baseplateCode: string;
  assignedStationId: string;
  currentStationId: string;
}

const ULD_STATUSES = ["AVAILABLE", "ASSIGNED", "DAMAGED", "LOST"] as const;
const ULD_CONDITIONS = ["SERVICEABLE", "DAMAGED", "UNSERVICEABLE"] as const;

const inputClass = "h-11 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg sm:h-9";
const labelClass = "flex flex-col gap-1 text-xs font-medium text-fg-muted";

export function UldFormModal({
  open,
  onClose,
  onSaved,
  stations,
  editing,
  uldTypeInfo,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  stations: StationOption[];
  editing: EditingUld | null;
  uldTypeInfo: UldTypeInfo[];
}) {
  const t = useTranslations("uld");
  const tForm = useTranslations("uld.form");
  const tNaming = useTranslations("uld.naming");
  const tStatus = useTranslations("uld.statusValue");
  const tCondition = useTranslations("uld.conditionValue");
  const tCommon = useTranslations("common");

  const [code, setCode] = useState(editing?.code ?? "");
  const [typeCode, setTypeCode] = useState(editing?.typeCode ?? uldTypeInfo[0]?.typeCode ?? "");
  const [serial, setSerial] = useState(editing?.serial ?? "");
  const [ownerCode, setOwnerCode] = useState(editing?.ownerCode ?? "TU");
  const [status, setStatus] = useState(editing?.status ?? "AVAILABLE");
  const [condition, setCondition] = useState(editing?.condition ?? "SERVICEABLE");
  const [baseplateCode, setBaseplateCode] = useState(editing?.baseplateCode ?? "");
  const [assignedStationId, setAssignedStationId] = useState(editing?.assignedStationId ?? stations[0]?.id ?? "");
  const [currentStationId, setCurrentStationId] = useState(editing?.currentStationId ?? stations[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const codeValid = code.length === 0 || isValidUldCode(code);
  const selectedType = useMemo(() => uldTypeInfo.find((u) => u.typeCode === typeCode), [uldTypeInfo, typeCode]);

  if (!open) return null;

  function generateCode() {
    if (typeCode && serial && ownerCode) setCode(buildUldCode(typeCode, serial, ownerCode));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const input: UldFormInput = {
      code,
      typeCode,
      serial: serial || undefined,
      ownerCode: ownerCode || undefined,
      status: status as UldFormInput["status"],
      condition: condition as UldFormInput["condition"],
      baseplateCode: baseplateCode || undefined,
      assignedStationId,
      currentStationId,
    };

    const result = editing ? await updateUld(editing.id, input) : await createUld(input);
    setSaving(false);

    if (!result.ok) {
      setError(result.error ?? "validation");
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg border border-border bg-bg-subtle shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold text-fg">{editing ? t("editUld") : t("addUld")}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-fg-muted hover:bg-bg-muted">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-5">
          {error ? (
            <p className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger" role="alert">
              {tForm(error as never)}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 rounded-md border border-border p-3">
            <span className="text-xs font-semibold uppercase text-fg-subtle">{t("namingConvention")}</span>
            <p className="text-xs text-fg-subtle">{tNaming("description")}</p>
            <div className="flex items-end gap-2">
              <label className={`${labelClass} flex-1`}>
                {t("code")}
                <input
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="PMC12345TU"
                  className={inputClass}
                />
              </label>
              <button
                type="button"
                onClick={generateCode}
                title={tNaming("generate")}
                className="inline-flex h-11 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-fg hover:bg-bg-muted sm:h-9"
              >
                <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
                {tNaming("generate")}
              </button>
            </div>
            {code.length > 0 ? (
              <p className={codeValid ? "text-xs text-success" : "text-xs text-danger"}>
                {codeValid ? tNaming("valid") : tForm("invalidCode")}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              {t("typeCode")}
              <input
                required
                value={typeCode}
                onChange={(e) => setTypeCode(e.target.value.toUpperCase())}
                list="uld-type-codes"
                className={inputClass}
              />
              <datalist id="uld-type-codes">
                {uldTypeInfo.map((u) => (
                  <option key={u.typeCode} value={u.typeCode} />
                ))}
              </datalist>
            </label>
            <label className={labelClass}>
              {t("serialNumber")}
              <input value={serial} onChange={(e) => setSerial(e.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              {t("ownerCode")}
              <input
                value={ownerCode}
                onChange={(e) => setOwnerCode(e.target.value.toUpperCase())}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              {t("baseplateCode")}
              <input value={baseplateCode} onChange={(e) => setBaseplateCode(e.target.value)} className={inputClass} />
            </label>
          </div>

          {selectedType ? (
            <p className="text-xs text-fg-subtle">
              {selectedType.deck} — tare {selectedType.tareWeight} kg, gross {selectedType.grossWeight} kg, vol{" "}
              {selectedType.volume} m³
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              {tCommon("status")}
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
                {ULD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {tStatus(s.toLowerCase() as never)}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              {t("condition")}
              <select value={condition} onChange={(e) => setCondition(e.target.value)} className={inputClass}>
                {ULD_CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {tCondition(c.toLowerCase() as never)}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              {t("assignedStation")}
              <select
                required
                value={assignedStationId}
                onChange={(e) => setAssignedStationId(e.target.value)}
                className={inputClass}
              >
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.iata} — {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              {t("currentStation")}
              <select
                required
                value={currentStationId}
                onChange={(e) => setCurrentStationId(e.target.value)}
                className={inputClass}
              >
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.iata} — {s.name}
                  </option>
                ))}
              </select>
            </label>
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
              disabled={saving || !codeValid}
              className="h-11 rounded-md bg-brand-500 px-4 text-sm font-semibold text-fg-on-brand disabled:opacity-50 sm:h-9"
            >
              {tCommon("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
