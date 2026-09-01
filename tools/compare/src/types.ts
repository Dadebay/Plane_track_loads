/**
 * @tua/compare — shared types for the Aerometa-vs-ours comparison harness
 * (Faz 14, plan task 1: "alan alan karşılaştıran araç").
 */

export type Classification = "MATCH" | "OUR_FIX" | "INVESTIGATE";

export interface FieldSpec {
  /** Machine key, matches the key in both value maps passed to compareFields. */
  field: string;
  /** Human label for the report, e.g. "UNDERLOAD BEFORE LMC". */
  label: string;
  /**
   * Absolute numeric tolerance. Omit (or "0") for an exact match — most
   * AHM 560-derived figures (weights, %MAC, index) must match exactly;
   * a nonzero tolerance is only for values with a documented rounding
   * step on one side (e.g. a source PDF that prints fewer decimals).
   */
  tolerance?: string;
  /**
   * Context attached to a mismatch that has no known-issue match — an
   * open question rather than a resolved bug (e.g. AHM560_ERRATA.md
   * "Kayıt 6": our bottom-up AHM computation doesn't yet reproduce the
   * printed LIZFW, a genuinely unresolved data-revision question, not
   * something either side has "fixed"). Surfaced only on INVESTIGATE.
   */
  investigateNote?: string;
}

export interface FieldDiff {
  field: string;
  label: string;
  aerometaValue: string | null;
  ourValue: string | null;
  /** Numeric difference as a decimal string; null when either side is missing or non-numeric. */
  difference: string | null;
  classification: Classification;
  /** Set when a documented Aerometa bug (CLAUDE.md's known-issues table) explains a mismatch. */
  knownIssueRef: string | null;
  note: string | null;
}

export interface DiffReportSummary {
  total: number;
  match: number;
  ourFix: number;
  investigate: number;
}

export interface DiffReport {
  scenarioName: string;
  generatedAt: string;
  fields: FieldDiff[];
  summary: DiffReportSummary;
}

export type ScenarioStatus = "REFERENCE_AVAILABLE" | "PENDING_REFERENCE";

export interface TestScenario {
  id: string;
  name: string;
  description: string;
  status: ScenarioStatus;
  /** Only present once status is REFERENCE_AVAILABLE. */
  report?: DiffReport;
}
