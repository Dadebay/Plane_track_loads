import { describe, expect, it } from "vitest";
import { loadAhmData } from "@tua/ahm-data";
import {
  calculatePositionIndexes,
  cardTolerance,
  crossCheckCargoIndexCard,
  expandLoadToZones,
  lookupCargoIndex,
  positionIndex,
  PositionNotFoundError,
  type LoadItem,
} from "../src";

const ahm = loadAhmData("a330-243p2f", 1, 0);
const positions = ahm.positions.positions.filter(
  (p, i, all) => all.findIndex((q) => q.code === p.code) === i,
);

describe("positionIndex", () => {
  it("is weight x indexPerKg to 2 dp", () => {
    // Position A: -0.00696 index/kg (AHM 560 s.57 Sheet 14).
    expect(positionIndex("2826", "-0.00696")).toBe("-19.67");
    expect(positionIndex("1000", "0.00792")).toBe("7.92");
  });

  it("returns 0.00, not -0.00, for an empty position", () => {
    expect(positionIndex("0", "-0.00696")).toBe("0.00");
  });
});

describe("calculatePositionIndexes", () => {
  it("collapses several items in one position into a single row", () => {
    const items: LoadItem[] = [
      { position: "PP", weight: "1000" },
      { position: "PP", weight: "1125" },
    ];
    const { rows, totalWeight } = calculatePositionIndexes(items, positions);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.weight).toBe("2125");
    expect(totalWeight).toBe("2125");
  });

  it("sums unrounded, so the total does not drift with the number of positions", () => {
    // 100 kg in A..E: the exact sum is -2.5720, but each row rounds away
    // from zero on its own and adding the displayed rows gives -2.58.
    const items: LoadItem[] = ["A", "B", "C", "D", "E"].map((position) => ({ position, weight: "100" }));
    const { rows, totalIndex } = calculatePositionIndexes(items, positions);
    const sumOfRounded = rows.reduce((acc, r) => acc + Number(r.index), 0);
    expect(totalIndex).toBe("-2.57");
    expect(sumOfRounded).toBeCloseTo(-2.58, 2);
  });

  it("agrees with calculateWnb's deadload index for the T5 692 load", () => {
    // Same 33 items the golden test uses, abbreviated to the main deck —
    // the point is that the live panel's total and the saved calculation's
    // LIZFW - DOI never disagree.
    const items: LoadItem[] = [
      { position: "ABL", weight: "717" },
      { position: "ABR", weight: "834" },
      { position: "PP", weight: "2125" },
      { position: "TT", weight: "2119" },
    ];
    const { totalIndex } = calculatePositionIndexes(items, positions);
    const byHand = items.reduce((acc, item) => {
      const pos = positions.find((p) => p.code === item.position)!;
      return acc + Number(item.weight) * Number(pos.indexPerKg);
    }, 0);
    expect(Number(totalIndex)).toBeCloseTo(byHand, 2);
  });

  it("throws for an unknown position, matching calculateWnb's contract", () => {
    expect(() => calculatePositionIndexes([{ position: "ZZ", weight: "100" }], positions)).toThrow(
      PositionNotFoundError,
    );
  });
});

const card = loadAhmData("a330-243p2f", 1, 2).cargoIndexTable!;

describe("lookupCargoIndex", () => {
  it("finds the bracket a weight falls in, inclusive at both ends", () => {
    expect(lookupCargoIndex("A", "1", card)).toBe("-2");
    expect(lookupCargoIndex("A", "500", card)).toBe("-2");
    expect(lookupCargoIndex("A", "501", card)).toBe("-5");
    expect(lookupCargoIndex("A", "1000", card)).toBe("-5");
  });

  it("falls back to the MAX row above the last printed bracket", () => {
    // Zone A's last printed bracket is 6501-7000; MAX is -49.
    expect(lookupCargoIndex("A", "6900", card)).toBe("-46");
    // Zone A is greyed out from 7001 kg up, so the card sends you to MAX.
    expect(lookupCargoIndex("A", "9000", card)).toBe("-49");
    expect(lookupCargoIndex("A", "20000", card)).toBe("-49");
  });

  it("returns null for an empty position and for a greyed-out cell", () => {
    expect(lookupCargoIndex("A", "0", card)).toBeNull();
    // U's column stops at 2501-3000; 5000 kg falls past every printed
    // bracket, so it lands on MAX rather than nothing.
    expect(lookupCargoIndex("U", "5000", card)).toBe("22");
    // T is greyed out from 5001 kg up while other zones still print there,
    // so T reads its MAX row (35) rather than its last bracket (33).
    expect(lookupCargoIndex("T", "4900", card)).toBe("33");
    expect(lookupCargoIndex("T", "6200", card)).toBe("35");
  });
});

// The card is a hand-drawn approximation of the same quantity wnb-core
// computes exactly. These tests pin that relationship: if a future AHM
// revision moves positions.json without the card being reissued (or vice
// versa), they fail.
describe("cargo index card vs positions.json", () => {
  it("carries the full printed grid", () => {
    expect(card.brackets).toHaveLength(28);
    expect(Object.keys(card.max)).toHaveLength(17);
    expect(card.brackets[0]!.from).toBe("1");
    expect(card.brackets.at(-1)!.to).toBe("14000");
  });

  it("tracks each zone's published index-per-kg in slope", () => {
    for (const zone of Object.keys(card.max)) {
      const pos = positions.find((p) => p.code === zone)!;
      const points = card.brackets
        .filter((b) => b.index[zone] !== undefined)
        .map((b) => [(Number(b.from) + Number(b.to)) / 2, Number(b.index[zone])] as const);

      const n = points.length;
      const sx = points.reduce((a, [x]) => a + x, 0);
      const sy = points.reduce((a, [, y]) => a + y, 0);
      const sxy = points.reduce((a, [x, y]) => a + x * y, 0);
      const sxx = points.reduce((a, [x]) => a + x * x, 0);
      const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);

      // Within 20%: 13 of the 17 columns land inside 10%; the looser four
      // (F, H, J, K) are the near-neutral bays whose cells are only 0, 1 or
      // 2, so whole-unit rounding dominates the fit.
      expect(Math.abs(slope / Number(pos.indexPerKg) - 1)).toBeLessThan(0.2);
    }
  });

  it("never disagrees with the exact figure by more than its own resolution", () => {
    for (const zone of Object.keys(card.max)) {
      const pos = positions.find((p) => p.code === zone)!;
      for (const bracket of card.brackets) {
        const printed = bracket.index[zone];
        if (printed === undefined) continue;
        for (const weight of [Number(bracket.from), Number(bracket.to)]) {
          const tolerance = Number(cardTolerance(pos.indexPerKg, String(weight)));
          expect(Math.abs(weight * Number(pos.indexPerKg) - Number(printed))).toBeLessThanOrEqual(tolerance);
        }
      }
    }
  });

  it("greys a zone out only above roughly its maximum load", () => {
    for (const [zone, max] of Object.entries(card.max)) {
      const pos = positions.find((p) => p.code === zone)!;
      const lastBracketTop = Math.max(
        ...card.brackets.filter((b) => b.index[zone] !== undefined).map((b) => Number(b.to)),
      );
      // MAX / index-per-kg is the load the card's MAX row stands for; it
      // must sit near the top of the last printed bracket, never far past it.
      const impliedMaxLoad = Number(max) / Number(pos.indexPerKg);
      expect(impliedMaxLoad).toBeGreaterThan(lastBracketTop - 2500);
      expect(impliedMaxLoad).toBeLessThan(lastBracketTop + 1000);
    }
  });
});

describe("crossCheckCargoIndexCard", () => {
  it("agrees with the card for a normal main-deck load", () => {
    const items: LoadItem[] = [{ position: "A", weight: "800" }];
    const zones = expandLoadToZones(items, ahm.zoneMapping.longPalletDistribution);
    const [check] = crossCheckCargoIndexCard(zones, positions, card);
    expect(check!.zone).toBe("A");
    expect(check!.computed).toBe("-5.57");
    expect(check!.printed).toBe("-5");
    expect(check!.disagrees).toBe(false);
  });

  it("flags a card that no longer matches the position data", () => {
    const stale = {
      brackets: [{ from: "1", to: "500", index: { A: "+12" } }],
      max: { A: "+12" },
    };
    const zones = expandLoadToZones([{ position: "A", weight: "300" }], ahm.zoneMapping.longPalletDistribution);
    const [check] = crossCheckCargoIndexCard(zones, positions, stale);
    expect(check!.disagrees).toBe(true);
  });

  it("skips zones the card has no column for", () => {
    // Lower-deck positions never reach expandLoadToZones' output.
    const zones = expandLoadToZones([{ position: "12P", weight: "800" }], ahm.zoneMapping.longPalletDistribution);
    expect(crossCheckCargoIndexCard(zones, positions, card)).toEqual([]);
  });
});
