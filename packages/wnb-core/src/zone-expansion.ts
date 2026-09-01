import { Decimal } from "decimal.js";
import { d } from "./decimal-utils";
import type { LoadItem, LongPalletDistribution } from "./types";

/**
 * Expands per-position load items into per-zone totals for
 * `checkCombinedLoad` (AHM 560 s.55-56 §9.1) — Faz 8's live combined-load
 * warning needs `loadByZone`, but nothing in `@tua/ahm-data` maps a
 * position code directly to a zone except the 7 long-pallet positions
 * (`longPalletDistribution` in combined-load.json, explicit and
 * authoritative).
 *
 * For everything else this infers the mapping structurally:
 *  - The 17 lettered main-deck bays (A..U, skipping I/N/O/Q) each get
 *    their own zone (ZA..ZU) — combined-load.json's zone list is exactly
 *    this same 17-letter set, with hArm increasing fwd-to-aft in the same
 *    A->U order, which is strong (but not AHM-561-worked-example-
 *    confirmed, unlike checkCompartmentLimits's compartment grouping)
 *    evidence for a 1:1 letter<->zone correspondence.
 *  - A wide 96"-variant bay (AA, BB, ... TT) occupies the same physical
 *    span as its single-letter bay — same zone.
 *  - A bridge/side-by-side bay spanning two single-letter bays (AB, ABL,
 *    ABR, BC, ...) is split 50/50 between the two zones it bridges — no
 *    finer-grained published distribution exists for these (unlike the
 *    16/20ft pallets), so an even split is the least-assumption default.
 *  - Lower-deck/bulk positions don't participate in main-deck combined
 *    load and are skipped.
 *
 * Pending AHM 560 diagram re-verification — same open-question status as
 * `longPalletDistribution` itself (GROUND_TRUTH.md §21 Q7).
 */
function singleLetterZone(code: string): string | null {
  return /^[A-Z]$/.test(code) ? `Z${code}` : null;
}

function doubledLetterZone(code: string): string | null {
  const m = /^([A-Z])\1$/.exec(code);
  return m ? `Z${m[1]}` : null;
}

function bridgeZones(code: string): [string, string] | null {
  const letters = code.replace(/[LR]$/, "");
  if (!/^[A-Z]{2}$/.test(letters) || letters[0] === letters[1]) return null;
  return [`Z${letters[0]}`, `Z${letters[1]}`];
}

export function expandLoadToZones(
  loadItems: LoadItem[],
  longPalletDistribution: LongPalletDistribution[],
): Record<string, string> {
  const longPalletByPosition = new Map(longPalletDistribution.map((p) => [p.position, p.distribution]));
  const totals = new Map<string, Decimal>();

  function add(zone: string, amount: Decimal) {
    totals.set(zone, (totals.get(zone) ?? new Decimal(0)).plus(amount));
  }

  for (const item of loadItems) {
    const weight = d(item.weight);

    const longPallet = longPalletByPosition.get(item.position);
    if (longPallet) {
      for (const { zone, factor } of longPallet) add(zone, weight.times(d(factor)));
      continue;
    }

    const single = singleLetterZone(item.position) ?? doubledLetterZone(item.position);
    if (single) {
      add(single, weight);
      continue;
    }

    const bridge = bridgeZones(item.position);
    if (bridge) {
      const half = weight.dividedBy(2);
      add(bridge[0], half);
      add(bridge[1], half);
      continue;
    }

    // Lower-deck / bulk position — not part of main-deck combined load.
  }

  const result: Record<string, string> = {};
  for (const [zone, total] of totals) result[zone] = total.toString();
  return result;
}
