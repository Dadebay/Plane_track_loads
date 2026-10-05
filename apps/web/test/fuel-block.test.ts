import { describe, expect, it } from "vitest";
import { DEFAULT_TAXI_FUEL, blockFuelOf, takeoffFuelOf } from "../src/lib/fuel-block";

describe("fuel-block", () => {
  it("prints the operator's own T5 767 figures", () => {
    // Block 41 500 off the refuelling slip, 600 taxi → TAKE OFF FUEL 40 900,
    // which is what the operator's printed sheet shows for that flight.
    expect(takeoffFuelOf("41500", "600")).toBe("40900");
    expect(blockFuelOf("40900", "600")).toBe("41500");
  });

  it("round-trips whatever was typed", () => {
    for (const block of ["0", "600", "30700", "59800", "41500.5"]) {
      expect(blockFuelOf(takeoffFuelOf(block, DEFAULT_TAXI_FUEL), DEFAULT_TAXI_FUEL)).toBe(block);
    }
  });

  it("keeps the block figure when taxi fuel changes", () => {
    const block = blockFuelOf("40900", "600");
    expect(takeoffFuelOf(block, "800")).toBe("40700");
  });

  it("stays empty while the field is empty, rather than reading as the taxi burn", () => {
    expect(takeoffFuelOf("", "600")).toBe("");
    expect(blockFuelOf("", "600")).toBe("");
  });

  it("reports a block below the taxi burn as negative take-off fuel", () => {
    expect(takeoffFuelOf("100", "600")).toBe("-500");
  });

  it("treats unusable figures as zero rather than throwing", () => {
    expect(takeoffFuelOf("41500", "abc")).toBe("41500");
    expect(blockFuelOf("-", "600")).toBe("");
  });

  it("does not drift through float arithmetic", () => {
    expect(takeoffFuelOf("0.3", "0.1")).toBe("0.2");
  });
});
