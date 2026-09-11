import { describe, expect, it } from "vitest";
import { buildEnvelopeExtent, sortBreakpointsByWeight } from "../src/envelope-extent";
import type { CgLimitCurve } from "../src/types";

// A cut-down stand-in for cg-limits.json's a330-243p2f curves — enough
// breakpoints to exercise the rounding, not a copy of the AHM table.
const zfw: CgLimitCurve = {
  forward: [
    { weight: "116000", index: "100.88" },
    { weight: "170000", index: "81.72" },
  ],
  aft: [
    { weight: "116000", index: "141.62" },
    { weight: "170000", index: "164.45" },
  ],
};
const takeoff: CgLimitCurve = {
  forward: [
    { weight: "116000", index: "85.61" },
    { weight: "210000", index: "66.50" },
    { weight: "233000", index: "99.29" },
  ],
  aft: [
    { weight: "116000", index: "115.28" },
    { weight: "228625", index: "175.13" },
  ],
};

describe("buildEnvelopeExtent", () => {
  it("covers every breakpoint, point and reference line", () => {
    const extent = buildEnvelopeExtent({
      curves: [zfw, takeoff],
      points: [
        { weight: "146321.7", index: "106.07" },
        { weight: "191021.7", index: "109.39" },
      ],
      weightReferences: ["182000", "116000"],
    });

    // The axis ends at the data itself; only the ticks are round.
    expect(extent.indexMin).toBe("66.5");
    expect(extent.indexMax).toBe("175.13");
    expect(extent.weightMin).toBe("116000");
    expect(extent.weightMax).toBe("233000");
    expect(extent.indexTicks[0]).toBe("70");
    expect(extent.weightTicks[0]).toBe("120000");
  });

  it("never clips a curve: every breakpoint lies inside the extent", () => {
    const extent = buildEnvelopeExtent({ curves: [zfw, takeoff], points: [] });
    for (const point of [...zfw.forward, ...zfw.aft, ...takeoff.forward, ...takeoff.aft]) {
      expect(Number(point.index)).toBeGreaterThanOrEqual(Number(extent.indexMin));
      expect(Number(point.index)).toBeLessThanOrEqual(Number(extent.indexMax));
      expect(Number(point.weight)).toBeGreaterThanOrEqual(Number(extent.weightMin));
      expect(Number(point.weight)).toBeLessThanOrEqual(Number(extent.weightMax));
    }
  });

  it("emits inclusive, evenly-spaced ticks", () => {
    const extent = buildEnvelopeExtent({
      curves: [zfw],
      points: [{ weight: "146321.7", index: "106.07" }],
    });
    // Every tick lies inside the axis, on a round value.
    for (const tick of [...extent.indexTicks, ...extent.weightTicks]) {
      expect(Number(tick) % 10).toBe(0);
    }
    expect(Number(extent.indexTicks[0])).toBeGreaterThanOrEqual(Number(extent.indexMin));
    expect(Number(extent.indexTicks[extent.indexTicks.length - 1])).toBeLessThanOrEqual(Number(extent.indexMax));
    expect(Number(extent.weightTicks[0])).toBeGreaterThanOrEqual(Number(extent.weightMin));
    expect(Number(extent.weightTicks[extent.weightTicks.length - 1])).toBeLessThanOrEqual(Number(extent.weightMax));
    for (let i = 1; i < extent.indexTicks.length; i++) {
      expect(Number(extent.indexTicks[i]) - Number(extent.indexTicks[i - 1])).toBe(10);
    }
  });

  it("honours a caller's tick steps", () => {
    const extent = buildEnvelopeExtent({
      curves: [zfw],
      points: [],
      indexStep: "20",
      weightStep: "10000",
    });
    expect(extent.indexTicks[0]).toBe("100");
    expect(extent.indexTicks[extent.indexTicks.length - 1]).toBe("160");
    expect(extent.weightTicks[0]).toBe("120000");
    expect(extent.weightTicks[extent.weightTicks.length - 1]).toBe("170000");
  });

  it("is deterministic — the same input gives the same extent", () => {
    const input = { curves: [zfw, takeoff], points: [{ weight: "146321.7", index: "106.07" }] };
    expect(buildEnvelopeExtent(input)).toEqual(buildEnvelopeExtent(input));
  });

  it("throws rather than inventing an extent from nothing", () => {
    expect(() => buildEnvelopeExtent({ curves: [], points: [] })).toThrow(/at least one/);
  });
});

describe("sortBreakpointsByWeight", () => {
  it("orders ascending by weight without mutating the input", () => {
    const unsorted = [
      { weight: "170000", index: "81.72" },
      { weight: "116000", index: "100.88" },
      { weight: "143000", index: "90.20" },
    ];
    const sorted = sortBreakpointsByWeight(unsorted);
    expect(sorted.map((p) => p.weight)).toEqual(["116000", "143000", "170000"]);
    expect(unsorted[0]!.weight).toBe("170000");
  });
});

describe("buildEnvelopeExtent minimum range", () => {
  it("widens a narrow axis to the requested frame", () => {
    const extent = buildEnvelopeExtent({
      curves: [zfw],
      points: [{ weight: "146321.7", index: "106.07" }],
      minimumIndexRange: ["40", "200"],
      minimumWeightRange: ["116000", "240000"],
    });
    expect(extent.indexMin).toBe("40");
    expect(extent.indexMax).toBe("200");
    expect(extent.weightMax).toBe("240000");
  });

  it("never lets the frame clip the data", () => {
    // A frame narrower than the curves must lose: the point of the extent is
    // that no breakpoint can fall off the chart.
    const extent = buildEnvelopeExtent({
      curves: [zfw, takeoff],
      points: [],
      minimumIndexRange: ["100", "120"],
      minimumWeightRange: ["150000", "160000"],
    });
    for (const point of [...zfw.forward, ...zfw.aft, ...takeoff.forward, ...takeoff.aft]) {
      expect(Number(point.index)).toBeGreaterThanOrEqual(Number(extent.indexMin));
      expect(Number(point.index)).toBeLessThanOrEqual(Number(extent.indexMax));
      expect(Number(point.weight)).toBeGreaterThanOrEqual(Number(extent.weightMin));
      expect(Number(point.weight)).toBeLessThanOrEqual(Number(extent.weightMax));
    }
  });
});
