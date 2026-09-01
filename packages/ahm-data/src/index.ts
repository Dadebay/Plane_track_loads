/**
 * @tua/ahm-data — versioned, machine-readable AHM 560 data.
 *
 * Extraction happens in Faz 2 (tools/extract-ahm560). This package only
 * loads and validates the resulting JSON via zod schemas. No AHM constant
 * is ever hardcoded in TypeScript source — see CLAUDE.md rule #3.
 */

export const AHM_DATA_VERSION = "0.0.0-faz5";

export * from "./schema";
export * from "./diff";
