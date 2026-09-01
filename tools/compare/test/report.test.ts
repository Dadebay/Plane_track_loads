import { describe, expect, it } from "vitest";
import { compareFields } from "../src/field-diff";
import { renderDiffReportMarkdown } from "../src/report";
import type { FieldSpec } from "../src/types";

describe("renderDiffReportMarkdown", () => {
  const specs: FieldSpec[] = [
    { field: "ttl", label: "TTL" },
    { field: "underloadBeforeLmc", label: "UNDERLOAD BEFORE LMC" },
  ];
  const now = new Date("2026-08-11T22:00:00Z");
  const report = compareFields(
    "T5 692",
    specs,
    { ttl: "35278", underloadBeforeLmc: "24722" },
    { ttl: "35278", underloadBeforeLmc: "23678.3" },
    now,
  );

  it("includes the scenario name as a heading", () => {
    expect(renderDiffReportMarkdown(report)).toContain("### T5 692");
  });

  it("renders a markdown table row per field", () => {
    const md = renderDiffReportMarkdown(report);
    expect(md).toContain("| TTL | 35278 | 35278 | 0 | ✅ eşleşiyor | — |");
    expect(md).toContain("UNDERLOAD BEFORE LMC");
    expect(md).toContain("Bulgu #1");
  });

  it("includes the summary counts", () => {
    const md = renderDiffReportMarkdown(report);
    expect(md).toContain("2 alan");
    expect(md).toContain("1 eşleşiyor");
    expect(md).toContain("1 bizim düzeltmemiz");
  });

  it("escapes pipe characters in cell content", () => {
    const withPipe = compareFields(
      "test",
      [{ field: "note", label: "A | B" }],
      { note: "x" },
      { note: "y" },
      now,
    );
    const md = renderDiffReportMarkdown(withPipe);
    expect(md).toContain("A \\| B");
  });
});
