import { describe, expect, it } from "vitest";
import { documentFilename } from "../src/lib/document-filename";

describe("documentFilename", () => {
  it("matches the convention the crew already files by", () => {
    expect(
      documentFilename({
        type: "LS",
        flightNo: "T5 3431",
        departure: new Date("2026-09-10T00:40:00Z"),
        timeZone: "Asia/Ashgabat",
        edition: 4,
      }),
    ).toBe("LS_T53431_10092026_ED04.pdf");
  });

  it("pads the edition to two digits and keeps three-digit ones intact", () => {
    const base = { flightNo: "T5 477", departure: new Date("2026-09-05T08:10:00Z"), timeZone: "Asia/Ashgabat" };
    expect(documentFilename({ ...base, type: "ENV", edition: 178 })).toBe("ENV_T5477_05092026_ED178.pdf");
    expect(documentFilename({ ...base, type: "LIR", edition: 1 })).toBe("LIR_T5477_05092026_ED01.pdf");
  });

  it("names the date in the departure station's zone, not UTC", () => {
    // 23:00 in Ashgabat (UTC+5) is already the next day in UTC; the document
    // is filed under the day it departs locally.
    const name = documentFilename({
      type: "LS",
      flightNo: "T5 692",
      departure: new Date("2026-08-11T18:00:00Z"),
      timeZone: "Asia/Ashgabat",
      edition: 1,
    });
    expect(name).toBe("LS_T5692_11082026_ED01.pdf");
  });
});
