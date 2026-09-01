import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { renderLirPdf } from "../src/lir/lir-document";
import type { LirInput } from "../src/lir/types";

const sampleInput: LirInput = {
  station: "SGN",
  flightNo: "T5 692",
  date: "11/08/2026",
  aircraftType: "Airbus A330-243 P2F",
  registration: "EZ-F430",
  editionNo: "01",
  preparedBy: "Bezirgen",
  checkedBy: "Checker User",
  mainDeckMaxLoad: "62000",
  compartments: [
    { number: 1, description: "FWD", lirSubLimit: "18869" },
    { number: 5, description: "BULK", lirSubLimit: "3468" },
  ],
  cells: [
    { code: "ABL", deck: "MAIN", maxGross: "2000", uldCode: "06154", awb: null, weight: "717" },
    { code: "ABR", deck: "MAIN", maxGross: "2000", uldCode: "06115", awb: null, weight: "834" },
    { code: "C", deck: "MAIN", maxGross: "2826", uldCode: null, awb: null, weight: null },
    { code: "11", deck: "LOWER", maxGross: "3174", uldCode: "05185", awb: null, weight: "472" },
    { code: "52", deck: "LOWER", maxGross: "1413", uldCode: null, awb: null, weight: "340" },
  ],
  specialInformation: "Handle with care.",
  watermark: true,
};

describe("renderLirPdf", () => {
  it("renders a valid PDF without throwing", async () => {
    const buffer = await renderLirPdf(sampleInput);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("produces byte-identical output for identical input (determinism)", async () => {
    const a = await renderLirPdf(sampleInput);
    const b = await renderLirPdf(sampleInput);
    const hashA = createHash("sha256").update(a).digest("hex");
    const hashB = createHash("sha256").update(b).digest("hex");
    expect(hashA).toBe(hashB);
  });

  it("produces different output when the watermark flag differs", async () => {
    const withWatermark = await renderLirPdf({ ...sampleInput, watermark: true });
    const without = await renderLirPdf({ ...sampleInput, watermark: false });
    expect(withWatermark.equals(without)).toBe(false);
  });

  it("produces different output when a cell's weight differs", async () => {
    const a = await renderLirPdf(sampleInput);
    const changed: LirInput = {
      ...sampleInput,
      cells: sampleInput.cells.map((c) => (c.code === "ABL" ? { ...c, weight: "999" } : c)),
    };
    const b = await renderLirPdf(changed);
    expect(a.equals(b)).toBe(false);
  });
});
