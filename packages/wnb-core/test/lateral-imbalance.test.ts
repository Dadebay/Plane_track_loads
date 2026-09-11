import { describe, expect, it } from "vitest";
import { loadAhmData } from "@tua/ahm-data";
import { checkLateralImbalance, collectSideBySideLoads } from "../src/lateral-imbalance";
import type { LateralImbalanceLimits, PositionConfiguration } from "../src/types";

/** AHM 560 Appendix I s.74 — LATERAL IMBALANCE CAUTION. */

const ahm = loadAhmData("a330-243p2f", 1, 2);
const plate = ahm.lateralImbalance!;

const configurations: PositionConfiguration[] = ahm.positionConfigurations!.configurations.map((c) => ({
  id: c.id,
  label: c.label,
  deck: c.deck,
  longitudinalInches: c.longitudinalInches,
  lateralInches: c.lateralInches,
  lateralPlacement: c.lateralPlacement,
}));

/** The real plate as loaded — fuel half still missing, so the check is off. */
const realLimits: LateralImbalanceLimits = {
  limit: plate.limit,
  operationalMargin: plate.operationalMargin,
  payload: plate.payload.map((p) => ({ category: p.category, yArm: p.yArm })),
  fuelDataAvailable: plate.fuel.status !== "SOURCE_NOT_TRANSCRIBED",
};

/** The same plate with the fuel half hypothetically supplied, so the
 * arithmetic downstream of that blocker can be exercised today. Nothing here
 * invents an AHM value: the constants are the plate's own, only the
 * availability flag differs. */
const withFuel: LateralImbalanceLimits = { ...realLimits, fuelDataAvailable: true };

describe("checkLateralImbalance — availability", () => {
  it("is unavailable when the revision carries no plate at all", () => {
    const result = checkLateralImbalance({ sideBySide: [], limits: null });
    expect(result.status).toBe("NOT_AVAILABLE");
  });

  it("is unavailable with the real Ed.1 Rev.2 data, because the fuel table is untranscribed", () => {
    // This is the guard the brief demands: until FUEL LATERAL MOMENT PER TANK
    // TABLE is legible the check may not report a pass. If this ever flips,
    // AHM560_ERRATA.md Kayıt 10 must have been closed first.
    const result = checkLateralImbalance({
      sideBySide: [{ category: "MAIN_SBS_88", leftWeight: "4000", rightWeight: "1000" }],
      limits: realLimits,
    });
    expect(result.status).toBe("NOT_AVAILABLE");
    if (result.status !== "NOT_AVAILABLE") throw new Error("unreachable");
    expect(result.reason).toContain("Kayıt 10");
  });

  it("still returns the payload half as provisional information", () => {
    const result = checkLateralImbalance({
      sideBySide: [{ category: "MAIN_SBS_88", leftWeight: "4000", rightWeight: "1000" }],
      limits: realLimits,
    });
    if (result.status !== "NOT_AVAILABLE") throw new Error("unreachable");
    // 3000 kg to the left x 1.13 m
    expect(result.payloadMoment).toBe("3390");
    expect(result.payloadRows).toHaveLength(1);
    expect(result.payloadRows![0]!.difference).toBe("3000");
  });
});

describe("checkLateralImbalance — the plate's arithmetic", () => {
  it("computes difference x y-arm per printed row", () => {
    const result = checkLateralImbalance({
      sideBySide: [
        { category: "MAIN_SBS_88", leftWeight: "3000", rightWeight: "2000" },
        { category: "MAIN_SBS_96", leftWeight: "2000", rightWeight: "1000" },
        { category: "LOWER_LD3", leftWeight: "1000", rightWeight: "1500" },
      ],
      fuel: [],
      limits: withFuel,
    });
    if (result.status === "NOT_AVAILABLE") throw new Error("unreachable");
    expect(result.payloadRows.map((r) => r.moment)).toEqual([
      "1130", // 1000 x 1.13
      "1230", // 1000 x 1.23
      "-405", // -500 x 0.81
    ]);
    expect(result.payloadMoment).toBe("1955");
  });

  it("adds the fuel tank pairs as left minus right moments", () => {
    const result = checkLateralImbalance({
      sideBySide: [],
      fuel: [
        { tank: "OUTER", leftMoment: "3000", rightMoment: "2000" },
        { tank: "INNER", leftMoment: "10000", rightMoment: "12000" },
      ],
      limits: withFuel,
    });
    if (result.status === "NOT_AVAILABLE") throw new Error("unreachable");
    expect(result.fuelMoment).toBe("-1000");
    expect(result.totalWithoutMargin).toBe("-1000");
  });

  it("gives the operational margin the total's own sign, so it always makes things worse", () => {
    const left = checkLateralImbalance({
      sideBySide: [{ category: "MAIN_SBS_88", leftWeight: "1000", rightWeight: "0" }],
      fuel: [],
      limits: withFuel,
    });
    const right = checkLateralImbalance({
      sideBySide: [{ category: "MAIN_SBS_88", leftWeight: "0", rightWeight: "1000" }],
      fuel: [],
      limits: withFuel,
    });
    if (left.status === "NOT_AVAILABLE" || right.status === "NOT_AVAILABLE") throw new Error("unreachable");
    expect(left.operationalMargin).toBe("11554");
    expect(right.operationalMargin).toBe("-11554");
    expect(Math.abs(Number(left.totalWithMargin))).toBeGreaterThan(Math.abs(Number(left.totalWithoutMargin)));
    expect(Math.abs(Number(right.totalWithMargin))).toBeGreaterThan(Math.abs(Number(right.totalWithoutMargin)));
  });

  it("applies no margin to a perfectly symmetric load", () => {
    const result = checkLateralImbalance({
      sideBySide: [{ category: "MAIN_SBS_88", leftWeight: "2500", rightWeight: "2500" }],
      fuel: [],
      limits: withFuel,
    });
    if (result.status === "NOT_AVAILABLE") throw new Error("unreachable");
    expect(result.totalWithoutMargin).toBe("0");
    expect(result.operationalMargin).toBe("0");
    expect(result.status).toBe("OK");
  });

  it("passes just inside the limit and fails just outside it", () => {
    // Limit 34 000, margin 11 554 -> the payload total may reach 22 446.
    // At y-arm 1.13 that is a 19 863.716... kg difference; use round numbers
    // either side of it.
    const inside = checkLateralImbalance({
      sideBySide: [{ category: "MAIN_SBS_88", leftWeight: "19863", rightWeight: "0" }],
      fuel: [],
      limits: withFuel,
    });
    const outside = checkLateralImbalance({
      sideBySide: [{ category: "MAIN_SBS_88", leftWeight: "19864", rightWeight: "0" }],
      fuel: [],
      limits: withFuel,
    });
    if (inside.status === "NOT_AVAILABLE" || outside.status === "NOT_AVAILABLE") throw new Error("unreachable");
    expect(inside.status).toBe("OK");
    expect(Number(inside.totalWithMargin)).toBeLessThanOrEqual(34000);
    expect(outside.status).toBe("EXCEEDED");
    expect(Number(outside.totalWithMargin)).toBeGreaterThan(34000);
  });

  it("treats a right-heavy load exactly like its left-heavy mirror", () => {
    const heavy = (left: string, right: string) =>
      checkLateralImbalance({
        sideBySide: [{ category: "MAIN_SBS_96", leftWeight: left, rightWeight: right }],
        fuel: [{ tank: "INNER", leftMoment: "500", rightMoment: "0" }],
        limits: withFuel,
      });
    const a = heavy("8000", "0");
    const b = heavy("0", "8000");
    if (a.status === "NOT_AVAILABLE" || b.status === "NOT_AVAILABLE") throw new Error("unreachable");
    // Mirroring only the payload leaves the 500 kg.m fuel term unmirrored, so
    // the magnitudes differ by exactly twice that.
    expect(Number(a.totalWithoutMargin) - Number(b.totalWithoutMargin)).toBe(2 * 9840);
  });

  it("rejects a category the plate prints no y-arm for", () => {
    const truncated: LateralImbalanceLimits = { ...withFuel, payload: [] };
    expect(() =>
      checkLateralImbalance({
        sideBySide: [{ category: "MAIN_SBS_88", leftWeight: "1", rightWeight: "0" }],
        limits: truncated,
      }),
    ).toThrow(/no printed Y-arm/);
  });
});

describe("collectSideBySideLoads", () => {
  const positions = ahm.positions.positions;

  it("ignores centred positions entirely — the plate is side-by-side only", () => {
    expect(
      collectSideBySideLoads(
        [
          { position: "A", weight: "2000" },
          { position: "AB", weight: "3000" },
          { position: "12P", weight: "1000" },
        ],
        positions,
        configurations,
      ),
    ).toEqual([]);
  });

  it("totals main-deck pairs into the 88\" and 96\" categories", () => {
    const loads = collectSideBySideLoads(
      [
        { position: "ABL", weight: "1000" },
        { position: "ABR", weight: "400" },
        { position: "BCL", weight: "500" },
      ],
      positions.filter((p) => p.uldType !== "SIDE_BY_SIDE_125x96"),
      configurations,
    );
    expect(loads).toEqual([{ category: "MAIN_SBS_88", leftWeight: "1500", rightWeight: "400" }]);
  });

  it("maps lower-deck half containers to LOWER LD3", () => {
    const loads = collectSideBySideLoads(
      [
        { position: "23L", weight: "800" },
        { position: "23R", weight: "1200" },
      ],
      positions,
      configurations,
    );
    expect(loads).toEqual([{ category: "LOWER_LD3", leftWeight: "800", rightWeight: "1200" }]);
  });

  it("feeds straight into the check", () => {
    const loads = collectSideBySideLoads(
      [
        { position: "23L", weight: "2000" },
        { position: "23R", weight: "0" },
      ],
      positions,
      configurations,
    );
    const result = checkLateralImbalance({ sideBySide: loads, fuel: [], limits: withFuel });
    if (result.status === "NOT_AVAILABLE") throw new Error("unreachable");
    expect(result.payloadMoment).toBe("1620"); // 2000 x 0.81
  });
});
