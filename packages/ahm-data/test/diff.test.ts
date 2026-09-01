import { describe, expect, it } from "vitest";
import { diffAhmData, type DiffEntry } from "../src/diff";
import { loadAhmData } from "../src/index";
import type { AhmDataSet } from "../src/schema";

function find(entries: DiffEntry[], path: string): DiffEntry | undefined {
  return entries.find((e) => e.path === path);
}

describe("diffAhmData", () => {
  it("returns no entries for two identical data sets", () => {
    const data = loadAhmData("a330-243p2f", 1, 0);
    expect(diffAhmData(data, data)).toEqual([]);
  });

  it("detects a changed scalar field (aircraft weight limit)", () => {
    const before = loadAhmData("a330-243p2f", 1, 0);
    const after: AhmDataSet = {
      ...before,
      aircraft: { ...before.aircraft, weightLimits: { ...before.aircraft.weightLimits, mzfw: "171000" } },
    };
    const entries = diffAhmData(before, after);
    const entry = find(entries, "aircraft.weightLimits.mzfw");
    expect(entry).toEqual({ path: "aircraft.weightLimits.mzfw", type: "changed", before: "170000", after: "171000" });
  });

  it("matches positions[] by natural key (code+uldType) and reports only the changed field", () => {
    const before = loadAhmData("a330-243p2f", 1, 0);
    const after: AhmDataSet = {
      ...before,
      positions: {
        ...before.positions,
        positions: before.positions.positions.map((p) =>
          p.code === "TT" && p.uldType === "SINGLE_ROW_96x125" ? { ...p, indexPerKg: "0.00999" } : p,
        ),
      },
    };
    const entries = diffAhmData(before, after);
    // Only the one field on the one matched position changed — not a
    // wholesale "positions array changed" blob.
    const posEntries = entries.filter((e) => e.path.startsWith("positions.positions["));
    expect(posEntries).toHaveLength(1);
    expect(posEntries[0]?.path).toContain("code=TT");
    expect(posEntries[0]?.type).toBe("changed");
    expect(posEntries[0]?.before).toBe("0.00788");
    expect(posEntries[0]?.after).toBe("0.00999");
  });

  it("reports an added position as type 'added', not a full-array change", () => {
    const before = loadAhmData("a330-243p2f", 1, 0);
    const after: AhmDataSet = {
      ...before,
      positions: {
        ...before.positions,
        positions: [
          ...before.positions.positions,
          { code: "ZZ", deck: "MAIN", uldType: "SINGLE_ROW_88x125", maxGross: "1000", indexPerKg: "0.001" },
        ],
      },
    };
    const entries = diffAhmData(before, after);
    const added = entries.find((e) => e.path.includes("code=ZZ"));
    expect(added?.type).toBe("added");
  });

  it("reports a removed position as type 'removed'", () => {
    const before = loadAhmData("a330-243p2f", 1, 0);
    const after: AhmDataSet = {
      ...before,
      positions: {
        ...before.positions,
        positions: before.positions.positions.filter((p) => p.code !== "51"),
      },
    };
    const entries = diffAhmData(before, after);
    const removed = entries.find((e) => e.path.includes("code=51"));
    expect(removed?.type).toBe("removed");
  });

  it("matches DOW/DOI matrix cells by composite cockpit+courier key", () => {
    const before = loadAhmData("a330-243p2f", 1, 0);
    const after: AhmDataSet = {
      ...before,
      dowDoiMatrix: {
        ...before.dowDoiMatrix,
        "EZ-F430": before.dowDoiMatrix["EZ-F430"].map((cell) =>
          cell.cockpitCrew === 2 && cell.courierCrew === 3 ? { ...cell, dow: "112000", doi: "77.00" } : cell,
        ),
      },
    };
    const entries = diffAhmData(before, after);
    const cellEntries = entries.filter((e) => e.path.includes("cockpit=2,courier=3"));
    expect(cellEntries).toHaveLength(2); // dow changed, doi changed
    expect(cellEntries.map((e) => e.path).sort()).toEqual([
      'dowDoiMatrix["EZ-F430"][cockpit=2,courier=3].doi',
      'dowDoiMatrix["EZ-F430"][cockpit=2,courier=3].dow',
    ]);
  });

  it("matches fuel index rows by fuelWeight within each density table", () => {
    const before = loadAhmData("a330-243p2f", 1, 0);
    const after: AhmDataSet = {
      ...before,
      fuelIndex: {
        ...before.fuelIndex,
        "0.760": before.fuelIndex["0.760"]!.map((row) =>
          row.fuelWeight === "2000" ? { ...row, index: "-9.99" } : row,
        ),
      },
    };
    const entries = diffAhmData(before, after);
    const entry = entries.find((e) => e.path.includes('fuelIndex["0.760"]'));
    expect(entry?.path).toBe('fuelIndex["0.760"][fuelWeight=2000].index');
    expect(entry?.before).toBe("-2.09");
    expect(entry?.after).toBe("-9.99");
  });

  it("matches combined-load zones by zone name and diffs their limits record", () => {
    const before = loadAhmData("a330-243p2f", 1, 0);
    const after: AhmDataSet = {
      ...before,
      combinedLoad: {
        ...before.combinedLoad,
        zones: before.combinedLoad.zones.map((z) =>
          z.zone === "ZA" ? { ...z, limits: { ...z.limits, "21<=ZFCG<22": "9999" } } : z,
        ),
      },
    };
    const entries = diffAhmData(before, after);
    const entry = entries.find((e) => e.path.includes("zone=ZA"));
    expect(entry?.path).toBe('combinedLoad.zones[zone=ZA].limits["21<=ZFCG<22"]');
    expect(entry?.before).toBe("4807");
    expect(entry?.after).toBe("9999");
  });

  it("falls back to positional diffing for arrays of plain strings", () => {
    const before = loadAhmData("a330-243p2f", 1, 0);
    const after: AhmDataSet = {
      ...before,
      positions: { ...before.positions, notes: [...before.positions.notes, "A new note."] },
    };
    const entries = diffAhmData(before, after);
    const entry = entries.find((e) => e.path.startsWith("positions.notes["));
    expect(entry?.type).toBe("added");
    expect(entry?.after).toBe("A new note.");
  });
});
