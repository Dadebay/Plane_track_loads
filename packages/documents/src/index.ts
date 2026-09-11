/**
 * @tua/documents — PDF generation for LIR, Loadsheet and CG Envelope.
 *
 * Uses @react-pdf/renderer for deterministic, server-side PDF output.
 * Documents are always in English regardless of UI locale (CLAUDE.md rule #4).
 * Layout data (the loading plate, the CG envelope's extent) comes from
 * @tua/wnb-core so the printed document and the on-screen workspace cannot
 * disagree; NOTOC is out of scope until dangerous-goods data exists.
 */

export const DOCUMENTS_VERSION = "0.0.0-faz0";

export { renderScheduleListPdf, type ScheduleListFlight } from "./schedule-list";
export { renderUldListPdf, type UldListRow } from "./uld-list";
export { renderLirPdf } from "./lir/lir-document";
export type { LirInput, LirCompartmentLimit } from "./lir/types";
export { renderLoadsheetPdf } from "./loadsheet/loadsheet-document";
export { renderEdpPdf } from "./edp/edp-document";
export type { EdpInput, EdpDeckSection, EdpRow, EdpLine, EdpPositionLine, EdpPlannedLoadLine } from "./edp/types";
export type { LoadsheetInput } from "./loadsheet/types";
export { renderEnvPdf } from "./env/env-document";
export type { EnvInput, EnvCgCurve, EnvCgPoint, EnvPlottedPoint } from "./env/types";
export { ENV_CHART_FRAME } from "./env/types";
export type {
  DocumentHeader,
  DocumentDeckCell,
  DocumentDeckRow,
  DocumentDeckLayout,
  DocumentUldLine,
  DocumentFuelTankLine,
} from "./shared/types";
