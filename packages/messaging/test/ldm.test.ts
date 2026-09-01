import { describe, expect, it } from "vitest";
import { encodeLdm } from "../src/ldm";
import type { LdmInput } from "../src/types";

// T5 692, SGN->ASB, 2026-08-11 — docs/AHM560_GROUND_TRUTH.md §19.
// Compartment totals per @tua/wnb-core's checkCompartmentLimits grouping
// (leading digit of the position code): comp1 = 11+12P+13P = 472+800+835
// = 2107, comp2 = 21P+22P = 846+871 = 1717, comp3 = 31P+32P = 876+916 =
// 1792, comp4 = 41P+42P = 1003+1050 = 2053, comp5 = 52+53 = 340+340 = 680.
// Fwd (comp1+2) = 3824, aft (comp3+4) = 3845, bulk (comp5) = 680 — matches
// GROUND_TRUTH.md §19.1 exactly.
const t5692: LdmInput = {
  flight: {
    flightNo: "T5692",
    date: "2026-08-11",
    origin: "SGN",
    destination: "ASB",
    aircraftRegistration: "EZ-F430",
  },
  originator: { sita: "ASBDBT5" },
  mainDeckWeight: "26929",
  compartments: [
    { number: 1, weight: "2107" },
    { number: 2, weight: "1717" },
    { number: 3, weight: "1792" },
    { number: 4, weight: "2053" },
    { number: 5, weight: "680" },
  ],
  totalTrafficLoad: "35278",
  passengers: 0,
};

describe("encodeLdm", () => {
  it("starts with the LDM identifier line", () => {
    const text = encodeLdm(t5692);
    const lines = text.split("\r\n");
    expect(lines[0]).toBe("LDM");
  });

  it("encodes flight/date/route on the second line", () => {
    const lines = encodeLdm(t5692).split("\r\n");
    expect(lines[1]).toBe("T5692/11AUG.SGNASB");
  });

  it("lists all five compartments in ascending order", () => {
    const lines = encodeLdm(t5692).split("\r\n");
    expect(lines).toContain("COMPT 1/2107 COMPT 2/1717 COMPT 3/1792 COMPT 4/2053 COMPT 5/680");
  });

  it("reports main deck, pax and total traffic load", () => {
    const lines = encodeLdm(t5692).split("\r\n");
    expect(lines).toContain("MAINDECK/26929");
    expect(lines).toContain("PAX/0");
    expect(lines).toContain("TTL/35278");
  });

  it("omits zero-weight compartments", () => {
    const withEmptyComp: LdmInput = {
      ...t5692,
      compartments: [...t5692.compartments, { number: 6, weight: "0" }],
    };
    const lines = encodeLdm(withEmptyComp).split("\r\n");
    expect(lines.some((l) => l.includes("COMPT 6"))).toBe(false);
  });

  it("wraps a special information field under SI", () => {
    const withSi: LdmInput = { ...t5692, specialInformation: "loose cargo secured per procedure" };
    const lines = encodeLdm(withSi).split("\r\n");
    expect(lines).toContain("SI");
    expect(lines).toContain("LOOSE CARGO SECURED PER PROCEDURE");
  });

  it("appends an edition suffix to the flight line when resending", () => {
    const corrected: LdmInput = { ...t5692, editionSuffix: "A" };
    const lines = encodeLdm(corrected).split("\r\n");
    expect(lines[1]).toBe("T5692A/11AUG.SGNASB");
  });

  it("is deterministic for the same input", () => {
    expect(encodeLdm(t5692)).toBe(encodeLdm(t5692));
  });
});
