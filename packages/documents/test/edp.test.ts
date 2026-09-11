import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { renderEdpPdf } from "../src/edp/edp-document";
import type { EdpInput } from "../src/edp/types";
import { header } from "./fixtures";

/** The reference EDP-LIR_T53431_10092026_ED04.pdf, as our own input. */
const loaded: Record<string, [string, string, string | null]> = {
  RR: ["URC", "1800", "PMC06599T5"],
  SS: ["URC", "1800", null],
  TT: ["URC", "1439", null],
};

function row(label: string, codes: string[]) {
  const line = (code: string) => {
    const hit = loaded[code];
    return { code, uldCode: hit?.[2] ?? null, destination: hit?.[0] ?? null, grossWeight: hit?.[1] ?? null };
  };
  return { label, lines: codes.map((code) => [line(code), null] as [ReturnType<typeof line>, null]) };
}

const input: EdpInput = {
  header: { ...header, flightNo: "T5 3431", registration: "EZ-F429", date: "2026-09-10", editionNo: "04" },
  time: "05:40",
  version: "P2F",
  from: "ASB",
  to: "URC",
  plannedLoad: [{ destination: "URC", entries: [["C", "4919"], ["Y", "nill"], ["M", "nill"]] }],
  specialInformation: "",
  sections: [
    {
      compartment: "MD",
      maxLoad: "62000",
      total: "5039",
      rows: [
        row('Single Row 88"x125"', ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "P", "R", "S", "T", "U"]),
        row('Single Row 96"x125"', ["AA", "BB", "CC", "DD", "EE", "FF", "GG", "HH", "JJ", "KK", "LL", "MM", "PP", "RR", "SS", "TT"]),
      ],
    },
  ],
  watermark: true,
};

async function sha(value: EdpInput): Promise<string> {
  return createHash("sha256").update(await renderEdpPdf(value)).digest("hex");
}

describe("renderEdpPdf", () => {
  it("renders a valid PDF", async () => {
    const buffer = await renderEdpPdf(input);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("is deterministic — the same input renders the same bytes", async () => {
    expect(await sha(input)).toBe(await sha(input));
  });

  it("changes when a position's planned load changes", async () => {
    // Content streams are compressed, so the text cannot be grepped. What
    // matters is that every field reaches the page: a changed weight must
    // change the bytes.
    const moved = structuredClone(input);
    moved.sections[0]!.rows[1]!.lines.find(([p]) => p.code === "RR")![0].grossWeight = "1801";
    expect(await sha(input)).not.toBe(await sha(moved));
  });

  it("changes when an empty position becomes loaded", async () => {
    const loadedA = structuredClone(input);
    const a = loadedA.sections[0]!.rows[0]!.lines.find(([p]) => p.code === "A")![0];
    a.destination = "URC";
    a.grossWeight = "1000";
    expect(await sha(input)).not.toBe(await sha(loadedA));
  });

  it("carries the watermark while validation is outstanding (rule #8)", async () => {
    expect(await sha({ ...input, watermark: false })).not.toBe(await sha(input));
  });

  it("fits A4", async () => {
    const text = (await renderEdpPdf(input)).toString("latin1");
    expect(text).toMatch(/MediaBox \[0 0 595\.28\d* 841\.89\d*\]/);
  });
});
