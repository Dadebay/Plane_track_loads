/**
 * Report runner — `pnpm --filter @tua/compare report`.
 *
 * Prints every scenario that has a reference, as the Markdown that
 * docs/VALIDATION_DOSSIER.md embeds, plus the coverage line. Exists so the
 * dossier's tables are reproducible on demand instead of being pasted in
 * by hand once: anyone can re-run this after a calculation change and see
 * whether a classification moved.
 *
 * Writes to stdout only — it never edits the dossier, because a validation
 * document is reviewed by a person before it changes. Kept out of the
 * package's public exports on purpose: importing it must not print.
 */

import { renderDiffReportMarkdown } from "./report";
import { scenarioCoverage, scenarios } from "./scenarios";

export function renderAllScenariosMarkdown(): string {
  const coverage = scenarioCoverage();
  const blocks: string[] = [
    `Kapsam: ${coverage.withReference}/${coverage.total} senaryoda referans mevcut, ` +
      `${coverage.pending} senaryo bekliyor.`,
  ];

  for (const scenario of scenarios) {
    if (scenario.status !== "REFERENCE_AVAILABLE" || !scenario.report) continue;
    blocks.push(renderDiffReportMarkdown(scenario.report));
  }

  const withoutReport = scenarios.filter((s) => s.status === "REFERENCE_AVAILABLE" && !s.report);
  for (const scenario of withoutReport) {
    blocks.push(`### ${scenario.name}\n\nReferans mevcut ama rapor üretilmemiş — scenarios.ts'i kontrol et.`);
  }

  return blocks.join("\n\n");
}

process.stdout.write(renderAllScenariosMarkdown() + "\n");
