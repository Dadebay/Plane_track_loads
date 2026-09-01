import { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";
import { roundHalfUp, truncate } from "../src/decimal-utils";
import { macToStab } from "../src/formula";

const curve = [
  { mac: "18", stab: "7", direction: "UP" as const },
  { mac: "21", stab: "7", direction: "UP" as const },
  { mac: "35", stab: "0", direction: "DOWN" as const },
  { mac: "40", stab: "0", direction: "DOWN" as const },
];
const truncateRule = { method: "TRUNCATE" as const, decimals: 1 };

describe("STAB rounding — TRUNCATE, not round-half-up (GROUND_TRUTH.md §6)", () => {
  it("truncates 4.155 to 4.1 (T5 692 case)", () => {
    expect(truncate(new Decimal("4.155"), 1).toString()).toBe("4.1");
  });

  it("truncates 7.99 to 7.9, never rounding up to 8.0", () => {
    expect(truncate(new Decimal("7.99"), 1).toString()).toBe("7.9");
  });

  it("differs from round-half-up at the same input — the whole point of the rule", () => {
    const value = new Decimal("4.155");
    expect(truncate(value, 1).toString()).toBe("4.1");
    expect(roundHalfUp(value, 1).toString()).toBe("4.2");
  });

  it("macToStab is flat 7.0 Up at and below %MAC=21", () => {
    expect(macToStab("21", curve, truncateRule).value.toString()).toBe("7");
    expect(macToStab("15", curve, truncateRule).value.toString()).toBe("7");
    expect(macToStab("15", curve, truncateRule).direction).toBe("UP");
  });

  it("macToStab stays Up through the entire open interval (21, 35), only switching to Down at 35", () => {
    // At %MAC=30 (7*(35-30)/14 = 2.5): clearly still Up with a positive value.
    const midway = macToStab("30", curve, truncateRule);
    expect(midway.direction).toBe("UP");
    expect(midway.value.toString()).toBe("2.5");

    // Just below 35, the value truncates to 0.0 but direction is still Up —
    // only exactly at 35 does the source document call it Down.
    const justBelow = macToStab("34.999", curve, truncateRule);
    expect(justBelow.direction).toBe("UP");
    expect(justBelow.value.toString()).toBe("0");

    const at35 = macToStab("35", curve, truncateRule);
    expect(at35.direction).toBe("DOWN");
    expect(at35.value.toString()).toBe("0");
  });

  it("macToStab is flat 0.0 Down at and above %MAC=35", () => {
    expect(macToStab("40", curve, truncateRule).value.toString()).toBe("0");
    expect(macToStab("45", curve, truncateRule).direction).toBe("DOWN");
  });
});

describe("%MAC rounding — round-half-up, not truncate", () => {
  it("26.6904 rounds up to 26.7 (T5 692 MACTOW)", () => {
    expect(roundHalfUp(new Decimal("26.6904"), 1).toString()).toBe("26.7");
  });

  it("26.4265 rounds down to 26.4 (T5 692 MACZFW — nearest, not truncate-driven)", () => {
    expect(roundHalfUp(new Decimal("26.4265"), 1).toString()).toBe("26.4");
  });

  it("26.45 rounds up to 26.5 at the exact half boundary", () => {
    expect(roundHalfUp(new Decimal("26.45"), 1).toString()).toBe("26.5");
  });
});
