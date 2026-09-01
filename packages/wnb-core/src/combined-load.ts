import { Decimal } from "decimal.js";
import { d } from "./decimal-utils";
import { ZfcgOutOfRangeError } from "./errors";
import type { CombinedLoadCheck, CombinedLoadZone, CombinedLoadZoneResult } from "./types";

interface ParsedBand {
  label: string;
  lower: Decimal;
  /** Exclusive upper bound, except for the table's last band which is inclusive. */
  upper: Decimal;
  upperInclusive: boolean;
}

// Band labels look like "24<=ZFCG<24.5" or, for the table's final band,
// "30<=ZFCG<38" (upper bound is inclusive here, since ZFCG=38 has nowhere
// else to go and AHM 560 s.55-56 does not publish a table beyond 38).
const BAND_RE = /^(-?[\d.]+)<=ZFCG<(-?[\d.]+)$/;

function parseBands(limits: Record<string, string>): ParsedBand[] {
  const bands = Object.keys(limits).map((label) => {
    const m = BAND_RE.exec(label);
    if (!m) throw new Error(`combined-load: unrecognized band label "${label}"`);
    return { label, lower: d(m[1]!), upper: d(m[2]!) };
  });
  bands.sort((a, b) => a.lower.comparedTo(b.lower));
  return bands.map((b, i) => ({ ...b, upperInclusive: i === bands.length - 1 }));
}

function findBand(zfcg: Decimal, bands: ParsedBand[]): ParsedBand {
  for (const b of bands) {
    const withinUpper = b.upperInclusive ? zfcg.lte(b.upper) : zfcg.lt(b.upper);
    if (zfcg.gte(b.lower) && withinUpper) return b;
  }
  const first = bands[0];
  const last = bands[bands.length - 1];
  throw new ZfcgOutOfRangeError(
    zfcg.toString() + ` (table covers [${first?.lower.toString()}, ${last?.upper.toString()}])`,
  );
}

/**
 * AHM 560 s.55-56 §9.1 — combined (cumulative) load limitations.
 *
 * `loadByZone` is the *direct* (non-cumulative) load assigned to each zone
 * — i.e. what's physically in that zone, already expanded through
 * `zone-mapping.json`'s long-pallet distribution factors for 16/20ft
 * pallets. This function computes the cumulative sums itself:
 *
 *   - FWD_CANTILEVER zones (ZA-ZE) cumulate nose-to-tail: ZA alone,
 *     ZB = ZA+ZB, ... ZE = ZA+...+ZE.
 *   - AFT_CANTILEVER zones (ZJ-ZU) cumulate tail-to-nose: ZU alone,
 *     ZT = ZU+ZT, ... ZJ = ZU+...+ZJ.
 *
 * (GROUND_TRUTH.md §12, direction confirmed against the Load & Trim
 * Sheet's Cumulative Load columns, AHM 560 s.72 — still flagged for
 * re-verification per GROUND_TRUTH.md §21 Q2.)
 *
 * WING_BOX zones (ZF/ZG/ZH, `limits: null`) are not checked.
 *
 * Reports (never throws for a business-rule violation) so it can drive
 * live UI feedback during load planning — see checkEnvelope's doc comment
 * for the same design rationale.
 */
export function checkCombinedLoad(
  loadByZone: Record<string, string>,
  zfcg: string,
  zones: CombinedLoadZone[],
): CombinedLoadCheck {
  const zfcgDec = d(zfcg);

  const limited = zones.filter((z) => z.limits !== null);
  const first = limited[0];
  if (!first?.limits) {
    throw new Error("checkCombinedLoad: no zone with limits provided");
  }
  const bands = parseBands(first.limits);
  const band = findBand(zfcgDec, bands);

  const results: CombinedLoadZoneResult[] = [];

  const byGroup = {
    FWD_CANTILEVER: limited
      .filter((z) => z.group === "FWD_CANTILEVER")
      .sort((a, b) => d(a.hArm ?? "0").comparedTo(d(b.hArm ?? "0"))),
    AFT_CANTILEVER: limited
      .filter((z) => z.group === "AFT_CANTILEVER")
      .sort((a, b) => d(b.hArm ?? "0").comparedTo(d(a.hArm ?? "0"))), // descending hArm: tail-most first
  };

  for (const group of ["FWD_CANTILEVER", "AFT_CANTILEVER"] as const) {
    let cumulative = new Decimal(0);
    for (const zone of byGroup[group]) {
      const direct = d(loadByZone[zone.zone] ?? "0");
      cumulative = cumulative.plus(direct);
      const limit = zone.limits?.[band.label] ?? null;
      const withinLimit = limit === null ? true : cumulative.lte(d(limit));
      results.push({
        zone: zone.zone,
        cumulativeLoad: cumulative.toString(),
        limit,
        withinLimit,
      });
    }
  }

  return {
    zfcg,
    band: band.label,
    zones: results,
    allWithinLimit: results.every((r) => r.withinLimit),
  };
}
