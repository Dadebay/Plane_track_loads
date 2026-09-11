/**
 * Visual-QA renderer — `pnpm --filter @tua/documents samples <outDir>`.
 *
 * Aşama 8's acceptance criterion is that every generated page is looked
 * at after being rendered to PNG; text extraction alone cannot show a
 * clipped header or a grid that overflows the page. This script writes
 * the sample set so that inspection is repeatable rather than a one-off:
 *
 *   pnpm --filter @tua/documents samples /tmp/qa
 *   pdftoppm -r 110 -png /tmp/qa/LS-fuel-lmc.pdf /tmp/qa/LS-fuel-lmc
 *
 * The variants deliberately cover the layout branches a normal flight
 * does not exercise: an out-of-envelope warning, an exceeded compartment,
 * a per-tank fuel allocation, an LMC block, and an empty plate.
 *
 * Output goes only where the caller asks. Nothing is written into the
 * repository, and no reference document is read — the fixtures are this
 * project's own sanitized T5 692 data (test/fixtures.ts).
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { buildEnvelopeExtent } from "@tua/wnb-core";
import { renderEnvPdf } from "../src/env/env-document";
import { renderLirPdf } from "../src/lir/lir-document";
import { renderLoadsheetPdf } from "../src/loadsheet/loadsheet-document";
import type { LirInput } from "../src/lir/types";
import type { LoadsheetInput } from "../src/loadsheet/types";
import type { EnvInput } from "../src/env/types";
import {
  compartmentLimits,
  extent,
  header,
  layout,
  takeoffLimits,
  tocg,
  totalTrafficLoad,
  ulds,
  zfcg,
  zfwLimits,
} from "../test/fixtures";

const outDir = process.argv[2] ?? "tmp/samples";

const lir: LirInput = {
  header,
  mainDeckMaxLoad: "62000",
  compartments: compartmentLimits,
  layout,
  ulds,
  totalTrafficLoad,
  specialInformation: "ULD 06154 door-side check on arrival.",
  watermark: true,
};

const loadsheet: LoadsheetInput = {
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
    { target: "compartment 3", actual: "1532", max: "15241", withinLimit: true },
    { target: "compartment 5", actual: "0", max: "3468", withinLimit: true },
  ],
  layout,
  ulds,
  refuelMode: "MANUAL",
  fuelDistribution: null,
  lastMinuteChanges: [],
  specialInformation: "",
  watermark: true,
};

const env: EnvInput = {
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

async function main(): Promise<void> {
  mkdirSync(outDir, { recursive: true });

  const samples: [string, Promise<Buffer>][] = [
    ["LIR", renderLirPdf(lir)],
    ["LIR-empty-plate", renderLirPdf({ ...lir, layout: { main: [], lower: [] }, ulds: [], totalTrafficLoad: "0" })],
    ["LS", renderLoadsheetPdf(loadsheet)],
    [
      "LS-fuel-lmc-exceeded",
      renderLoadsheetPdf({
        ...loadsheet,
        refuelMode: "AUTOMATIC",
        fuelDistribution: [
          { tank: "INNER", side: "LEFT", weight: "15000" },
          { tank: "INNER", side: "RIGHT", weight: "15000" },
          { tank: "CENTRE", side: "CENTRE", weight: "14700" },
        ],
        lastMinuteChanges: [
          { position: "ABL", weightDelta: "-717", description: "OFFLOAD" },
          { position: "PP", weightDelta: "+240", description: "ADD" },
        ],
        compartments: loadsheet.compartments.map((c) =>
          c.target === "compartment 1" ? { ...c, actual: "19000", withinLimit: false } : c,
        ),
        specialInformation: "LMC applied after doors closed; recheck trim before pushback.",
      }),
    ],
    ["ENV", renderEnvPdf(env)],
    [
      "ENV-out-of-envelope",
      renderEnvPdf({
        ...env,
        tocg: { weight: "191021.7", index: "180.4", withinEnvelope: false },
        zfcgCorrected: { weight: "147000", index: "107.2", withinEnvelope: true },
        extent: buildEnvelopeExtent({
          curves: [zfwLimits, takeoffLimits],
          points: [zfcg, { weight: "191021.7", index: "180.4" }],
          weightReferences: ["182000", "116000"],
        }),
      }),
    ],
    ["LS-no-watermark", renderLoadsheetPdf({ ...loadsheet, watermark: false })],
  ];

  for (const [name, pending] of samples) {
    writeFileSync(`${outDir}/${name}.pdf`, await pending);
    process.stdout.write(`${outDir}/${name}.pdf\n`);
  }
}

await main();
