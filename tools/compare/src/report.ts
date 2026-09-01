/**
 * Renders a DiffReport as a Markdown table — the format docs/
 * VALIDATION_DOSSIER.md embeds (Faz 14 plan task 3).
 */

import type { Classification, DiffReport } from "./types";

const CLASSIFICATION_LABEL: Record<Classification, string> = {
  MATCH: "✅ eşleşiyor",
  OUR_FIX: "🟢 bizim düzeltmemiz",
  INVESTIGATE: "🟡 araştırılacak",
};

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function renderDiffReportMarkdown(report: DiffReport): string {
  const lines: string[] = [];

  lines.push(`### ${report.scenarioName}`);
  lines.push("");
  lines.push(`Üretim zamanı: ${report.generatedAt}`);
  lines.push("");
  lines.push(
    `**Özet:** ${report.summary.total} alan — ${report.summary.match} eşleşiyor, ` +
      `${report.summary.ourFix} bizim düzeltmemiz, ${report.summary.investigate} araştırılacak.`,
  );
  lines.push("");
  lines.push("| Alan | Aerometa | Bizim | Fark | Değerlendirme | Not |");
  lines.push("|---|---|---|---|---|---|");

  for (const f of report.fields) {
    lines.push(
      "| " +
        [
          escapeCell(f.label),
          f.aerometaValue !== null ? escapeCell(f.aerometaValue) : "—",
          f.ourValue !== null ? escapeCell(f.ourValue) : "—",
          f.difference !== null ? escapeCell(f.difference) : "—",
          CLASSIFICATION_LABEL[f.classification] + (f.knownIssueRef ? ` (${f.knownIssueRef})` : ""),
          f.note ? escapeCell(f.note) : "—",
        ].join(" | ") +
        " |",
    );
  }

  return lines.join("\n");
}
