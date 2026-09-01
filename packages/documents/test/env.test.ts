import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { renderEnvPdf } from "../src/env/env-document";
import type { EnvInput } from "../src/env/types";

// docs/AHM560_GROUND_TRUTH.md §19 — T5 692 ZFCG (146 321.7 / 106.07) and
// TOCG (191 021.7 / 109.39); cg-limits.json's a330-243p2f/ed1-rev0 curves.
const sampleInput: EnvInput = {
  station: "SGN",
  flightNo: "T5 692",
  date: "11/08/2026",
  aircraftType: "Airbus A330-243 P2F",
  registration: "EZ-F430",
  editionNo: "01",
  preparedBy: "Bezirgen",
  checkedBy: "Checker User",

  zfwLimits: {
    forward: [
      { weight: "116000", index: "100.88" },
      { weight: "128960", index: "98.24" },
      { weight: "131759", index: "97.47" },
      { weight: "135440", index: "95.65" },
      { weight: "143000", index: "90.20" },
      { weight: "144080", index: "86.99" },
      { weight: "170000", index: "81.72" },
    ],
    aft: [
      { weight: "116000", index: "141.62" },
      { weight: "167840", index: "163.72" },
      { weight: "168920", index: "165.20" },
      { weight: "170000", index: "164.45" },
    ],
  },
  takeoffLimits: {
    forward: [
      { weight: "116000", index: "85.61" },
      { weight: "210000", index: "66.50" },
      { weight: "223364", index: "76.64" },
      { weight: "233000", index: "99.29" },
    ],
    aft: [
      { weight: "116000", index: "115.28" },
      { weight: "118200", index: "115.73" },
      { weight: "169000", index: "157.83" },
      { weight: "179000", index: "166.12" },
      { weight: "228625", index: "175.13" },
      { weight: "233000", index: "131.20" },
    ],
  },
  mlw: "182000",
  minWeight: "116000",

  zfcg: { weight: "146321.7", index: "106.07", withinEnvelope: true },
  tocg: { weight: "191021.7", index: "109.39", withinEnvelope: true },
  zfcgCorrected: null,

  watermark: true,
};

describe("renderEnvPdf", () => {
  it("renders a valid PDF without throwing", async () => {
    const buffer = await renderEnvPdf(sampleInput);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("produces byte-identical output for identical input (determinism)", async () => {
    const a = await renderEnvPdf(sampleInput);
    const b = await renderEnvPdf(sampleInput);
    const hashA = createHash("sha256").update(a).digest("hex");
    const hashB = createHash("sha256").update(b).digest("hex");
    expect(hashA).toBe(hashB);
  });

  it("produces different output when the watermark flag differs", async () => {
    const withWatermark = await renderEnvPdf({ ...sampleInput, watermark: true });
    const without = await renderEnvPdf({ ...sampleInput, watermark: false });
    expect(withWatermark.equals(without)).toBe(false);
  });

  it("produces different output for an out-of-envelope point", async () => {
    const inEnvelope = await renderEnvPdf(sampleInput);
    const outOfEnvelope = await renderEnvPdf({
      ...sampleInput,
      tocg: { ...sampleInput.tocg, withinEnvelope: false },
    });
    expect(inEnvelope.equals(outOfEnvelope)).toBe(false);
  });

  it("produces different output when a ZFCG (corrected) point is added", async () => {
    const a = await renderEnvPdf(sampleInput);
    const b = await renderEnvPdf({
      ...sampleInput,
      zfcgCorrected: { weight: "147000", index: "107.2", withinEnvelope: true },
    });
    expect(a.equals(b)).toBe(false);
  });

  it("renders on a single A4 page", async () => {
    const buffer = await renderEnvPdf(sampleInput);
    const text = buffer.toString("latin1");
    const pageCount = (text.match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
    expect(pageCount).toBe(1);
  });
});
