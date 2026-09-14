"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Info } from "lucide-react";
import type { LiveWnbResult } from "@/lib/load-plan-calc";
import { formatWeight } from "@/lib/format-number";

/**
 * Everything that would stop this plan being saved, in one place.
 *
 * The checks already appear where they belong — an overloaded cell is red in
 * the workspace, an out-of-envelope CG is red in the CG panel — but a
 * controller finishing a plan needs one answer to one question: *can I
 * finalize?* Hunting for it across five panels is how a blocker gets missed.
 *
 * Entries are the same rules the server enforces (`load-plan-contract.ts`),
 * derived from the same live result the panels use, so the list cannot say
 * "clear" while the save action refuses. It is a mirror, not a second
 * opinion: the server re-derives all of it and its answer is the one that
 * counts.
 *
 * Three severities, because they are three different actions:
 *   * **blocking** — the save will be refused. Fix it.
 *   * **warning** — allowed, but someone should have looked. Asymmetry, a
 *     check that could not run.
 *   * **info** — a check that is unavailable because the approved AHM data
 *     for it is not in hand. Nothing to fix on this flight.
 */

type Severity = "blocking" | "warning" | "info";

interface LogEntry {
  id: string;
  severity: Severity;
  message: string;
}

const SEVERITY_ORDER: Severity[] = ["blocking", "warning", "info"];

export function ErrorLog({ result }: { result: LiveWnbResult }) {
  const t = useTranslations("loadPlan.errorLog");
  const tTables = useTranslations("loadPlan.tables");
  const [collapsed, setCollapsed] = useState(false);

  const entries = collectEntries(result, { t, tTables });
  const blocking = entries.filter((e) => e.severity === "blocking");

  return (
    <section className="rounded-lg border border-border bg-bg-subtle">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2">
          {collapsed ? (
            <ChevronRight className="h-4 w-4 text-fg-muted" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4 text-fg-muted" aria-hidden="true" />
          )}
          <span className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">{t("title")}</span>
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            blocking.length > 0 ? "bg-danger-bg text-danger" : "bg-success-bg text-success"
          }`}
        >
          {blocking.length > 0 ? t("blockingCount", { count: blocking.length }) : t("clear")}
        </span>
      </button>

      {collapsed ? null : (
        <div className="border-t border-border px-4 py-3">
          {entries.length === 0 ? (
            <p className="flex items-center gap-1.5 text-xs text-success">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              {t("nothingToReport")}
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-start gap-2 text-xs leading-relaxed">
                  <EntryIcon severity={entry.severity} />
                  <span className={entry.severity === "blocking" ? "text-danger" : "text-fg-muted"}>
                    {entry.message}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function EntryIcon({ severity }: { severity: Severity }) {
  if (severity === "blocking") {
    return <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" aria-hidden="true" />;
  }
  if (severity === "warning") {
    return <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />;
  }
  return <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-subtle" aria-hidden="true" />;
}

type Translator = (key: string, values?: Record<string, string | number>) => string;

function collectEntries(
  result: LiveWnbResult,
  { t, tTables }: { t: Translator; tTables: Translator },
): LogEntry[] {
  const entries: LogEntry[] = [];

  if (!result.dowDoi.available) {
    entries.push({ id: "dowDoi", severity: "blocking", message: t("crewNotSet") });
  }

  if (result.blockingError) {
    entries.push({
      id: "calculation",
      severity: "blocking",
      message: t("calculationFailed", { detail: result.blockingError.message }),
    });
  }

  for (const overload of result.positionOverloads) {
    entries.push({
      id: `overload-${overload.position}`,
      severity: "blocking",
      message: t("positionOverload", {
        position: overload.position,
        actual: formatWeight(overload.actual),
        max: formatWeight(overload.max),
      }),
    });
  }

  for (const conflict of result.positionConflicts) {
    entries.push({
      id: `conflict-${conflict.a}-${conflict.b}`,
      severity: "blocking",
      message: conflict.reason,
    });
  }

  for (const compartment of result.compartments) {
    if (compartment.withinLimit) continue;
    entries.push({
      id: `compartment-${compartment.target}`,
      severity: "blocking",
      message: t("compartmentExceeded", {
        target: compartment.target,
        actual: formatWeight(compartment.actual),
        max: formatWeight(compartment.max),
      }),
    });
  }

  if (result.envelope) {
    for (const phase of ["zfw", "tow", "ldw"] as const) {
      const check = result.envelope[phase];
      if (check.withinEnvelope) continue;
      entries.push({
        id: `envelope-${phase}`,
        severity: "blocking",
        message: t("outOfEnvelope", { phase: check.phase }),
      });
    }
    if (result.envelope.landingIsApproximate) {
      // A permanent property of this aircraft's AHM, not something wrong with
      // this flight: no landing CG table is published, so the ZFW envelope
      // stands in (GROUND_TRUTH §21 Q3). It is stated on every plan, so it
      // reads as a note rather than as a warning to act on.
      entries.push({ id: "landingApprox", severity: "info", message: t("landingApproximate") });
    }
  }

  if (result.combinedLoad.available) {
    for (const zone of result.combinedLoad.check.zones) {
      if (zone.withinLimit) continue;
      entries.push({
        id: `combined-${zone.zone}`,
        severity: "blocking",
        message: t("combinedLoadExceeded", {
          zone: zone.zone,
          actual: formatWeight(zone.cumulativeLoad),
          max: zone.limit ? formatWeight(zone.limit) : "—",
        }),
      });
    }
  } else {
    entries.push({
      id: "combinedUnavailable",
      // Same reason as the lateral entry: a check this AHM revision cannot
      // run is a note about the data, not a fault in the load.
      severity: "info",
      message: t("combinedLoadUnavailable", { reason: result.combinedLoad.reason }),
    });
  }

  if (result.lateralImbalance.status === "NOT_AVAILABLE") {
    // Not a fault of this flight: the fuel half of AHM 560's lateral table is
    // still untranscribed (AHM560_ERRATA.md Kayıt 10). Stated only when the
    // flight actually carries side-by-side load, which is what the check
    // would have looked at.
    if ((result.lateralImbalance.payloadRows?.length ?? 0) > 0) {
      entries.push({ id: "lateral", severity: "info", message: tTables("lateralImbalanceUnavailable") });
    }
  } else if (result.lateralImbalance.status === "EXCEEDED") {
    entries.push({ id: "lateral", severity: "blocking", message: result.lateralImbalance.detail });
  }

  // Sorted so the things that stop a save are always at the top, whatever
  // order the checks happen to run in.
  return entries.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
}
