import { describe, expect, it } from "vitest";
import { buildUldCode, isValidUldCode, parseUldCode, shortUldCode } from "../src/lib/uld-code";

describe("parseUldCode", () => {
  it("parses a valid 4-digit-serial code", () => {
    expect(parseUldCode("PMC12345TU")).toEqual({ typeCode: "PMC", serial: "12345", ownerCode: "TU" });
  });

  it("parses a valid code with a 4-digit serial and 3-letter owner", () => {
    expect(parseUldCode("PAG1234TUR")).toEqual({ typeCode: "PAG", serial: "1234", ownerCode: "TUR" });
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(parseUldCode(" pmc12345tu ")).toEqual({ typeCode: "PMC", serial: "12345", ownerCode: "TU" });
  });

  it.each([
    "PM12345TU", // type code too short
    "PMC123TU", // serial too short
    "PMC123456TU", // serial too long
    "PMC12345T", // owner code too short
    "PMC12345TURK", // owner code too long
    "PMC1234A5TU", // non-numeric serial
    "",
  ])("rejects invalid code %s", (code) => {
    expect(parseUldCode(code)).toBeNull();
  });
});

describe("isValidUldCode", () => {
  it("matches parseUldCode", () => {
    expect(isValidUldCode("PMC12345TU")).toBe(true);
    expect(isValidUldCode("not-a-code")).toBe(false);
  });
});

describe("buildUldCode", () => {
  it("concatenates and normalizes parts to the IATA format", () => {
    expect(buildUldCode("pmc", "12345", "tu")).toBe("PMC12345TU");
  });

  it("round-trips through parseUldCode", () => {
    const code = buildUldCode("PAG", "20011", "TU");
    expect(parseUldCode(code)).toEqual({ typeCode: "PAG", serial: "20011", ownerCode: "TU" });
  });
});

describe("shortUldCode", () => {
  it("drops the type code the configuration row already states", () => {
    expect(shortUldCode("PMC06475T5")).toBe("06475T5");
    expect(shortUldCode("AKE12345TUA")).toBe("12345TUA");
  });

  it("leaves a code it cannot parse alone", () => {
    // Half-typed, or a unit labelled outside the convention — trimming by
    // position would hide what the controller just entered.
    expect(shortUldCode("PMC064")).toBe("PMC064");
    expect(shortUldCode("")).toBe("");
    expect(shortUldCode("06475T5")).toBe("06475T5");
  });
});

describe("owner codes that carry a digit", () => {
  it("accepts the operator's own fleet", () => {
    // Turkmenistan Airlines is T5. Every ULD on their loadsheets ends in it.
    expect(parseUldCode("PMC06475T5")).toEqual({ typeCode: "PMC", serial: "06475", ownerCode: "T5" });
    expect(isValidUldCode("PMC06683T5")).toBe(true);
  });

  it("still rejects what the digits make ambiguous", () => {
    // Each of these would parse if the owner code were allowed to start
    // with a digit: a 6-digit serial read as 5 plus "6TU", a 7-digit one
    // read as 5 plus "67", a missing designator character read as "5T".
    expect(parseUldCode("PMC123456TU")).toBeNull();
    expect(parseUldCode("PMC1234567")).toBeNull();
    expect(parseUldCode("PMC12345T")).toBeNull();
  });
});
