import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import en from "../messages/en.json";

/**
 * Every `t("key")` a component asks for must exist.
 *
 * A missing key is not a typo you notice: next-intl throws at render time,
 * so the first person to meet it is whoever opened that screen — which is
 * how `loadPlan.assignment.selectVariant` reached an operator as a red
 * console error instead of a label.
 *
 * This walks the source, pairs each translator variable with the namespace
 * it was created from, and checks the literal keys against en.json (the
 * three files are already held to the same key set by messages.test.ts).
 * Dynamic keys — template literals like `weekdays.${n}` — are skipped:
 * they cannot be resolved statically, and the tests that use them cover
 * their ranges instead.
 */

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

function lookup(namespace: string, key: string): boolean {
  const parts = [...namespace.split("."), ...key.split(".")].filter(Boolean);
  let node: unknown = en;
  for (const part of parts) {
    if (typeof node !== "object" || node === null || !(part in node)) return false;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string";
}

interface MissingKey {
  file: string;
  namespace: string;
  key: string;
}

function missingKeys(): MissingKey[] {
  const missing: MissingKey[] = [];

  for (const file of sourceFiles(SRC)) {
    const source = readFileSync(file, "utf-8");
    // A file may bind the same variable name to two namespaces in two
    // scopes. Which one a given call meant cannot be decided by reading
    // text, so such a name is skipped rather than guessed at — a false
    // alarm would train people to ignore this test.
    const namespaces = new Map<string, string | null>();
    for (const [, variable, namespace] of source.matchAll(
      /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*"([^"]+)"\s*\)/g,
    )) {
      const seen = namespaces.get(variable!);
      namespaces.set(variable!, seen === undefined || seen === namespace ? namespace! : null);
    }
    if (namespaces.size === 0) continue;

    for (const [variable, namespace] of namespaces) {
      if (namespace === null) continue;
      const calls = new RegExp(`\\b${variable}\\(\\s*"([^"]+)"`, "g");
      for (const [, key] of source.matchAll(calls)) {
        if (!lookup(namespace, key!)) {
          missing.push({ file: path.relative(SRC, file), namespace, key: key! });
        }
      }
    }
  }

  return missing;
}

describe("translation keys used in the app", () => {
  it("all resolve in en.json", () => {
    expect(missingKeys()).toEqual([]);
  });

  it("the scanner actually finds keys (guards against a silent no-op)", () => {
    // If the pairing regex ever stops matching, the test above would pass
    // by finding nothing at all. A known-good key proves it still reads.
    expect(lookup("loadPlan.assignment", "selectVariant")).toBe(true);
    expect(lookup("loadPlan.assignment", "definitely-not-a-key")).toBe(false);
  });
});
