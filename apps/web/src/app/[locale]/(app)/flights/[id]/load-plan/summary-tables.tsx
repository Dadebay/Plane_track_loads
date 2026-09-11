"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { LiveWnbResult } from "@/lib/load-plan-calc";
import { formatIndex, formatWeight } from "@/lib/format-number";

/**
 * The full check tables, not only the violation messages.
 *
 * The brief's point: a controller has to be able to see how much margin is
 * left on a zone before it fails, not just be told after it has. So every
 * row renders whether or not it passes, with its actual and its limit side
 * by side.
 *
 * Wide tables scroll inside their own container so a 375 px phone never
 * scrolls the page body sideways.
 */

function Pass({ ok }: { ok: boolean }) {
  const t = useTranslations("loadPlan.tables");
  return (
    <span className={ok ? "flex items-center gap-1 text-success" : "flex items-center gap-1 text-danger"}>
      {ok ? (
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {t(ok ? "pass" : "fail")}
    </span>
  );
}

function Table({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">{caption}</h3>
      <div className="-mx-1 overflow-x-auto px-1">{children}</div>
    </div>
  );
}

const th = "whitespace-nowrap px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-fg-subtle";
const td = "whitespace-nowrap px-2 py-1 font-mono text-xs tabular-nums text-fg";

export function SummaryTables({ result }: { result: LiveWnbResult }) {
  const t = useTranslations("loadPlan.tables");

  return (
    <div className="flex flex-col gap-3">
      {result.positionConflicts.length > 0 ? (
        <Table caption={t("conflicts")}>
          <ul className="flex flex-col gap-1">
            {result.positionConflicts.map((conflict) => (
              <li key={`${conflict.a}|${conflict.b}`} className="flex items-start gap-1.5 text-xs text-danger">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="font-mono">
                  {conflict.a.split("/")[1]} ↔ {conflict.b.split("/")[1]}
                </span>
                <span className="text-fg-subtle">{t("overlapMetres", { metres: conflict.overlap })}</span>
              </li>
            ))}
          </ul>
        </Table>
      ) : null}

      <Table caption={t("positionIndex")}>
        <table className="w-full min-w-max border-collapse">
          <thead>
            <tr>
              <th className={th}>{t("position")}</th>
              <th className={th}>{t("weight")}</th>
              <th className={th}>{t("indexUnits")}</th>
            </tr>
          </thead>
          <tbody>
            {result.positionIndexes.rows.length === 0 ? (
              <tr>
                <td className={`${td} text-fg-subtle`} colSpan={3}>
                  {t("noLoad")}
                </td>
              </tr>
            ) : (
              result.positionIndexes.rows.map((row) => (
                <tr key={row.position} className="border-t border-border">
                  <td className={td}>{row.position}</td>
                  <td className={td}>{formatWeight(row.weight)}</td>
                  <td className={td}>{formatIndex(row.index)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border">
              <td className={`${td} font-semibold`}>{t("total")}</td>
              <td className={`${td} font-semibold`}>{formatWeight(result.positionIndexes.totalWeight)}</td>
              <td className={`${td} font-semibold`}>{formatIndex(result.positionIndexes.totalIndex)}</td>
            </tr>
          </tfoot>
        </table>
      </Table>

      {result.combinedLoad.available ? (
        <Table caption={t("combinedLoad")}>
          <table className="w-full min-w-max border-collapse">
            <caption className="sr-only">{t("combinedLoadCaption", { band: result.combinedLoad.check.band })}</caption>
            <thead>
              <tr>
                <th className={th}>{t("zone")}</th>
                <th className={th}>{t("cumulativeLoad")}</th>
                <th className={th}>{t("maxCumulative")}</th>
                <th className={th}>{t("margin")}</th>
                <th className={th}>{t("result")}</th>
              </tr>
            </thead>
            <tbody>
              {result.combinedLoad.check.zones.map((zone) => (
                <tr key={zone.zone} className="border-t border-border">
                  <td className={td}>{zone.zone}</td>
                  <td className={td}>{formatWeight(zone.cumulativeLoad)}</td>
                  <td className={td}>{zone.limit === null ? "—" : formatWeight(zone.limit)}</td>
                  <td className={td}>
                    {zone.limit === null
                      ? "—"
                      : formatWeight(String(Number(zone.limit) - Number(zone.cumulativeLoad)))}
                  </td>
                  <td className={`${td} font-sans`}>
                    {zone.limit === null ? <span className="text-fg-subtle">—</span> : <Pass ok={zone.withinLimit} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Table>
      ) : (
        <Table caption={t("combinedLoad")}>
          <p className="px-1 text-xs text-fg-subtle">{result.combinedLoad.reason}</p>
        </Table>
      )}

      <Table caption={t("compartments")}>
        <table className="w-full min-w-max border-collapse">
          <thead>
            <tr>
              <th className={th}>{t("compartment")}</th>
              <th className={th}>{t("actual")}</th>
              <th className={th}>{t("max")}</th>
              <th className={th}>{t("result")}</th>
            </tr>
          </thead>
          <tbody>
            {result.compartments.map((check) => (
              <tr key={check.target} className="border-t border-border">
                <td className={`${td} font-sans`}>{check.target}</td>
                <td className={td}>{formatWeight(check.actual)}</td>
                <td className={td}>{formatWeight(check.max)}</td>
                <td className={`${td} font-sans`}>
                  <Pass ok={check.withinLimit} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Table>

      <LateralImbalanceTable result={result} />
    </div>
  );
}

function LateralImbalanceTable({ result }: { result: LiveWnbResult }) {
  const t = useTranslations("loadPlan.tables");
  const check = result.lateralImbalance;

  const rows = check.status === "NOT_AVAILABLE" ? (check.payloadRows ?? []) : check.payloadRows;

  return (
    <Table caption={t("lateralImbalance")}>
      {check.status === "NOT_AVAILABLE" ? (
        <p className="mb-1.5 flex items-start gap-1.5 px-1 text-xs text-fg-subtle">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {t("lateralProvisional")}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="px-1 text-xs text-fg-subtle">{t("noSideBySide")}</p>
      ) : (
        <table className="w-full min-w-max border-collapse">
          <thead>
            <tr>
              <th className={th}>{t("category")}</th>
              <th className={th}>{t("left")}</th>
              <th className={th}>{t("right")}</th>
              <th className={th}>{t("difference")}</th>
              <th className={th}>{t("yArm")}</th>
              <th className={th}>{t("moment")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.category} className="border-t border-border">
                <td className={`${td} font-sans`}>{t(`sbs.${row.category}` as never)}</td>
                <td className={td}>{formatWeight(row.leftWeight)}</td>
                <td className={td}>{formatWeight(row.rightWeight)}</td>
                <td className={td}>{formatWeight(row.difference)}</td>
                <td className={td}>{row.yArm}</td>
                <td className={td}>{formatWeight(row.moment)}</td>
              </tr>
            ))}
          </tbody>
          {check.status !== "NOT_AVAILABLE" ? (
            <tfoot>
              <tr className="border-t-2 border-border">
                <td className={`${td} font-semibold`} colSpan={5}>
                  {t("totalWithMargin")}
                </td>
                <td className={`${td} font-semibold`}>{formatWeight(check.totalWithMargin)}</td>
              </tr>
              <tr>
                <td className={`${td} text-fg-subtle`} colSpan={5}>
                  {t("limit")}
                </td>
                <td className={`${td} text-fg-subtle`}>± {formatWeight(check.limit)}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      )}
    </Table>
  );
}
