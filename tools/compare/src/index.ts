/**
 * @tua/compare — Aerometa-vs-ours comparison harness (Faz 14).
 *
 * PDF-based field extraction is not yet implemented: it needs real
 * Aerometa-produced reference PDFs for the 11 PENDING_REFERENCE scenarios
 * in scenarios.ts, which don't exist in this repo. What's implemented —
 * the field-diff engine, known-issue auto-classification, and the T5 692
 * scenario — works on plain field maps regardless of where the values
 * come from, so a PDF extraction adapter can be added later without
 * changing this part.
 */

export const COMPARE_VERSION = "0.0.0-faz14";

export * from "./types";
export * from "./field-diff";
export * from "./known-issues";
export * from "./report";
export * from "./scenarios";
