import { scenarios, scenarioCoverage } from "@tua/compare";
import { ValidationView, type ScenarioRow, type FieldDiffRow } from "./validation-view";

/**
 * Faz 14 task 4 — "Fark panosu". Reads @tua/compare's scenario library
 * directly (a workspace package, not a DB table): scenario data isn't
 * operational state, it's the validation harness's own source of truth,
 * versioned with the code in tools/compare/src/scenarios.ts.
 */
export default async function ValidationPage() {
  const coverage = scenarioCoverage();

  const scenarioRows: ScenarioRow[] = scenarios.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    status: s.status,
    summary: s.report?.summary ?? null,
  }));

  const referenceScenario = scenarios.find((s) => s.status === "REFERENCE_AVAILABLE" && s.report);
  const fieldRows: FieldDiffRow[] =
    referenceScenario?.report?.fields.map((f) => ({
      field: f.field,
      label: f.label,
      aerometaValue: f.aerometaValue,
      ourValue: f.ourValue,
      difference: f.difference,
      classification: f.classification,
      knownIssueRef: f.knownIssueRef,
      note: f.note,
    })) ?? [];

  return (
    <ValidationView
      coverage={coverage}
      scenarioRows={scenarioRows}
      referenceScenarioName={referenceScenario?.name ?? null}
      fieldRows={fieldRows}
    />
  );
}
