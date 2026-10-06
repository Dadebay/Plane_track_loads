import { describe, expect, it } from "vitest";
import {
  carrierPrefixOf,
  carrierPrefixes,
  flightNoSearchVariants,
  formatFlightNo,
  normalizeFlightNo,
  splitFlightNo,
} from "../src/lib/flight-number";

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

describe("carrier prefixes", () => {
  it("offers only the codes of real flight numbers", () => {
    // FUEL13ef07, TEST28175dcc and PERSd8ea4e75 are rows left by automated
    // tests; their first two characters are not a carrier.
    const prefixes = carrierPrefixes([
      "T5 692",
      "T5-767",
      "FUEL13ef07",
      "TEST28175dcc",
      "PERSd8ea4e75",
    ]);
    expect(prefixes).toEqual(["T5"]);
  });

  it("picks up a carrier the operator starts filing, without being told", () => {
    expect(carrierPrefixes(["T5 692", "FZ 1203"])).toEqual(["FZ", "T5"]);
  });

  it("reads a code off any spelling of the number", () => {
    expect(carrierPrefixOf("t5692")).toBe("T5");
    expect(carrierPrefixOf("T5-767")).toBe("T5");
    expect(carrierPrefixOf("692")).toBeNull();
  });
});
