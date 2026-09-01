import { describe, expect, it } from "vitest";
import { buildUldCode, isValidUldCode, parseUldCode } from "../src/lib/uld-code";

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
