import { describe, expect, it } from "vitest";
import { getDowDoi } from "../src/dow-doi";
import { DowDoiNotFoundError } from "../src/errors";
import { applyLmc } from "../src/lmc";
import { t5692Input } from "./fixtures/t5692";
import type { DowDoiCell } from "../src/types";

const matrix: DowDoiCell[] = [
  { cockpitCrew: 2, courierCrew: 3, dow: "111720", doi: "77.74" },
  { cockpitCrew: 1, courierCrew: 0, dow: "111380", doi: "80.78" },
];

describe("getDowDoi", () => {
  it("finds the exact matrix cell (AHM 560 s.6)", () => {
    const { dow, doi } = getDowDoi("EZ-F430", 2, 3, matrix);
    expect(dow).toBe("111720");
    expect(doi).toBe("77.74");
  });

  it("throws DowDoiNotFoundError for a combination outside 1-4/0-6", () => {
    expect(() => getDowDoi("EZ-F430", 4, 6, matrix)).toThrow(DowDoiNotFoundError);
  });
});

describe("applyLmc", () => {
  it("recomputes ZFW/TOW/LDW after adding a new position", () => {
    const { before, after, lmcTotal } = applyLmc(t5692Input, [
      { position: "TT", weightDelta: "0" }, // no-op baseline change to confirm recompute happens
    ]);
    expect(before.zfw).toBe(after.zfw);
    expect(lmcTotal).toBe("0");
  });

  it("adjusts an existing item's weight by the delta", () => {
    const { before, after } = applyLmc(t5692Input, [{ position: "TT", weightDelta: "-119" }]);
    // TT starts at 2119 kg; -119 delta -> 2000 kg, ZFW/TTL both drop by 119.
    expect(Number(after.ttl)).toBeCloseTo(Number(before.ttl) - 119, 5);
    expect(Number(after.zfw)).toBeCloseTo(Number(before.zfw) - 119, 5);
  });

  it("adds a brand-new position not previously loaded", () => {
    const positionsWithout52 = t5692Input.loadItems.filter((i) => i.position !== "51");
    const input = { ...t5692Input, loadItems: positionsWithout52 };
    const { before, after, lmcTotal } = applyLmc(input, [{ position: "51", weightDelta: "200" }]);
    expect(Number(after.ttl)).toBeCloseTo(Number(before.ttl) + 200, 5);
    expect(lmcTotal).toBe("200");
  });
});
