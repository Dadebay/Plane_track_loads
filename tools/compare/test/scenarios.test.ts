import { describe, expect, it } from "vitest";
import { scenarioCoverage, scenarios } from "../src/scenarios";

describe("scenarios", () => {
  it("lists the 12 scenarios IMPLEMENTATION_PLAN.md's Faz 14 requires, plus T5 477", () => {
    expect(scenarios).toHaveLength(13);
    expect(scenarios.map((s) => s.id)).toContain("t5477-mlw-limited");
  });

  it("has unique scenario ids", () => {
    const ids = scenarios.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has two scenarios with a reference report today (T5 692 and T5 477)", () => {
    const withReference = scenarios.filter((s) => s.status === "REFERENCE_AVAILABLE");
    expect(withReference.map((s) => s.id)).toEqual(["t5692-normal-load", "t5477-mlw-limited"]);
    for (const s of withReference) expect(s.report).toBeDefined();
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

  // Ed.1 Rev.2 closed Bulgu #2, so on T5 477 DOW/DOI now MATCH inside the
  // crew table's own whole-kg resolution instead of being an OUR_FIX. The
  // underload defect is unaffected and stays an OUR_FIX, an order of
  // magnitude larger than on T5 692 because MLW is the binding limit here.
  it("shows Rev.2 closing DOW/DOI on T5 477 while the underload defect remains", () => {
    const t5477 = scenarios.find((s) => s.id === "t5477-mlw-limited");
    const byField = new Map(t5477?.report?.fields.map((f) => [f.field, f]) ?? []);
    expect(byField.get("dow")?.classification).toBe("MATCH");
    expect(byField.get("doi")?.classification).toBe("MATCH");
    expect(byField.get("underloadBeforeLmc")?.classification).toBe("OUR_FIX");
    expect(byField.get("lizfw")?.classification).toBe("INVESTIGATE");
  });
});

describe("scenarioCoverage", () => {
  it("reports 2 of 13 scenarios with a reference today", () => {
    expect(scenarioCoverage()).toEqual({ total: 13, withReference: 2, pending: 11 });
  });
});
