"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { DatePicker, PageHeader } from "@tua/ui";
import { useRouter } from "@/i18n/navigation";

const FILES = [
  { key: "aircraft", filename: "aircraft.json" },
  { key: "indexFormula", filename: "index-formula.json" },
  { key: "dowDoiMatrix", filename: "dow-doi-matrix.json" },
  { key: "fuelIndex", filename: "fuel-index.json" },
  { key: "cgLimits", filename: "cg-limits.json" },
  { key: "compartments", filename: "compartments.json" },
  { key: "positions", filename: "positions.json" },
  { key: "combinedLoad", filename: "combined-load.json" },
  { key: "zoneMapping", filename: "zone-mapping.json" },
  { key: "uldTypes", filename: "uld-types.json" },
  { key: "crewIndex", filename: "crew-index.json" },
] as const;

interface FileValidationResult {
  key: string;
  filename: string;
  ok: boolean;
  error?: string;
  summary?: string;
}

const inputClass = "h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg";
const labelClass = "flex flex-col gap-1 text-xs font-medium text-fg-muted";

export function AhmUploadView() {
  const t = useTranslations("admin.ahm.upload");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const [results, setResults] = useState<FileValidationResult[] | null>(null);
  const [validated, setValidated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  const [effectiveDate, setEffectiveDate] = useState("");

  async function handleValidate() {
    if (!formRef.current) return;
    setBusy(true);
    setTopError(null);
    try {
      const formData = new FormData(formRef.current);
      const res = await fetch("/api/admin/ahm/validate", { method: "POST", body: formData });
      const body = (await res.json()) as { results: FileValidationResult[]; allOk: boolean };
      setResults(body.results);
      setValidated(body.allOk);
    } catch {
      setTopError(t("validationErrors"));
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    if (!formRef.current) return;
    setBusy(true);
    setTopError(null);
    try {
      const formData = new FormData(formRef.current);
      const res = await fetch("/api/admin/ahm/confirm", { method: "POST", body: formData });
      if (res.status === 409) {
        setTopError(t("alreadyExists"));
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { results?: FileValidationResult[] } | null;
        if (body?.results) setResults(body.results);
        setValidated(false);
        setTopError(t("validationErrors"));
        return;
      }
      const body = (await res.json()) as { id: string };
      router.push(`/admin/ahm/${body.id}`);
    } catch {
      setTopError(t("validationErrors"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col">
      <PageHeader title={t("title")} />

      <form ref={formRef} className="flex flex-col gap-6 p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className={labelClass}>
            {t("aircraftType")}
            <input name="aircraftType" required className={inputClass} placeholder="a330-243p2f" />
          </label>
          <label className={labelClass}>
            {t("edition")}
            <input name="edition" type="number" min={1} required className={inputClass} placeholder="1" />
          </label>
          <label className={labelClass}>
            {t("revision")}
            <input name="revision" type="number" min={0} required className={inputClass} placeholder="1" />
          </label>
          <label className={labelClass}>
            {t("effectiveDate")}
            <DatePicker
              name="effectiveDate"
              value={effectiveDate}
              onChange={setEffectiveDate}
              required
              locale={locale}
              labels={{ clear: tCommon("clear"), today: tCommon("today") }}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            {t("approvedBy")}
            <input name="approvedBy" required className={inputClass} />
          </label>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">{t("selectFiles")}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FILES.map((f) => (
              <label key={f.key} className={labelClass}>
                {f.filename}
                <input name={f.key} type="file" accept="application/json" required className={inputClass} />
              </label>
            ))}
          </div>
        </div>

        {topError ? (
          <p className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger" role="alert">
            {topError}
          </p>
        ) : null}

        {results ? (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-max border-collapse text-sm">
              <thead>
                <tr className="bg-info text-fg-on-brand">
                  <th className="px-3 py-2 text-left">{tCommon("file")}</th>
                  <th className="px-3 py-2 text-left">{tCommon("status")}</th>
                  <th className="px-3 py-2 text-left">{tCommon("detail")}</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.key} className="border-b border-border">
                    <td className="px-3 py-2">{r.filename}</td>
                    <td className={`px-3 py-2 font-medium ${r.ok ? "text-success" : "text-danger"}`}>
                      {r.ok ? tCommon("ok") : tCommon("error")}
                    </td>
                    <td className="px-3 py-2 text-fg-muted">{r.ok ? r.summary : r.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {validated ? (
              <p className="px-3 py-2 text-sm text-success">{t("validationOk")}</p>
            ) : null}
          </div>
        ) : null}

        <div className="flex gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={handleValidate}
            className="h-10 rounded-md border border-border px-4 text-sm font-medium text-fg hover:bg-bg-muted disabled:opacity-50"
          >
            {t("validate")}
          </button>
          <button
            type="button"
            disabled={busy || !validated}
            onClick={handleConfirm}
            className="h-10 rounded-md bg-brand-500 px-4 text-sm font-medium text-fg-on-brand disabled:opacity-50"
          >
            {t("confirm")}
          </button>
        </div>
      </form>
    </div>
  );
}
