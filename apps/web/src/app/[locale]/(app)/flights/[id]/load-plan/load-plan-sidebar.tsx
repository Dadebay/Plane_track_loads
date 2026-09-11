"use client";

import { useTranslations } from "next-intl";
import { Fuel, Scale } from "lucide-react";
import { Decimal } from "decimal.js";
import type { LiveWnbResult } from "@/lib/load-plan-calc";
import { useLoadDraftStore } from "./load-draft-store";
import { formatIndex, formatWeight } from "@/lib/format-number";

/**
 * The flight's figures, in one left-hand rail.
 *
 * The operator's reference system keeps every number on the left and gives
 * the whole right-hand side to the aircraft, so a controller reads weights
 * and CG in a fixed place while the deck scrolls. This rail is that
 * column: it renders values, it never computes weight & balance — every
 * figure comes from `useLiveWnb()`'s server-shaped result, which is
 * @tua/wnb-core's output (CLAUDE.md rule #1).
 *
 * The two totals it does derive — max payload and the loaded ULD tare/net
 * sums — are Decimal, never float (rule #2), and are plain sums of values
 * the engine already produced, not new AHM arithmetic.
 */

function Row({ label, value, tone }: { label: string; value: string; tone?: "ok" | "danger" }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1">
      <span className="text-[11px] leading-tight text-fg-subtle">{label}</span>
      <span
        className={`shrink-0 rounded-sm px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums ${
          tone === "danger"
            ? "bg-danger-bg text-danger"
            : tone === "ok"
              ? "bg-success-bg text-success"
              : "bg-bg-subtle text-fg"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * One boxed block of figures.
 *
 * The groups are what a controller navigates by — "what is the take-off
 * weight" is a question about a block, not about a list of forty rows. A
 * shared underline was not enough separation once the panel got long, so
 * each block is its own card with a filled header, the way the crew's
 * current sheet prints them.
 */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-bg">
      <h3 className="bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-50">
        {title}
      </h3>
      <div className="divide-y divide-border/60 px-2.5 py-1">{children}</div>
    </section>
  );
}

export function LoadPlanSidebar({
  result,
  flightNo,
  registration,
  fromIata,
  toIata,
  date,
  time,
  mzfw,
  onOpenFuel,
  onOpenDow,
}: {
  result: LiveWnbResult;
  flightNo: string;
  registration: string;
  fromIata: string;
  toIata: string;
  /** Pre-formatted by the shell, which owns the Local/UTC switch. */
  date: string;
  time: string;
  mzfw: string;
  /** Opens the tank-by-tank distribution. The rail is where a controller
   * already reads the fuel figures, so it is where they reach for them. */
  onOpenFuel: () => void;
  /** Opens the DOW/DOI breakdown. */
  onOpenDow: () => void;
}) {
  const t = useTranslations("loadPlan.sidebar");
  const tWnb = useTranslations("wnb");
  const tCrew = useTranslations("loadPlan.crew");
  const tTables = useTranslations("loadPlan.tables");
  const tFuelModal = useTranslations("loadPlan.fuelModal");
  const tDowModal = useTranslations("loadPlan.dowModal");
  const items = useLoadDraftStore((s) => s.items);
  const cockpitCrew = useLoadDraftStore((s) => s.cockpitCrew);
  const courierCrew = useLoadDraftStore((s) => s.courierCrew);

  const { wnb } = result;
  const dash = "—";

  const sum = (pick: (item: (typeof items)[number]) => string | undefined) =>
    items.reduce((total, item) => total.plus(new Decimal(pick(item) ?? "0")), new Decimal(0)).toString();

  const tareTotal = sum((i) => i.tareWeight);
  const netTotal = sum((i) => i.netWeight);
  const grossTotal = sum((i) => i.weight);

  // MZFW minus this aircraft's dry operating weight — the payload ceiling
  // before any fuel figure is known. Shown only once DOW exists.
  const maxPayload = wnb ? new Decimal(mzfw).minus(new Decimal(wnb.dow)).toString() : null;

  const lateral = result.lateralImbalance;

  return (
    <aside className="flex flex-col gap-2.5 rounded-xl border border-border bg-bg-subtle p-2.5 shadow-sm">
      <h2 className="px-1 text-sm font-semibold text-fg">{t("title")}</h2>

      <Group title={t("flightDetails")}>
        <Row label={t("date")} value={date} />
        <Row label={t("time")} value={time} />
        <Row label={t("station")} value={fromIata} />
        <Row label={t("flightNumber")} value={flightNo} />
        <Row label={t("departurePort")} value={fromIata} />
        <Row label={t("arrivalPort")} value={toIata} />
      </Group>

      <Group title={t("flightSummary")}>
        <Row label={t("aircraftReg")} value={registration} />
        <Row
          label={t("crewCode")}
          value={cockpitCrew === null || courierCrew === null ? dash : `${cockpitCrew}/${courierCrew}`}
        />
        <Row label={tWnb("dow")} value={wnb ? formatWeight(wnb.dow) : dash} />
        <Row label={tWnb("doi")} value={wnb ? formatIndex(wnb.doi) : dash} />
      </Group>

      <button
        type="button"
        onClick={onOpenDow}
        className="flex h-11 w-full items-center justify-center gap-1.5 rounded-md border border-border px-3 text-xs font-semibold text-fg hover:bg-bg-muted sm:h-9"
      >
        <Scale className="h-4 w-4" aria-hidden="true" />
        {tDowModal("open")}
      </button>

      <Group title={t("zeroFuel")}>
        <Row label={tWnb("zfw")} value={wnb ? formatWeight(wnb.zfw) : dash} />
        <Row label={tWnb("lizfw")} value={wnb ? formatIndex(wnb.lizfw) : dash} />
      </Group>

      <button
        type="button"
        onClick={onOpenFuel}
        className="flex h-11 w-full items-center justify-center gap-1.5 rounded-md bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700 sm:h-9"
      >
        <Fuel className="h-4 w-4" aria-hidden="true" />
        {tFuelModal("open")}
      </button>

      <Group title={t("takeOff")}>
        <Row label={tWnb("tow")} value={wnb ? formatWeight(wnb.tow) : dash} />
        <Row label={tWnb("litow")} value={wnb ? formatIndex(wnb.litow) : dash} />
        <Row label={tWnb("taxiWeight")} value={wnb ? formatWeight(wnb.taxiWeight) : dash} />
      </Group>

      <Group title={t("landing")}>
        <Row label={tWnb("ldw")} value={wnb ? formatWeight(wnb.ldw) : dash} />
        <Row label={tWnb("lilaw")} value={wnb ? formatIndex(wnb.lilaw) : dash} />
      </Group>

      <Group title={t("cgTrim")}>
        <Row label={tWnb("maczfw")} value={wnb ? formatIndex(wnb.maczfw) : dash} />
        <Row label={tWnb("mactow")} value={wnb ? formatIndex(wnb.mactow) : dash} />
        <Row label={tWnb("maclaw")} value={wnb ? formatIndex(wnb.maclaw) : dash} />
        <Row label={tWnb("stab")} value={wnb ? `${wnb.stab.value} ${wnb.stab.direction}` : dash} />
      </Group>

      <Group title={t("payload")}>
        <Row label={t("maxPayload")} value={maxPayload === null ? dash : formatWeight(maxPayload)} />
        <Row label={t("actualPayload")} value={formatWeight(result.positionIndexes.totalWeight)} />
        <Row label={tWnb("underload")} value={wnb ? formatWeight(wnb.underloadBeforeLmc) : dash} />
      </Group>

      <Group title={t("lateralImbalance")}>
        {/* The fuel half of AHM 560's lateral table is still untranscribed
            (AHM560_ERRATA.md Kayıt 10), so this reads "not available"
            rather than showing a payload-only figure as if it were the
            check. */}
        {lateral.status === "NOT_AVAILABLE" ? (
          <Row label={tTables("lateralImbalance")} value={t("notAvailable")} />
        ) : (
          <>
            <Row label={tTables("totalWithMargin")} value={formatIndex(lateral.totalWithMargin)} />
            <Row
              label={tTables("limit")}
              value={formatIndex(lateral.limit)}
              tone={lateral.status === "EXCEEDED" ? "danger" : "ok"}
            />
          </>
        )}
      </Group>

      <Group title={t("uldSummary")}>
        <Row label={t("loadedTare")} value={formatWeight(tareTotal)} />
        <Row label={t("loadedNet")} value={formatWeight(netTotal)} />
        <Row label={t("loadedGross")} value={formatWeight(grossTotal)} />
      </Group>

      {wnb === null ? <p className="text-[11px] text-fg-subtle">{tCrew("notSet")}</p> : null}
    </aside>
  );
}
