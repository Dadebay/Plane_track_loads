import { describe, expect, it } from "vitest";
import { loadAhmData } from "../src/schema";

/**
 * How the published DOW/DOI matrix is built, and where our own data set
 * still disagrees with itself.
 *
 * AHM 560 Ed.1 Rev.2 s.6 §III prints one DOW per crew version, with the
 * remark "Cockpit crew weight including baggage weight is 100 kg. Courier
 * crew weight including baggage weight is 80 kg." That makes the matrix
 * decomposable: strip the crew off a cell and what remains is the aircraft's
 * basic empty weight plus the fixed items (document stowage, courier
 * stowage, potable water, waste tank) that are baked into every cell.
 *
 * Doing that arithmetic surfaces a real problem — see AHM560_ERRATA.md
 * Kayıt 11 — so these tests pin both halves: the part that is sound (the
 * crew steps) and the size of the part that is not (the stale BEW).
 */

const rev2 = loadAhmData("a330-243p2f", 1, 2);

/**
 * Exact arithmetic without pulling decimal.js into this package, which
 * deliberately has no runtime dependency beyond zod: every AHM weight is
 * printed to at most one decimal, so tenths of a kilogram are integers and
 * integers are exact in JavaScript.
 */
function tenths(value: string): number {
  const [whole = "0", fraction = ""] = value.replace("+", "").split(".");
  if (fraction.length > 1) throw new Error(`${value} has more than one decimal`);
  const sign = whole.startsWith("-") ? -1 : 1;
  return sign * (Math.abs(Number(whole)) * 10 + Number(fraction.padEnd(1, "0") || "0"));
}

/** Back to a plain kg string, so failures read like the printed page. */
function kg(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const fraction = abs % 10;
  return sign + String(Math.trunc(abs / 10)) + (fraction ? `.${fraction}` : "");
}

/** The remark printed under the Rev.2 matrix, read from the data file — not
 * a constant this test invented. */
const COCKPIT_CREW_TENTHS = tenths(rev2.dowDoiMatrix.crewWeights.cockpitKg);
const COURIER_CREW_TENTHS = tenths(rev2.dowDoiMatrix.crewWeights.courierKg);

const REGISTRATIONS = ["EZ-F429", "EZ-F430"] as const;

function cell(registration: (typeof REGISTRATIONS)[number], cockpitCrew: number, courierCrew: number) {
  const found = rev2.dowDoiMatrix[registration].find(
    (c) => c.cockpitCrew === cockpitCrew && c.courierCrew === courierCrew,
  );
  if (!found) throw new Error(`no ${registration} cell for ${cockpitCrew}/${courierCrew}`);
  return found;
}

function bewTenths(registration: string): number {
  const entry = rev2.aircraft.registrations.find((r) => r.registration === registration);
  if (!entry) throw new Error(`no aircraft entry for ${registration}`);
  return tenths(entry.bew);
}

/** Crew-free remainder of a cell: BEW plus whatever fixed items the
 * published matrix bakes into every crew version. */
function impliedBasicTenths(registration: (typeof REGISTRATIONS)[number], cockpitCrew: number, courierCrew: number) {
  const c = cell(registration, cockpitCrew, courierCrew);
  return tenths(c.dow) - (COCKPIT_CREW_TENTHS * c.cockpitCrew + COURIER_CREW_TENTHS * c.courierCrew);
}

describe("DOW/DOI matrix composition", () => {
  it("steps by exactly the printed crew weights, in every row and column", () => {
    for (const registration of REGISTRATIONS) {
      for (let courier = 0; courier <= 6; courier += 1) {
        for (let cockpit = 1; cockpit < 4; cockpit += 1) {
          const step = tenths(cell(registration, cockpit + 1, courier).dow) - tenths(cell(registration, cockpit, courier).dow);
          expect(step, `${registration} cockpit ${cockpit}->${cockpit + 1}, courier ${courier}`).toBe(
            COCKPIT_CREW_TENTHS,
          );
        }
      }
      for (let cockpit = 1; cockpit <= 4; cockpit += 1) {
        for (let courier = 0; courier < 6; courier += 1) {
          const step = tenths(cell(registration, cockpit, courier + 1).dow) - tenths(cell(registration, cockpit, courier).dow);
          expect(step, `${registration} courier ${courier}->${courier + 1}, cockpit ${cockpit}`).toBe(
            COURIER_CREW_TENTHS,
          );
        }
      }
    }
  });

  it("leaves the same crew-free remainder whichever cell it is derived from", () => {
    // If the matrix is internally consistent, every cell has to imply one
    // basic figure for the airframe.
    for (const registration of REGISTRATIONS) {
      const remainders = new Set<number>();
      for (const c of rev2.dowDoiMatrix[registration]) {
        remainders.add(impliedBasicTenths(registration, c.cockpitCrew, c.courierCrew));
      }
      expect(remainders.size, `${registration} implies more than one basic weight`).toBe(1);
    }
  });
});

describe("known gap: aircraft.json still carries the pre-reweigh BEW", () => {
  /**
   * `dow-doi-matrix.json` is transcribed from the Rev.2 page; the basic
   * weight page for Rev.2 has not been supplied, so `aircraft.json` still
   * holds Ed.1 Rev.0's BEW (see ed1-rev2/PROVENANCE.md). The two therefore
   * describe different weighings of the same airframe.
   *
   * Nothing calculates from BEW today — `calculateWnb` is handed the
   * matrix's DOW/DOI — so this is a data-integrity problem, not a live
   * miscalculation. These expectations exist to make the day it is fixed
   * loud: when the Rev.2 basic weight page lands, both gaps must go to
   * whatever the published fixed items sum to, and these numbers change.
   */
  const measured: Record<string, string> = {
    "EZ-F429": "218.5",
    "EZ-F430": "629.5",
  };

  it("measures the gap between the matrix's implied basic figure and the stored BEW", () => {
    for (const registration of REGISTRATIONS) {
      const gap = bewTenths(registration) - impliedBasicTenths(registration, 2, 3);
      expect(kg(gap), registration).toBe(measured[registration]);
    }
  });

  it("has a gap too large to be the fixed stowage items, so it is a different weighing", () => {
    // The reference operator's own screen itemises document stowage,
    // courier stowage, potable water and waste tank at 56.7 kg together.
    // A 218.5 kg gap cannot be those items; a 629.5 kg one certainly cannot.
    for (const registration of REGISTRATIONS) {
      const gap = bewTenths(registration) - impliedBasicTenths(registration, 2, 3);
      expect(Math.abs(gap) > tenths("100"), registration).toBe(true);
    }
  });

  it("does not let the stale BEW reach a calculation: the matrix is the only DOW source", () => {
    // Guard by construction rather than by convention — if a DOW ever has
    // to be built from BEW, this test is where the decision gets revisited.
    for (const registration of REGISTRATIONS) {
      expect(tenths(cell(registration, 2, 3).dow) === bewTenths(registration), registration).toBe(false);
    }
  });
});
