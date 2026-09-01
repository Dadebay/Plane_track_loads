import { describe, expect, it } from "vitest";
import { encodeFbl } from "../src/fbl";
import type { FblInput } from "../src/types";

const input: FblInput = {
  station: "SGN",
  originator: { sita: "SGNDBT5" },
  awbs: [
    {
      awb: "738-12345670",
      origin: "SGN",
      destination: "ASB",
      pieces: 12,
      weight: "472",
      bookedForFlight: "T5692",
      bookedForDate: "2026-08-11",
    },
  ],
};

describe("encodeFbl", () => {
  it("starts with the FBL identifier and station", () => {
    const lines = encodeFbl(input).split("\r\n");
    expect(lines[0]).toBe("FBL");
    expect(lines[1]).toBe("SGN");
  });

  it("encodes one line per booked AWB", () => {
    const lines = encodeFbl(input).split("\r\n");
    expect(lines).toContain("738-12345670/SGNASB/12/472/T5692.11AUG");
  });
});
