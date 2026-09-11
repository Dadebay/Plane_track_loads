import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { renderLirPdf } from "../src/lir/lir-document";
import type { LirInput } from "../src/lir/types";
import { compartmentLimits, header, layout } from "./fixtures";

const sampleInput: LirInput = {
  header,
  mainDeckMaxLoad: "62000",
  compartments: compartmentLimits,
  layout,
  specialInformation: "Handle with care.",
  watermark: true,
};

async function sha(input: LirInput): Promise<string> {
  return createHash("sha256").update(await renderLirPdf(input)).digest("hex");
}

describe("renderLirPdf", () => {
  it("renders a valid PDF without throwing", async () => {
    const buffer = await renderLirPdf(sampleInput);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("produces byte-identical output for identical input (determinism)", async () => {
    expect(await sha(sampleInput)).toBe(await sha(sampleInput));
  });

  it("stays on a single A4 page for a full plate", async () => {
    const buffer = await renderLirPdf(sampleInput);
    const text = buffer.toString("latin1");
    expect((text.match(/\/Type\s*\/Page(?!s)/g) ?? []).length).toBe(1);
    // A4 in PDF points, as @react-pdf writes the MediaBox.
    expect(text).toMatch(/MediaBox \[0 0 595\.28\d* 841\.89\d*\]/);
  });

  it("produces different output when the watermark flag differs", async () => {
    expect(await sha({ ...sampleInput, watermark: true })).not.toBe(
      await sha({ ...sampleInput, watermark: false }),
    );
  });

  it("produces different output when a position's weight differs", async () => {
    const changed: LirInput = {
      ...sampleInput,
      layout: {
        ...sampleInput.layout,
        main: sampleInput.layout.main.map((row) => ({
          ...row,
          cells: row.cells.map((cell) => (cell.code === "ABL" ? { ...cell, weight: "999" } : cell)),
        })),
      },
    };
    expect(await sha(sampleInput)).not.toBe(await sha(changed));
  });

  it("produces different output when a cell becomes blocked", async () => {
    const changed: LirInput = {
      ...sampleInput,
      layout: {
        ...sampleInput.layout,
        lower: sampleInput.layout.lower.map((row) => ({
          ...row,
          cells: row.cells.map((cell) => (cell.code === "53" ? { ...cell, blocked: true } : cell)),
        })),
      },
    };
    expect(await sha(sampleInput)).not.toBe(await sha(changed));
  });

  it("prints the ULD identifier in its position, not just the weight", async () => {
    // The plate is how a loader finds a container; a cell that shows only a
    // weight cannot be checked against what is on the ramp.
    const renamed: LirInput = {
      ...sampleInput,
      layout: {
        ...sampleInput.layout,
        main: sampleInput.layout.main.map((row) => ({
          ...row,
          cells: row.cells.map((cell) => (cell.uldCode ? { ...cell, uldCode: "PMC00000T5" } : cell)),
        })),
      },
    };
    expect(await sha(sampleInput)).not.toBe(await sha(renamed));
  });

  it("renders an empty plate without throwing", async () => {
    const buffer = await renderLirPdf({
      ...sampleInput,
      layout: { main: [], lower: [] },
    });
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
