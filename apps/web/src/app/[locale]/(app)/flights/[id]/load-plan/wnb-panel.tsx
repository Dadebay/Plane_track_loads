"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { LiveWnbResult } from "@/lib/load-plan-calc";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-border bg-bg-subtle p-2.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle">{label}</span>
      <span className="font-mono text-sm font-semibold text-fg">{value}</span>
    </div>
  );
}

export function WnbPanel({ result }: { result: LiveWnbResult }) {
  const t = useTranslations("loadPlan.panel");
  const tViolations = useTranslations("loadPlan.violations");
  const tCrew = useTranslations("loadPlan.crew");
  const tWnb = useTranslations("wnb");

  if (result.blockingError) {
    const message =
      result.blockingError.code === "DOW_DOI_NOT_FOUND" && result.blockingError.message === "crewNotSet"
        ? tCrew("notSet")
        : result.blockingError.code === "ENVELOPE_RANGE"
          ? t("notEnoughLoad")
          : result.blockingError.message;
    return (
      <div className="flex items-start gap-2 rounded-lg border border-danger bg-danger-bg p-4 text-sm text-danger">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{message}</span>
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
  for (const phase of ["zfw", "tow", "ldw"] as const) {
    const check = envelope[phase];
    if (!check.withinEnvelope) {
      violations.push(`${phase.toUpperCase()}: ${tWnb("errors.cgOutOfEnvelope")}`);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        <Metric label={tWnb("ttl")} value={wnb.ttl} />
        <Metric label={tWnb("zfw")} value={wnb.zfw} />
        <Metric label={tWnb("tow")} value={wnb.tow} />
        <Metric label={tWnb("ldw")} value={wnb.ldw} />
        <Metric label={tWnb("dow")} value={wnb.dow} />
        <Metric label={tWnb("doi")} value={wnb.doi} />
        <Metric label={tWnb("maczfw")} value={wnb.maczfw} />
        <Metric label={tWnb("mactow")} value={wnb.mactow} />
        <Metric label={tWnb("maclaw")} value={wnb.maclaw} />
        <Metric label={tWnb("stab")} value={`${wnb.stab.value} ${wnb.stab.direction}`} />
        <Metric label={tWnb("underload")} value={wnb.underloadBeforeLmc} />
        <Metric label={tWnb("taxiWeight")} value={wnb.taxiWeight} />
      </div>

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
