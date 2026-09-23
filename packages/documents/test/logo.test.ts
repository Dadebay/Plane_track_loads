/**
 * The airline mark on a document.
 *
 * Both of these pin a fault that reached the operator's printer: a
 * document came out carrying a plain disc instead of the airline's bird.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { logoPath } from "../src/shared/logo";

const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "assets");
const BUNDLED = path.join(ASSETS, "airline-logo.png");

afterEach(() => {
  delete process.env.DOCUMENTS_LOGO_PATH;
});

describe("logoPath", () => {
  it("finds the bundled mark", () => {
    expect(logoPath()).not.toBeNull();
  });

  it("prefers an override that exists", () => {
    process.env.DOCUMENTS_LOGO_PATH = BUNDLED;
    expect(logoPath()).toBe(BUNDLED);
  });

  it("ignores an override that does not", () => {
    process.env.DOCUMENTS_LOGO_PATH = path.join(ASSETS, "no-such-file.png");
    expect(logoPath()).toBe(BUNDLED);
  });

  it("can be found from the bundle root, not only from this file", () => {
    // Webpack inlines import.meta.url as the build machine's absolute path,
    // so the module-relative candidate is gone the moment the bundle is
    // copied to a server. The standalone build carries the asset at
    // <root>/packages/documents/assets — that path has to keep working.
    const fromRoot = path.join("packages", "documents", "assets", "airline-logo.png");
    expect(existsSync(path.join(process.cwd(), "..", "..", fromRoot))).toBe(true);
  });
});

describe("the bundled mark", () => {
  it("carries no transparency", () => {
    // PNG colour type 6 is RGBA, 4 is grey+alpha. The operator's own artwork
    // is RGBA — the bird is a hole punched through the disc rather than white
    // ink — and a renderer that drops the soft mask prints something else.
    // Documents are always light, so the shipped file is flattened on white.
    const png = readFileSync(BUNDLED);
    const ihdr = png.indexOf("IHDR");
    const colourType = png[ihdr + 4 + 8 + 1]!;

    expect([4, 6]).not.toContain(colourType);
  });
});
