/**
 * @tua/documents — PDF generation for LIR, Loadsheet, CG Envelope, NOTOC.
 *
 * Uses @react-pdf/renderer for deterministic, server-side PDF output.
 * Documents are always in English regardless of UI locale (CLAUDE.md rule #4).
 * Implemented in Faz 9-11. This file is the Faz 0 placeholder.
 */

export const DOCUMENTS_VERSION = "0.0.0-faz0";

export { renderScheduleListPdf, type ScheduleListFlight } from "./schedule-list";
export { renderUldListPdf, type UldListRow } from "./uld-list";
export { renderLirPdf } from "./lir/lir-document";
export type { LirInput, LirCell, LirCompartmentLimit } from "./lir/types";
export { renderLoadsheetPdf } from "./loadsheet/loadsheet-document";
export type { LoadsheetInput } from "./loadsheet/types";
export { renderEnvPdf } from "./env/env-document";
export type { EnvInput, EnvCgCurve, EnvCgPoint, EnvPlottedPoint } from "./env/types";
