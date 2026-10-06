import { describe, expect, it } from "vitest";
import { flightNoSearchVariants, formatFlightNo, normalizeFlightNo, splitFlightNo } from "../src/lib/flight-number";

describe("flight-number", () => {
  it("splits the spellings a controller actually types", () => {
    expect(splitFlightNo("T5-692")).toEqual({ prefix: "T5", number: "692" });
    expect(splitFlightNo("T5 692")).toEqual({ prefix: "T5", number: "692" });
    expect(splitFlightNo("t5692")).toEqual({ prefix: "T5", number: "692" });
  });

  it("leaves a bare number in the number box", () => {
    expect(splitFlightNo("692")).toEqual({ prefix: "", number: "692" });
  });

  it("stores one spelling whichever was typed", () => {
    for (const typed of ["T5-692", "T5 692", "t5 692", "  T5   692 "]) {
      expect(normalizeFlightNo(typed)).toBe("T5 692");
    }
  });

  it("does not decorate a number that has no carrier", () => {
    expect(formatFlightNo("", "692")).toBe("692");
  });

  it("finds a flight filed before the form was fixed", () => {
    // The filter builds "T5 692"; rows written as "T5-692" or "T5692" are
    // the same flight and have to come back.
    expect(flightNoSearchVariants("T5 692")).toEqual(["T5 692", "T5692", "T5-692"]);
  });

  it("searches for a bare number as itself", () => {
    expect(flightNoSearchVariants("692")).toEqual(["692"]);
    expect(flightNoSearchVariants("")).toEqual([]);
  });
});
