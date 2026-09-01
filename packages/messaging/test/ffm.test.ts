import { describe, expect, it } from "vitest";
import { encodeFfm } from "../src/ffm";
import type { FfmInput } from "../src/types";

const input: FfmInput = {
  flight: {
    flightNo: "T5692",
    date: "2026-08-11",
    origin: "SGN",
    destination: "ASB",
    aircraftRegistration: "EZ-F430",
  },
  originator: { sita: "ASBDBT5" },
  awbs: [
    { awb: "738-12345670", origin: "SGN", destination: "ASB", pieces: 12, weight: "472" },
    { awb: "738-12345689", origin: "SGN", destination: "ASB", pieces: 3, weight: "800.4", contentDescription: "general cargo" },
  ],
};

describe("encodeFfm", () => {
  it("starts with the FFM identifier and flight line", () => {
    const lines = encodeFfm(input).split("\r\n");
    expect(lines[0]).toBe("FFM");
    expect(lines[1]).toBe("T5692/11AUG.SGNASB");
  });

  it("encodes one line per AWB", () => {
    const lines = encodeFfm(input).split("\r\n");
    expect(lines).toContain("738-12345670/SGNASB/12/472");
    expect(lines).toContain("738-12345689/SGNASB/3/800/GENERAL CARGO");
  });
});
