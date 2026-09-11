import { createHash } from "node:crypto";
import { buildEnvelopeExtent } from "@tua/wnb-core";
import { describe, expect, it } from "vitest";
import { renderEnvPdf } from "../src/env/env-document";
import type { EnvInput } from "../src/env/types";
import { extent, header, takeoffLimits, tocg, zfcg, zfwLimits } from "./fixtures";

// docs/AHM560_GROUND_TRUTH.md §19 — T5 692 ZFCG (146 321.7 / 106.07) and
// TOCG (191 021.7 / 109.39); cg-limits.json's a330-243p2f curves.
const sampleInput: EnvInput = {
  header,
  zfwLimits,
  takeoffLimits,
  mlw: "182000",
  minWeight: "116000",
  extent,
  zfcg,
  tocg,
  zfcgCorrected: null,
  watermark: true,
};

async function sha(input: EnvInput): Promise<string> {
  return createHash("sha256").update(await renderEnvPdf(input)).digest("hex");
}

describe("renderEnvPdf", () => {
  it("renders a valid PDF without throwing", async () => {
    const buffer = await renderEnvPdf(sampleInput);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("produces byte-identical output for identical input (determinism)", async () => {
    expect(await sha(sampleInput)).toBe(await sha(sampleInput));
  });

  it("renders on a single A4 page", async () => {
    const text = (await renderEnvPdf(sampleInput)).toString("latin1");
    expect((text.match(/\/Type\s*\/Page(?!s)/g) ?? []).length).toBe(1);
    expect(text).toMatch(/MediaBox \[0 0 595\.28\d* 841\.89\d*\]/);
  });

  it("produces different output when the watermark flag differs", async () => {
    expect(await sha({ ...sampleInput, watermark: true })).not.toBe(
      await sha({ ...sampleInput, watermark: false }),
    );
  });

  it("produces different output for an out-of-envelope point", async () => {
    expect(await sha(sampleInput)).not.toBe(
      await sha({ ...sampleInput, tocg: { ...tocg, withinEnvelope: false } }),
    );
  });

  it("produces different output when a ZFCG (corrected) point is added", async () => {
    expect(await sha(sampleInput)).not.toBe(
      await sha({
        ...sampleInput,
        zfcgCorrected: { weight: "147000", index: "107.2", withinEnvelope: true },
      }),
    );
  });

  it("redraws when the extent changes — axes are data-driven, not hardcoded", async () => {
    const coarser = buildEnvelopeExtent({
      curves: [zfwLimits, takeoffLimits],
      points: [zfcg, tocg],
      weightReferences: ["182000", "116000"],
      indexStep: "25",
      weightStep: "25000",
    });
    expect(await sha(sampleInput)).not.toBe(await sha({ ...sampleInput, extent: coarser }));
  });

  it("draws two renders in parallel without one flight's extent leaking into the other", async () => {
    const wide = buildEnvelopeExtent({
      curves: [zfwLimits, takeoffLimits],
      points: [zfcg, tocg],
      indexStep: "50",
      weightStep: "50000",
    });
    const [a, b, aAgain] = await Promise.all([
      renderEnvPdf(sampleInput),
      renderEnvPdf({ ...sampleInput, extent: wide }),
      renderEnvPdf(sampleInput),
    ]);
    expect(a.equals(aAgain)).toBe(true);
    expect(a.equals(b)).toBe(false);
  });
});
