import { loadAhmData } from "@tua/ahm-data";
import { describe, expect, it } from "vitest";
import { toDowDoiRows, toFuelIndexRows } from "../src/lib/ahm-detail-rows";

/**
 * Runs against the real AHM files, both revisions — the page broke on data
 * that was already in the repository, so a fixture would have missed it.
 */
describe("AHM detail rows", () => {
  for (const revision of [0, 2]) {
    it(`flattens Ed.1 Rev.${revision} without tripping over metadata`, () => {
      const data = loadAhmData("a330-243p2f", 1, revision);

      const dowDoi = toDowDoiRows(data.dowDoiMatrix as Record<string, unknown>);
      expect(dowDoi.length).toBeGreaterThan(0);
      expect(dowDoi.every((row) => typeof row.dow === "string")).toBe(true);
      // crewWeights is an object and notes is an array of sentences —
      // neither is a row, so neither may appear.
      expect(dowDoi.some((row) => row.registration === "crewWeights")).toBe(false);
      expect(dowDoi.some((row) => row.registration === "notes")).toBe(false);

      const fuel = toFuelIndexRows(data.fuelIndex as Record<string, unknown>);
      expect(fuel.length).toBeGreaterThan(0);
      expect(fuel.every((row) => typeof row.index === "string")).toBe(true);
    });
  }

  it("ignores metadata whatever shape it takes", () => {
    expect(
      toDowDoiRows({
        source: "a page reference",
        notes: ["a sentence", "another sentence"],
        crewWeights: { pilot: "85" },
        "EZ-F430": [],
      }),
    ).toEqual([]);
  });
});
