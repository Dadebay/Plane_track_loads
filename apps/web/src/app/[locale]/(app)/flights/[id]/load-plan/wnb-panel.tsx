"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { CgLimits } from "@tua/wnb-core";
import type { LiveWnbResult } from "@/lib/load-plan-calc";
import { formatIndex, formatWeight } from "@/lib/format-number";
import { CgEnvelopeChart } from "./cg-envelope-chart";
import { SummaryTables } from "./summary-tables";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-border bg-bg-subtle p-2.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle">{label}</span>
      <span className="font-mono text-sm font-semibold text-fg">{value}</span>
    </div>
  );
}

export function WnbPanel({ result, cgLimits }: { result: LiveWnbResult; cgLimits: CgLimits }) {
  const t = useTranslations("loadPlan.panel");
  const tViolations = useTranslations("loadPlan.violations");
  const tCrew = useTranslations("loadPlan.crew");
  const tWnb = useTranslations("wnb");
  const tSidebar = useTranslations("loadPlan.sidebar");

  // The load index total is the on-screen equivalent of the INX row the
  // loadmaster totals by hand from the printed card, and it is meaningful
  // before DOW/DOI is known — so it renders above (and independently of)
  // the blocking-error branch below.
  const indexSummary = (
    <div className="grid grid-cols-2 gap-2">
      <Metric label={t("totalTrafficLoad")} value={formatWeight(result.positionIndexes.totalWeight)} />
      <Metric label={t("loadIndex")} value={formatIndex(result.positionIndexes.totalIndex)} />
    </div>
  );

  // Same reasoning as indexSummary: the card comparison depends only on the
  // load, so it stays visible while DOW/DOI or the envelope is still blocked.
  const indexCard =
    result.cardIndexRows.length > 0 ? (
      <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">{t("indexCard")}</h3>
        {/* The exact figure next to the number the loadmaster would read
            off the laminated card. The card rounds to whole units over a
            500 kg bracket, so small differences are expected; only a gap
            past that resolution is flagged. */}
        <p className="text-xs text-fg-subtle">{t("indexCardNote")}</p>
        <ul className="flex flex-col gap-1">
          {result.cardIndexRows.map((row) => (
            <li key={row.zone} className="flex items-center justify-between gap-2 text-sm">
              <span className="font-mono font-medium text-fg">{row.zone}</span>
              <span className="flex gap-3 font-mono tabular-nums">
                <span className="text-fg-muted">{formatWeight(row.weight)}</span>
                <span className="text-fg">{formatIndex(row.computed)}</span>
                <span className={row.disagrees ? "text-danger" : "text-fg-subtle"}>
                  {row.printed === null ? "—" : formatIndex(row.printed)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  if (result.blockingError) {
    // The engine speaks English by design (@tua/wnb-core has no i18n and
    // never will — CLAUDE.md rule #1). A ramp crew working in Turkmen was
    // seeing that raw sentence, so every rule the engine can block on gets
    // a translated instruction here, and the engine's own wording stays
    // underneath it for the checker and the log. An unmapped code still
    // shows the raw message rather than a vague "something went wrong".
    const translated =
      result.blockingError.code === "DOW_DOI_NOT_FOUND" && result.blockingError.message === "crewNotSet"
        ? tCrew("notSet")
        : result.blockingError.code === "ENVELOPE_RANGE"
          ? t("notEnoughLoad")
          : result.blockingError.code === "ZFCG_OUT_OF_RANGE"
            ? t("zfcgOutOfRange")
            : null;
    const detail = translated === null ? null : result.blockingError.message;

    return (
      <div className="flex flex-col gap-4">
        {indexSummary}
        {indexCard}
        <div className="flex items-start gap-2 rounded-lg border border-danger bg-danger-bg p-4 text-sm text-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <span>{translated ?? result.blockingError.message}</span>
            {detail !== null && detail !== translated ? (
              <span className="text-[11px] text-fg-muted">
                {t("engineErrorDetail")} <span className="font-mono">{detail}</span>
              </span>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const { wnb, envelope } = result;
  if (!wnb || !envelope) return null;

  const violations: string[] = [];
  for (const overload of result.positionOverloads) {
    violations.push(tViolations("positionOverload", { position: overload.position, actual: overload.actual, max: overload.max }));
  }
  for (const compartment of result.compartments) {
    if (!compartment.withinLimit) {
      violations.push(tViolations("compartmentExceeded", { target: compartment.target, actual: compartment.actual, max: compartment.max }));
    }
  }
  if (result.combinedLoad.available) {
    for (const zone of result.combinedLoad.check.zones) {
      if (!zone.withinLimit) {
        violations.push(tViolations("combinedLoadExceeded", { zone: zone.zone, load: zone.cumulativeLoad, max: zone.limit ?? "" }));
      }
    }
  } else {
    violations.push(tViolations("combinedLoadUnavailable", { reason: result.combinedLoad.reason }));
  }
  if (result.lateralImbalance.status === "NOT_AVAILABLE") {
    violations.push(tViolations("lateralImbalanceUnavailable"));
  } else if (result.lateralImbalance.status === "EXCEEDED") {
    violations.push(result.lateralImbalance.detail);
  }
  for (const row of result.cardIndexRows) {
    if (row.disagrees) {
      violations.push(
        tViolations("indexCardMismatch", {
          zone: row.zone,
          computed: row.computed,
          printed: row.printed ?? "",
        }),
      );
    }
  }
  for (const phase of ["zfw", "tow", "ldw"] as const) {
    const check = envelope[phase];
    if (!check.withinEnvelope) {
      violations.push(`${phase.toUpperCase()}: ${tWnb("errors.cgOutOfEnvelope")}`);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {indexSummary}

      {indexCard}

      {/* Envelope status, the chart and the numeric CG range side by side —
          the three ways a controller checks the same thing: one row on a
          wide screen, stacked on a phone. */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">{t("envelope")}</h3>
          {(["zfw", "tow", "ldw"] as const).map((phase) => {
            const check = envelope[phase];
            return (
              <div key={phase} className="flex items-center justify-between text-sm">
                <span className="font-mono font-medium text-fg">{phase.toUpperCase()}</span>
                <span className={check.withinEnvelope ? "flex items-center gap-1 text-success" : "flex items-center gap-1 text-danger"}>
                  {check.withinEnvelope ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
                  {check.withinEnvelope ? t("withinEnvelope") : t("outsideEnvelope")}
                </span>
              </div>
            );
          })}
          {envelope.landingIsApproximate ? <p className="text-xs text-fg-subtle">{t("landingApproximate")}</p> : null}
        </div>

        <CgEnvelopeChart
          cgLimits={cgLimits}
          wnb={wnb}
          phases={{
            zfw: envelope.zfw.withinEnvelope,
            tow: envelope.tow.withinEnvelope,
            ldw: envelope.ldw.withinEnvelope,
          }}
        />

        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">{tSidebar("cgRange")}</h3>
          {(["zfw", "tow", "ldw"] as const).map((phase) => {
            const check = envelope[phase];
            const actual = phase === "zfw" ? wnb.lizfw : phase === "tow" ? wnb.litow : wnb.lilaw;
            return (
              <div key={phase} className="flex flex-col gap-0.5">
                <span className="font-mono text-xs font-semibold text-fg">{phase.toUpperCase()}</span>
                <div className="flex items-center justify-between gap-2 text-[11px] text-fg-subtle">
                  <span>{tSidebar("forwardLimit")}</span>
                  <span className="font-mono tabular-nums text-fg-muted">{formatIndex(check.forwardLimit)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-fg-subtle">{tSidebar("actualIndex")}</span>
                  <span className={`font-mono font-semibold tabular-nums ${check.withinEnvelope ? "text-success" : "text-danger"}`}>
                    {formatIndex(actual)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-[11px] text-fg-subtle">
                  <span>{tSidebar("aftLimit")}</span>
                  <span className="font-mono tabular-nums text-fg-muted">{formatIndex(check.aftLimit)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <SummaryTables result={result} />

      <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">{tViolations("title")}</h3>
        {violations.length === 0 ? (
          <p className="flex items-center gap-1.5 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {tViolations("none")}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {violations.map((v, i) => (
              <li key={i} className="flex items-start gap-1.5 text-sm text-danger">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {v}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
