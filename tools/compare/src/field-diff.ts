/**
 * Field-by-field comparator (Faz 14, plan task 1: "fark raporu — alan,
 * Aerometa değeri, bizim değerimiz, fark, değerlendirme"). Operates on
 * plain field maps, not PDF bytes — PDF text extraction is a separate,
 * not-yet-built adapter (see README); this is the part that's reusable
 * regardless of where the values came from.
 */

import { Decimal } from "decimal.js";
import { findKnownIssue } from "./known-issues";
import type { DiffReport, FieldDiff, FieldSpec } from "./types";

function tryParseDecimal(value: string): Decimal | null {
  try {
    const d = new Decimal(value);
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}

function diffOneField(
  spec: FieldSpec,
  aerometaValue: string | null,
  ourValue: string | null,
): FieldDiff {
  const knownIssue = findKnownIssue(spec.field);

  if (aerometaValue === null && ourValue === null) {
    return {
      field: spec.field,
      label: spec.label,
      aerometaValue,
      ourValue,
      difference: null,
      classification: "MATCH",
      knownIssueRef: null,
      note: "her iki tarafta da veri yok",
    };
  }

  if (aerometaValue === null || ourValue === null) {
    return {
      field: spec.field,
      label: spec.label,
      aerometaValue,
      ourValue,
      difference: null,
      classification: knownIssue ? "OUR_FIX" : "INVESTIGATE",
      knownIssueRef: knownIssue?.ref ?? null,
      note: knownIssue?.description ?? spec.investigateNote ?? "bir tarafta veri eksik",
    };
  }

  const aerometaNum = tryParseDecimal(aerometaValue);
  const ourNum = tryParseDecimal(ourValue);

  function mismatchResult(difference: string | null): FieldDiff {
    return {
      field: spec.field,
      label: spec.label,
      aerometaValue,
      ourValue,
      difference,
      classification: knownIssue ? "OUR_FIX" : "INVESTIGATE",
      knownIssueRef: knownIssue?.ref ?? null,
      note: knownIssue?.description ?? spec.investigateNote ?? null,
    };
  }

  if (aerometaNum !== null && ourNum !== null) {
    const difference = ourNum.minus(aerometaNum);
    const tolerance = new Decimal(spec.tolerance ?? "0");
    if (difference.abs().lte(tolerance)) {
      return {
        field: spec.field,
        label: spec.label,
        aerometaValue,
        ourValue,
        difference: difference.toString(),
        classification: "MATCH",
        knownIssueRef: null,
        note: null,
      };
    }
    return mismatchResult(difference.toString());
  }

  // Non-numeric fields (e.g. a status string): exact match, case/whitespace-insensitive.
  const matches = aerometaValue.trim().toUpperCase() === ourValue.trim().toUpperCase();
  if (matches) {
    return {
      field: spec.field,
      label: spec.label,
      aerometaValue,
      ourValue,
      difference: null,
      classification: "MATCH",
      knownIssueRef: null,
      note: null,
    };
  }
  return mismatchResult(null);
}

export function compareFields(
  scenarioName: string,
  specs: FieldSpec[],
  aerometaValues: Record<string, string | null>,
  ourValues: Record<string, string | null>,
  now: Date = new Date(),
): DiffReport {
  const fields = specs.map((spec) =>
    diffOneField(spec, aerometaValues[spec.field] ?? null, ourValues[spec.field] ?? null),
  );

  const summary = fields.reduce(
    (acc, f) => {
      acc.total += 1;
      if (f.classification === "MATCH") acc.match += 1;
      else if (f.classification === "OUR_FIX") acc.ourFix += 1;
      else acc.investigate += 1;
      return acc;
    },
    { total: 0, match: 0, ourFix: 0, investigate: 0 },
  );

  return {
    scenarioName,
    generatedAt: now.toISOString(),
    fields,
    summary,
  };
}
