import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { renderLoadsheetPdf } from "../src/loadsheet/loadsheet-document";
import type { LoadsheetInput } from "../src/loadsheet/types";
import { header, layout, totalTrafficLoad, ulds } from "./fixtures";

// docs/AHM560_GROUND_TRUTH.md §19 — T5 692, SGN -> ASB, 2026-08-11,
// EZ-F430, with this project's own (corrected) DOW/DOI and underload.
const sampleInput: LoadsheetInput = {
  header,
  destination: "ASB",
  time: "22:00",
  version: "P2F",
  cockpitCrew: 2,
  courierCrew: 3,

  ahmEdition: 1,
  ahmRevision: 0,

  dow: "111043.7",
  doi: "78.22",
  fuelDensity: "0.785",

  passengerCount: 0,
  cabinBagWeight: "0",

  ttl: totalTrafficLoad,
  zfw: "146321.7",
  mzfw: "170000",
  takeoffFuel: "44700",
  tow: "191021.7",
  mtow: "233000",
  tripFuel: "36660",
  ldw: "154361.7",
  mlw: "182000",
  taxiFuel: "600",
  taxiWeight: "191621.7",
  mtw: "233500",

  underloadBeforeLmc: "23678.3",

  lizfw: "104.97",
  litow: "109.39",
  lilaw: "106.21",
  maczfw: "26.4",
  mactow: "26.7",
  maclaw: "26.5",
  stab: { value: "4.1", direction: "UP" },

  zfwForwardLimit: "89.2",
  zfwAftLimit: "152.4",
  towForwardLimit: "80.1",
  towAftLimit: "168.3",

  compartments: [
    { target: "main deck", actual: "12000", max: "62000", withinLimit: true },
    { target: "compartment 1", actual: "2530", max: "18869", withinLimit: true },
  ],
  layout,
  ulds,

  refuelMode: "MANUAL",
  fuelDistribution: null,

  lastMinuteChanges: [],

  specialInformation: "",
  watermark: true,
};

async function sha(input: LoadsheetInput): Promise<string> {
  return createHash("sha256").update(await renderLoadsheetPdf(input)).digest("hex");
}

describe("renderLoadsheetPdf", () => {
  it("renders a valid PDF without throwing", async () => {
    const buffer = await renderLoadsheetPdf(sampleInput);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("produces byte-identical output for identical input (determinism)", async () => {
    expect(await sha(sampleInput)).toBe(await sha(sampleInput));
  });

  it("fits the T5 692 golden load on a single A4 page", async () => {
    const text = (await renderLoadsheetPdf(sampleInput)).toString("latin1");
    expect((text.match(/\/Type\s*\/Page(?!s)/g) ?? []).length).toBe(1);
    expect(text).toMatch(/MediaBox \[0 0 595\.28\d* 841\.89\d*\]/);
  });

  it("produces different output when the watermark flag differs", async () => {
    expect(await sha({ ...sampleInput, watermark: true })).not.toBe(
      await sha({ ...sampleInput, watermark: false }),
    );
  });

  it("produces different output when MACTOW differs", async () => {
    expect(await sha(sampleInput)).not.toBe(await sha({ ...sampleInput, mactow: "27.9" }));
  });

  it("shows the AHM edition/revision it was computed against (Bulgu #2)", async () => {
    expect(await sha(sampleInput)).not.toBe(await sha({ ...sampleInput, ahmRevision: 2 }));
  });

  it("distinguishes an exceeded compartment from a compliant one", async () => {
    const exceeded: LoadsheetInput = {
      ...sampleInput,
      compartments: sampleInput.compartments.map((c) =>
        c.target === "compartment 1" ? { ...c, actual: "19000", withinLimit: false } : c,
      ),
    };
    expect(await sha(sampleInput)).not.toBe(await sha(exceeded));
  });

  it("prints per-tank fuel when an allocation exists, and says so when it does not", async () => {
    const allocated: LoadsheetInput = {
      ...sampleInput,
      refuelMode: "AUTOMATIC",
      fuelDistribution: [
        { tank: "INNER", side: "LEFT", weight: "15000" },
        { tank: "INNER", side: "RIGHT", weight: "15000" },
        { tank: "CENTRE", side: "CENTRE", weight: "14700" },
      ],
    };
    expect(await sha(sampleInput)).not.toBe(await sha(allocated));
  });

  it("prints LILAW/MACLAW, which the reference loadsheet omits (Bulgu #5)", async () => {
    expect(await sha(sampleInput)).not.toBe(await sha({ ...sampleInput, maclaw: "25.0" }));
  });

  it("renders an LMC block without throwing", async () => {
    const buffer = await renderLoadsheetPdf({
      ...sampleInput,
      lastMinuteChanges: [{ position: "ABL", weightDelta: "-717", description: "OFFLOAD" }],
    });
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
