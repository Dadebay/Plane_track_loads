import { describe, expect, it } from "vitest";
import { scenarioCoverage, scenarios } from "../src/scenarios";

describe("scenarios", () => {
  it("lists exactly the 12 scenarios IMPLEMENTATION_PLAN.md's Faz 14 requires", () => {
    expect(scenarios).toHaveLength(12);
  });

  it("has unique scenario ids", () => {
    const ids = scenarios.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has exactly one scenario with a reference report today (T5 692)", () => {
    const withReference = scenarios.filter((s) => s.status === "REFERENCE_AVAILABLE");
    expect(withReference).toHaveLength(1);
    expect(withReference[0]?.id).toBe("t5692-normal-load");
    expect(withReference[0]?.report).toBeDefined();
  });

  it("leaves the other 11 scenarios pending, with no report attached", () => {
    const pending = scenarios.filter((s) => s.status === "PENDING_REFERENCE");
    expect(pending).toHaveLength(11);
    for (const s of pending) expect(s.report).toBeUndefined();
  });

  it("classifies every known T5 692 field mismatch, none left as an unexplained INVESTIGATE except the documented LIZFW gap", () => {
    const t5692 = scenarios.find((s) => s.id === "t5692-normal-load");
    const investigateFields = t5692?.report?.fields.filter((f) => f.classification === "INVESTIGATE") ?? [];
    expect(investigateFields.map((f) => f.field)).toEqual(["lizfw"]);
  });

  it("reports the T5 692 UNDERLOAD and DOW/DOI mismatches as OUR_FIX", () => {
    const t5692 = scenarios.find((s) => s.id === "t5692-normal-load");
    const fixedFields = t5692?.report?.fields.filter((f) => f.classification === "OUR_FIX").map((f) => f.field);
    expect(fixedFields).toEqual(expect.arrayContaining(["dow", "doi", "underloadBeforeLmc"]));
  });
});

describe("scenarioCoverage", () => {
  it("reports 1 of 12 scenarios with a reference today", () => {
    expect(scenarioCoverage()).toEqual({ total: 12, withReference: 1, pending: 11 });
  });
});
