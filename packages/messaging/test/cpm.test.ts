import { describe, expect, it } from "vitest";
import { encodeCpmDispatch, parseCpmAcceptance } from "../src/cpm";
import type { CpmDispatchInput } from "../src/types";

const t5692: CpmDispatchInput = {
  flight: {
    flightNo: "T5692",
    date: "2026-08-11",
    origin: "SGN",
    destination: "ASB",
    aircraftRegistration: "EZ-F430",
  },
  originator: { sita: "ASBDBT5" },
  positions: [
    { position: "11", uldCode: "05185", weight: "472", contentCode: "C" },
    { position: "12P", uldCode: "06645", weight: "800", contentCode: "C" },
    { position: "52", weight: "340", contentCode: "B" },
  ],
};

describe("encodeCpmDispatch", () => {
  it("starts with the CPM identifier and flight line", () => {
    const lines = encodeCpmDispatch(t5692).split("\r\n");
    expect(lines[0]).toBe("CPM");
    expect(lines[1]).toBe("T5692/11AUG.SGNASB");
  });

  it("encodes one line per position as position/uld/weight/content", () => {
    const lines = encodeCpmDispatch(t5692).split("\r\n");
    expect(lines).toContain("11/05185/472/C");
    expect(lines).toContain("12P/06645/800/C");
  });

  it("uses NIL for a bulk position with no ULD code", () => {
    const lines = encodeCpmDispatch(t5692).split("\r\n");
    expect(lines).toContain("52/NIL/340/B");
  });

  it("is deterministic for the same input", () => {
    expect(encodeCpmDispatch(t5692)).toBe(encodeCpmDispatch(t5692));
  });
});

describe("parseCpmAcceptance", () => {
  it("round-trips an encoded CPM back into structured positions", () => {
    const text = encodeCpmDispatch(t5692);
    const parsed = parseCpmAcceptance(text);

    expect(parsed.flightNo).toBe("T5692");
    expect(parsed.date).toBe(`${new Date().getUTCFullYear()}-08-11`);
    expect(parsed.origin).toBe("SGN");
    expect(parsed.destination).toBe("ASB");
    expect(parsed.positions).toHaveLength(3);
    expect(parsed.positions[0]).toEqual({
      position: "11",
      uldCode: "05185",
      awb: null,
      weight: "472",
      contentCode: "C",
    });
    expect(parsed.positions[2].uldCode).toBeNull();
  });

  it("parses the SI free text block when present", () => {
    const withSi: CpmDispatchInput = { ...t5692, specialInformation: "handle with care" };
    const parsed = parseCpmAcceptance(encodeCpmDispatch(withSi));
    expect(parsed.specialInformation).toBe("HANDLE WITH CARE");
  });

  it("returns null special information when absent", () => {
    const parsed = parseCpmAcceptance(encodeCpmDispatch(t5692));
    expect(parsed.specialInformation).toBeNull();
  });

  it("tolerates bare LF line endings", () => {
    const text = encodeCpmDispatch(t5692).replace(/\r\n/g, "\n");
    expect(() => parseCpmAcceptance(text)).not.toThrow();
  });

  it("throws when the first line isn't CPM", () => {
    expect(() => parseCpmAcceptance("LDM\r\nT5692/11AUG.SGNASB")).toThrow();
  });

  it("throws on an unrecognized flight line", () => {
    expect(() => parseCpmAcceptance("CPM\r\nnot a flight line")).toThrow();
  });
});
