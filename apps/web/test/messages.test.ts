import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import ru from "../messages/ru.json";
import tk from "../messages/tk.json";

/**
 * CLAUDE.md i18n rule: tk/ru/en message files must carry an identical key
 * set. A missing key falls back to en at runtime, but that fallback should
 * never happen silently in this codebase — this test makes divergence a
 * build failure instead.
 */
function flattenKeys(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) =>
    flattenKeys(value, prefix ? `${prefix}.${key}` : key),
  );
}

describe("i18n message parity", () => {
  const enKeys = flattenKeys(en).sort();
  const ruKeys = flattenKeys(ru).sort();
  const tkKeys = flattenKeys(tk).sort();

  it("ru has the same keys as en", () => {
    expect(ruKeys).toEqual(enKeys);
  });

  it("tk has the same keys as en", () => {
    expect(tkKeys).toEqual(enKeys);
  });

  it("has a non-trivial number of keys (sanity check)", () => {
    expect(enKeys.length).toBeGreaterThan(30);
  });
});
