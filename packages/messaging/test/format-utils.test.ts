import { describe, expect, it } from "vitest";
import { toTypeBDate, toTypeBTime, toTypeBWeight, toTypeBText, wrapTypeBText } from "../src/format-utils";

describe("toTypeBDate", () => {
  it("converts ISO date to DDMMM", () => {
    expect(toTypeBDate("2026-08-11")).toBe("11AUG");
    expect(toTypeBDate("2026-01-05")).toBe("05JAN");
  });

  it("throws on invalid date", () => {
    expect(() => toTypeBDate("2026/08/11")).toThrow();
  });
});

describe("toTypeBTime", () => {
  it("strips the colon separator", () => {
    expect(toTypeBTime("22:00")).toBe("2200");
    expect(toTypeBTime("0930")).toBe("0930");
  });

  it("throws on invalid time", () => {
    expect(() => toTypeBTime("25:00")).toThrow();
    expect(() => toTypeBTime("9:30")).toThrow();
  });
});

describe("toTypeBWeight", () => {
  it("rounds to whole kilograms, half up", () => {
    expect(toTypeBWeight("717")).toBe("717");
    expect(toTypeBWeight("717.4")).toBe("717");
    expect(toTypeBWeight("717.5")).toBe("718");
    expect(toTypeBWeight("35278")).toBe("35278");
  });
});

describe("toTypeBText", () => {
  it("uppercases and collapses whitespace", () => {
    expect(toTypeBText("  hello   world  ")).toBe("HELLO WORLD");
  });
});

describe("wrapTypeBText", () => {
  it("does not split words, wraps at the given length", () => {
    const lines = wrapTypeBText("one two three four five", 11);
    expect(lines).toEqual(["ONE TWO", "THREE FOUR", "FIVE"]);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(11);
  });

  it("returns a single line when text fits", () => {
    expect(wrapTypeBText("short text")).toEqual(["SHORT TEXT"]);
  });
});
