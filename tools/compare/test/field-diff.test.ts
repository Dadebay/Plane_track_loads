import { describe, expect, it } from "vitest";
import { compareFields } from "../src/field-diff";
import type { FieldSpec } from "../src/types";

describe("compareFields", () => {
  it("classifies an exact numeric match as MATCH", () => {
    const specs: FieldSpec[] = [{ field: "ttl", label: "TTL" }];
    const report = compareFields("test", specs, { ttl: "35278" }, { ttl: "35278" });

    expect(report.fields[0]?.classification).toBe("MATCH");
    expect(report.fields[0]?.difference).toBe("0");
    expect(report.summary).toEqual({ total: 1, match: 1, ourFix: 0, investigate: 0 });
  });

  it("respects a nonzero tolerance", () => {
    const specs: FieldSpec[] = [{ field: "x", label: "X", tolerance: "0.05" }];
    const report = compareFields("test", specs, { x: "100.02" }, { x: "100.00" });
    expect(report.fields[0]?.classification).toBe("MATCH");
  });

  it("classifies a mismatch matching a known issue as OUR_FIX", () => {
    const specs: FieldSpec[] = [{ field: "underloadBeforeLmc", label: "UNDERLOAD BEFORE LMC" }];
    const report = compareFields(
      "test",
      specs,
      { underloadBeforeLmc: "24722" },
      { underloadBeforeLmc: "23678.3" },
    );

    expect(report.fields[0]?.classification).toBe("OUR_FIX");
    expect(report.fields[0]?.knownIssueRef).toBe("Bulgu #1");
    expect(report.fields[0]?.difference).toBe("-1043.7");
    expect(report.summary).toEqual({ total: 1, match: 0, ourFix: 1, investigate: 0 });
  });

  it("classifies an unexplained numeric mismatch as INVESTIGATE", () => {
    const specs: FieldSpec[] = [{ field: "someNewField", label: "Some New Field" }];
    const report = compareFields("test", specs, { someNewField: "100" }, { someNewField: "105" });

    expect(report.fields[0]?.classification).toBe("INVESTIGATE");
    expect(report.fields[0]?.knownIssueRef).toBeNull();
  });

  it("surfaces investigateNote on an unexplained mismatch", () => {
    const specs: FieldSpec[] = [
      { field: "lizfw", label: "LIZFW", investigateNote: "open AHM revision question" },
    ];
    const report = compareFields("test", specs, { lizfw: "106.07" }, { lizfw: "104.97" });

    expect(report.fields[0]?.classification).toBe("INVESTIGATE");
    expect(report.fields[0]?.note).toBe("open AHM revision question");
  });

  it("treats two missing values as MATCH (nothing to compare)", () => {
    const specs: FieldSpec[] = [{ field: "lilaw", label: "LILAW" }];
    const report = compareFields("test", specs, { lilaw: null }, { lilaw: null });
    expect(report.fields[0]?.classification).toBe("MATCH");
  });

  it("classifies a one-sided missing value as a mismatch, OUR_FIX when a known issue matches", () => {
    const specs: FieldSpec[] = [{ field: "lilaw", label: "LILAW" }];
    const report = compareFields("test", specs, { lilaw: null }, { lilaw: "82.1" });

    expect(report.fields[0]?.classification).toBe("OUR_FIX");
    expect(report.fields[0]?.knownIssueRef).toBe("Bulgu #5");
  });

  it("compares non-numeric fields case/whitespace-insensitively", () => {
    const specs: FieldSpec[] = [{ field: "status", label: "STATUS" }];
    const report = compareFields("test", specs, { status: " ok " }, { status: "OK" });
    expect(report.fields[0]?.classification).toBe("MATCH");
  });

  it("is deterministic given a fixed clock", () => {
    const specs: FieldSpec[] = [{ field: "ttl", label: "TTL" }];
    const now = new Date("2026-08-11T22:00:00Z");
    const a = compareFields("test", specs, { ttl: "1" }, { ttl: "1" }, now);
    const b = compareFields("test", specs, { ttl: "1" }, { ttl: "1" }, now);
    expect(a).toEqual(b);
  });
});
