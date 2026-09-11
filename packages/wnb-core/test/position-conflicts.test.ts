import { describe, expect, it } from "vitest";
import { loadAhmData } from "@tua/ahm-data";
import {
  buildPositionFootprints,
  conflictingPositionsFor,
  findPositionConflicts,
  positionKey,
} from "../src/position-conflicts";
import type { PositionConfiguration } from "../src/types";

/**
 * AHM 560 Appendix I s.74 — mutually exclusive loading positions.
 *
 * The fixture is the real Ed.1 Rev.2 data set: these tests exist to prove the
 * geometry the plate implies, so a synthetic one would prove nothing.
 */

const ahm = loadAhmData("a330-243p2f", 1, 2);
const configurations: PositionConfiguration[] = ahm.positionConfigurations!.configurations.map((c) => ({
  id: c.id,
  label: c.label,
  deck: c.deck,
  longitudinalInches: c.longitudinalInches,
  lateralInches: c.lateralInches,
  lateralPlacement: c.lateralPlacement,
}));

const footprints = buildPositionFootprints(
  ahm.positions.positions,
  configurations,
  {
    refSta: ahm.indexFormula.refSta,
    k: ahm.indexFormula.k,
    c: ahm.indexFormula.c,
    refStaMinusLemac: ahm.indexFormula.derived.refStaMinusLemac,
    macOver100: ahm.indexFormula.derived.macOver100,
  },
  ahm.positionConfigurations!.halfContainerPositions,
);

const K = positionKey;

function conflictKeys(occupied: string[]): string[] {
  return findPositionConflicts(occupied, footprints)
    .map((conflict) => [conflict.a, conflict.b].sort().join(" x "))
    .sort();
}

describe("buildPositionFootprints", () => {
  it("covers every position except bulk, which the plate gives no footprint for", () => {
    const bulk = ahm.positions.positions.filter((p) => p.uldType === "BULK");
    const nonBulk = ahm.positions.positions.length - bulk.length;
    const halves = ahm.positionConfigurations!.halfContainerPositions.length * 2;
    expect(bulk.length).toBe(3);
    expect(footprints).toHaveLength(nonBulk + halves);
    expect(footprints.some((f) => f.uldType === "BULK")).toBe(false);
  });

  it("places the 88x125 single row exactly on the loading zone of the same name", () => {
    for (const zone of ahm.loadingZonesHArm!.zones.slice(0, 13)) {
      const f = footprints.find((x) => x.key === K("SINGLE_ROW_88x125", zone.zone))!;
      expect(Number(f.from)).toBeCloseTo(Number(zone.frontHArm), 1);
      expect(Number(f.to)).toBeCloseTo(Number(zone.rearHArm), 1);
    }
  });

  it("gives a side-by-side pair the same floor as the bridge position of the same name", () => {
    // ABR/ABL are the left and right halves of exactly the floor that the
    // SINGLE ROW 125" x 96" position AB occupies alone.
    const bridge = footprints.find((f) => f.key === K("SINGLE_ROW_125x96", "AB"))!;
    for (const key of [K("SIDE_BY_SIDE_125x88", "ABR"), K("SIDE_BY_SIDE_125x88", "ABL")]) {
      const sbs = footprints.find((f) => f.key === key)!;
      expect(Number(sbs.from)).toBeCloseTo(Number(bridge.from), 2);
      expect(Number(sbs.to)).toBeCloseTo(Number(bridge.to), 2);
    }
  });

  it("reads the side from the code's L/R suffix, and centres everything else", () => {
    expect(footprints.find((f) => f.key === K("SIDE_BY_SIDE_125x88", "ABL"))!.side).toBe("LEFT");
    expect(footprints.find((f) => f.key === K("SIDE_BY_SIDE_125x88", "ABR"))!.side).toBe("RIGHT");
    expect(footprints.find((f) => f.key === K("SINGLE_ROW_88x125", "A"))!.side).toBe("CENTRE");
    expect(footprints.find((f) => f.key === K("CONTAINER", "11"))!.side).toBe("CENTRE");
    expect(footprints.find((f) => f.key === K("CONTAINER", "11L"))!.side).toBe("LEFT");
  });

  it("expands every lower-deck container into an L and an R half over the same floor", () => {
    const full = footprints.find((f) => f.key === K("CONTAINER", "23"))!;
    for (const suffix of ["L", "R"]) {
      const half = footprints.find((f) => f.key === K("CONTAINER", `23${suffix}`))!;
      expect(half.from).toBe(full.from);
      expect(half.to).toBe(full.to);
    }
  });
});

describe("findPositionConflicts", () => {
  it("finds nothing for an empty or single-position load", () => {
    expect(findPositionConflicts([], footprints)).toEqual([]);
    expect(findPositionConflicts([K("SINGLE_ROW_88x125", "A")], footprints)).toEqual([]);
  });

  it("lets adjacent single-row positions coexist", () => {
    expect(conflictKeys([K("SINGLE_ROW_88x125", "A"), K("SINGLE_ROW_88x125", "B")])).toEqual([]);
    expect(
      conflictKeys(["A", "B", "C", "D", "E", "F", "G"].map((z) => K("SINGLE_ROW_88x125", z))),
    ).toEqual([]);
  });

  it("blocks a bridge position against the singles it spans", () => {
    expect(conflictKeys([K("SINGLE_ROW_125x96", "AB"), K("SINGLE_ROW_88x125", "A")])).toHaveLength(1);
    expect(conflictKeys([K("SINGLE_ROW_125x96", "AB"), K("SINGLE_ROW_88x125", "B")])).toHaveLength(1);
    // ...but not against a single two zones away.
    expect(conflictKeys([K("SINGLE_ROW_125x96", "AB"), K("SINGLE_ROW_88x125", "D")])).toEqual([]);
  });

  it("blocks a 96\" single against the 88\" single it creeps into", () => {
    // The two rows have different pitches, so AA (96") reaches into zone B.
    expect(conflictKeys([K("SINGLE_ROW_96x125", "AA"), K("SINGLE_ROW_88x125", "B")])).toHaveLength(1);
  });

  it("lets a left and a right side-by-side pallet share their bay", () => {
    expect(conflictKeys([K("SIDE_BY_SIDE_125x88", "ABL"), K("SIDE_BY_SIDE_125x88", "ABR")])).toEqual([]);
  });

  it("blocks a side-by-side pallet against a centred position on the same floor", () => {
    // A centred ULD spans the full width, so it collides with either side.
    expect(conflictKeys([K("SIDE_BY_SIDE_125x88", "ABL"), K("SINGLE_ROW_125x96", "AB")])).toHaveLength(1);
    expect(conflictKeys([K("SIDE_BY_SIDE_125x88", "ABR"), K("SINGLE_ROW_88x125", "A")])).toHaveLength(1);
  });

  it("blocks the two side-by-side rows against each other at the same bay", () => {
    expect(conflictKeys([K("SIDE_BY_SIDE_125x88", "ABL"), K("SIDE_BY_SIDE_125x96", "ABL")])).toHaveLength(1);
    // A left 88" and a right 96" are still on opposite sides — no shared floor.
    expect(conflictKeys([K("SIDE_BY_SIDE_125x88", "ABL"), K("SIDE_BY_SIDE_125x96", "ABR")])).toEqual([]);
  });

  it("blocks a lower-deck pallet against every container it displaces, and nothing else", () => {
    // 12P covers containers 12 and 13; 13P covers 13 and 14.
    for (const container of ["12", "13"]) {
      expect(conflictKeys([K("PALLET_88x125", "12P"), K("CONTAINER", container)])).toHaveLength(1);
    }
    expect(conflictKeys([K("PALLET_88x125", "12P"), K("CONTAINER", "11")])).toEqual([]);
    expect(conflictKeys([K("PALLET_88x125", "12P"), K("CONTAINER", "21")])).toEqual([]);
  });

  it("blocks a container against its own half units", () => {
    expect(conflictKeys([K("CONTAINER", "23"), K("CONTAINER", "23L")])).toHaveLength(1);
    expect(conflictKeys([K("CONTAINER", "23L"), K("CONTAINER", "23R")])).toEqual([]);
  });

  it("blocks the two lower-deck pallet sizes against each other at the same code", () => {
    expect(conflictKeys([K("PALLET_88x125", "31P"), K("PALLET_96x125", "31P")])).toHaveLength(1);
  });

  it("never reports a main-deck position against a lower-deck one", () => {
    expect(conflictKeys([K("SINGLE_ROW_88x125", "A"), K("CONTAINER", "11")])).toEqual([]);
    expect(conflictKeys([K("SINGLE_ROW_88x125", "C"), K("PALLET_88x125", "12P")])).toEqual([]);
  });

  it("blocks a 20 ft pallet against every single-row position under it", () => {
    // CFG is 238.5" long and swallows several 88" bays whole.
    const blocked = conflictingPositionsFor(
      K("PALLET_20FT", "CFG"),
      ["C", "D", "E", "F", "G", "H"].map((z) => K("SINGLE_ROW_88x125", z)),
      footprints,
    );
    expect(blocked).toContain(K("SINGLE_ROW_88x125", "D"));
    expect(blocked).toContain(K("SINGLE_ROW_88x125", "E"));
    expect(blocked).not.toContain(K("SINGLE_ROW_88x125", "H"));
  });

  it("ignores keys with no footprint instead of throwing", () => {
    expect(conflictKeys([K("BULK", "52"), K("SINGLE_ROW_88x125", "A"), "NOPE/ZZ"])).toEqual([]);
  });

  it("reports the shared length, and reports each pair once", () => {
    const conflicts = findPositionConflicts(
      [K("SINGLE_ROW_125x96", "AB"), K("SINGLE_ROW_88x125", "A"), K("SINGLE_ROW_88x125", "B")],
      footprints,
    );
    expect(conflicts).toHaveLength(2);
    for (const conflict of conflicts) {
      expect(Number(conflict.overlap)).toBeGreaterThan(0.05);
      expect(conflict.deck).toBe("MAIN");
    }
  });
});

describe("conflictingPositionsFor", () => {
  it("returns only the occupied positions that block the candidate", () => {
    const occupied = [K("SINGLE_ROW_88x125", "A"), K("SINGLE_ROW_88x125", "D")];
    expect(conflictingPositionsFor(K("SINGLE_ROW_125x96", "AB"), occupied, footprints)).toEqual([
      K("SINGLE_ROW_88x125", "A"),
    ]);
  });

  it("returns nothing when the candidate is already the occupant", () => {
    expect(
      conflictingPositionsFor(K("SINGLE_ROW_88x125", "A"), [K("SINGLE_ROW_88x125", "A")], footprints),
    ).toEqual([]);
  });
});
