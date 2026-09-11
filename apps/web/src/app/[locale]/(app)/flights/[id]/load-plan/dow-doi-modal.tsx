"use client";

import { useTranslations } from "next-intl";
import { X, AlertTriangle } from "lucide-react";
import { Decimal } from "decimal.js";
import type { DowDoiBreakdown } from "@/lib/load-plan-calc";
import { formatIndex, formatWeight } from "@/lib/format-number";
import { useLoadDraftStore } from "./load-draft-store";

/**
 * Where the flight's DOW and DOI come from — AHM 560 s.6 §III.
 *
 * This is a **breakdown viewer, not a second calculator.** The AHM publishes
 * DOW/DOI as a matrix keyed by crew version, and that matrix is what the
 * loadsheet is computed from. Rebuilding the same number here from basic
 * weight plus components and then using it would be exactly the
 * double-counting the parity brief warns about — the published cell already
 * contains the crew and the fixed stowage items.
 *
 * So the published cell is shown as the authority, and the decomposition is
 * shown underneath as explanation: the printed remark makes each cell
 * decomposable (100 kg per cockpit occupant, 80 kg per courier, baggage
 * included), and stripping the crew off leaves the airframe's basic figure.
 *
 * Two things Aerometa's equivalent screen shows are deliberately absent:
 *
 *   * **document stowage, bag & coat stowage, potable water and waste tank**
 *     as separately armed items — the approved AHM pages we hold publish no
 *     arm for them. Their weight is already inside the published cell; what
 *     is missing is the breakdown, and a made-up arm would be an invented
 *     constant (CLAUDE.md rule #3).
 *   * **an editable basic empty weight** — see the warning below.
 */

export function DowDoiModal({
  open,
  onClose,
  breakdown,
}: {
  open: boolean;
  onClose: () => void;
  breakdown: DowDoiBreakdown;
}) {
  const t = useTranslations("loadPlan.dowModal");
  const tWnb = useTranslations("wnb");
  const tCommon = useTranslations("common");
  const tCrew = useTranslations("loadPlan.crew");

  const cockpitCrew = useLoadDraftStore((s) => s.cockpitCrew);
  const courierCrew = useLoadDraftStore((s) => s.courierCrew);
  const setCrew = useLoadDraftStore((s) => s.setCrew);

  if (!open) return null;

  const crewSet = cockpitCrew !== null && courierCrew !== null;
  const cell = crewSet
    ? breakdown.cells.find((c) => c.cockpitCrew === cockpitCrew && c.courierCrew === courierCrew) ?? null
    : null;

  // The decomposition the printed remark allows. Decimal, not float — this
  // is subtraction on a loadsheet figure (CLAUDE.md rule #2).
  const crewWeight = cell
    ? new Decimal(breakdown.crewWeights.cockpitKg)
        .times(cell.cockpitCrew)
        .plus(new Decimal(breakdown.crewWeights.courierKg).times(cell.courierCrew))
    : null;
  const impliedBasic = cell && crewWeight ? new Decimal(cell.dow).minus(crewWeight) : null;

  // AHM560_ERRATA.md Kayıt 11: the stored BEW is from an earlier weighing
  // than the matrix. Surfaced rather than hidden, because a controller
  // reading both numbers on one screen would otherwise assume they agree.
  const bewGap = impliedBasic ? new Decimal(breakdown.bew).minus(impliedBasic) : null;
  const bewDisagrees = bewGap !== null && !bewGap.isZero();

  const dash = "—";

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
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-bg-subtle shadow-2xl"
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
          {/* The published answer, first and largest — it is the authority. */}
          <section className="rounded-lg border border-brand-600/40 bg-brand-600/5 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
              {t("published")}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Figure label={tWnb("dow")} value={cell ? formatWeight(cell.dow) : dash} large />
              <Figure label={tWnb("doi")} value={cell ? formatIndex(cell.doi) : dash} large />
            </div>
            <p className="mt-3 text-[11px] text-fg-subtle">
              {t("publishedSource", { edition: breakdown.edition, revision: breakdown.revision })}
            </p>
          </section>

          {/* Crew version — the only input, because it is the matrix's key. */}
          <section className="rounded-lg border border-border p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
              {t("crewVersion")}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-fg-muted">
                {tCrew("cockpit")}
                <select
                  value={cockpitCrew ?? ""}
                  onChange={(e) => setCrew(e.target.value ? Number(e.target.value) : null, courierCrew)}
                  className="h-11 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg sm:h-9"
                >
                  <option value="">{dash}</option>
                  {breakdown.cockpitOptions.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-fg-muted">
                {tCrew("courier")}
                <select
                  value={courierCrew ?? ""}
                  onChange={(e) => setCrew(cockpitCrew, e.target.value ? Number(e.target.value) : null)}
                  className="h-11 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg sm:h-9"
                >
                  <option value="">{dash}</option>
                  {breakdown.courierOptions.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="mt-2 text-[11px] text-fg-subtle">
              {t("crewWeights", {
                cockpit: formatWeight(breakdown.crewWeights.cockpitKg),
                courier: formatWeight(breakdown.crewWeights.courierKg),
              })}
            </p>
          </section>

          {/* The decomposition, as explanation. */}
          <section className="rounded-lg border border-border p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
              {t("composition")}
            </h3>
            <dl className="flex flex-col divide-y divide-border">
              <BreakdownRow label={t("impliedBasic")} value={impliedBasic ? formatWeight(impliedBasic.toString()) : dash} />
              <BreakdownRow
                label={t("crewTotal")}
                value={crewWeight ? formatWeight(crewWeight.toString()) : dash}
              />
              <BreakdownRow label={tWnb("dow")} value={cell ? formatWeight(cell.dow) : dash} strong />
            </dl>
            <p className="mt-3 text-[11px] text-fg-subtle">{t("compositionNote")}</p>
          </section>

          {/* Basic weight as published in aircraft.json, with the caveat. */}
          <section className="rounded-lg border border-border p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
              {t("basicWeight")}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Figure label={t("bew")} value={formatWeight(breakdown.bew)} />
              <Figure label={t("bewCg")} value={`${formatWeight(breakdown.bewCgMac)} %MAC`} />
              <Figure label={t("bewIndex")} value={formatIndex(breakdown.bewIndex)} />
            </div>
            {bewDisagrees ? (
              <p className="mt-3 flex items-start gap-1.5 rounded-md border border-warning/40 bg-warning-bg/40 px-3 py-2 text-[11px] text-warning">
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {t("bewDisagrees", { gap: formatWeight(bewGap!.abs().toString()) })}
              </p>
            ) : null}
          </section>

          {/* What the reference screen itemises and we cannot. */}
          <section className="rounded-lg border border-border p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
              {t("fixedItems")}
            </h3>
            <p className="text-[11px] leading-relaxed text-fg-subtle">{t("fixedItemsUnavailable")}</p>
          </section>
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

function Figure({ label, value, large }: { label: string; value: string; large?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-fg-muted">{label}</span>
      <span className={`font-mono tabular-nums text-fg ${large ? "text-xl font-semibold" : "text-sm"}`}>{value}</span>
    </div>
  );
}

function BreakdownRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-2">
      <dt className={`text-xs ${strong ? "font-semibold text-fg" : "text-fg-subtle"}`}>{label}</dt>
      <dd className={`font-mono text-sm tabular-nums ${strong ? "font-semibold text-fg" : "text-fg-muted"}`}>
        {value}
      </dd>
    </div>
  );
}
