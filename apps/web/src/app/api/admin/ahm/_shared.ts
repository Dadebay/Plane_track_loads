/**
 * Faz 5 upload flow — shared file-validation logic for both the
 * validate-only preview step and the confirm-and-persist step. Every
 * uploaded JSON file is parsed and validated against the exact same zod
 * schemas @tua/ahm-data uses at load time (CLAUDE.md rule #3: no AHM
 * constant may bypass schema validation).
 */

import {
  AircraftDataSchema,
  IndexFormulaSchema,
  DowDoiMatrixSchema,
  FuelIndexSchema,
  CgLimitsSchema,
  CompartmentsSchema,
  PositionsSchema,
  CombinedLoadSchema,
  ZoneMappingSchema,
  UldTypesSchema,
  CrewIndexSchema,
} from "@tua/ahm-data";
import type { ZodType } from "zod";

export const REQUIRED_FILES = [
  { key: "aircraft", filename: "aircraft.json", schema: AircraftDataSchema },
  { key: "indexFormula", filename: "index-formula.json", schema: IndexFormulaSchema },
  { key: "dowDoiMatrix", filename: "dow-doi-matrix.json", schema: DowDoiMatrixSchema },
  { key: "fuelIndex", filename: "fuel-index.json", schema: FuelIndexSchema },
  { key: "cgLimits", filename: "cg-limits.json", schema: CgLimitsSchema },
  { key: "compartments", filename: "compartments.json", schema: CompartmentsSchema },
  { key: "positions", filename: "positions.json", schema: PositionsSchema },
  { key: "combinedLoad", filename: "combined-load.json", schema: CombinedLoadSchema },
  { key: "zoneMapping", filename: "zone-mapping.json", schema: ZoneMappingSchema },
  { key: "uldTypes", filename: "uld-types.json", schema: UldTypesSchema },
  { key: "crewIndex", filename: "crew-index.json", schema: CrewIndexSchema },
] as const satisfies { key: string; filename: string; schema: ZodType }[];

export interface FileValidationResult {
  key: string;
  filename: string;
  ok: boolean;
  error?: string;
  summary?: string;
}

function summarize(key: string, parsed: unknown): string {
  const p = parsed as Record<string, unknown>;
  switch (key) {
    case "aircraft":
      return `${(p.registrations as unknown[]).length} registration(s)`;
    case "indexFormula":
      return `Ref.Sta=${p.refSta}, K=${p.k}, C=${p.c}`;
    case "dowDoiMatrix": {
      const regs = Object.keys(p).filter((k) => k !== "notes" && k !== "source");
      const total = regs.reduce((acc, r) => acc + (p[r] as unknown[]).length, 0);
      return `${regs.length} registration(s), ${total} cell(s)`;
    }
    case "fuelIndex":
      return `${Object.keys(p).length} density table(s)`;
    case "cgLimits":
      return `ZFW fwd/aft, takeoff fwd/aft`;
    case "compartments":
      return `${(p.compartments as unknown[]).length} compartment(s)`;
    case "positions":
      return `${(p.positions as unknown[]).length} position(s)`;
    case "combinedLoad":
      return `${(p.zones as unknown[]).length} zone(s)`;
    case "zoneMapping":
      return `${(p.longPalletDistribution as unknown[]).length} long-pallet position(s)`;
    case "uldTypes":
      return `${(p.types as unknown[]).length} ULD type(s), ${(p.ballast as unknown[]).length} ballast entr(y/ies)`;
    case "crewIndex":
      return `cockpit + ${(p.courier as unknown[]).length} courier position(s)`;
    default:
      return "OK";
  }
}

export async function validateUploadFiles(
  formData: FormData,
): Promise<{ results: FileValidationResult[]; allOk: boolean; parsedByKey: Map<string, unknown> }> {
  const results: FileValidationResult[] = [];
  const parsedByKey = new Map<string, unknown>();

  for (const spec of REQUIRED_FILES) {
    const file = formData.get(spec.key);
    if (!(file instanceof File)) {
      results.push({ key: spec.key, filename: spec.filename, ok: false, error: "missingFile" });
      continue;
    }
    try {
      const text = await file.text();
      const json: unknown = JSON.parse(text);
      const parsed = spec.schema.parse(json);
      parsedByKey.set(spec.key, parsed);
      results.push({ key: spec.key, filename: spec.filename, ok: true, summary: summarize(spec.key, parsed) });
    } catch (err) {
      const message =
        err instanceof SyntaxError
          ? `Invalid JSON: ${err.message}`
          : err instanceof Error
            ? err.message
            : String(err);
      results.push({ key: spec.key, filename: spec.filename, ok: false, error: message });
    }
  }

  return { results, allOk: results.every((r) => r.ok), parsedByKey };
}
