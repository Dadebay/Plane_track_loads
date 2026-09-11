import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadAhmData } from "../src/schema";

/**
 * The deployed server found no AHM data because the bundler had inlined the
 * build machine's path. These lock the runtime resolution: an explicit
 * override wins, and a missing directory says where it looked.
 */

let dir: string | null = null;
const original = process.env.AHM_DATA_PATH;

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = null;
  if (original === undefined) delete process.env.AHM_DATA_PATH;
  else process.env.AHM_DATA_PATH = original;
});

describe("AHM data root", () => {
  it("loads the bundled data when no override is set", () => {
    delete process.env.AHM_DATA_PATH;
    expect(() => loadAhmData("a330-243p2f", 1, 0)).not.toThrow();
  });

  it("uses AHM_DATA_PATH when it points at a real directory", () => {
    dir = mkdtempSync(path.join(tmpdir(), "ahm-"));
    mkdirSync(path.join(dir, "a330-243p2f"), { recursive: true });
    process.env.AHM_DATA_PATH = dir;
    // The directory exists but holds no revision — it must be the one that
    // was searched, so the failure is about the missing revision file.
    expect(() => loadAhmData("a330-243p2f", 1, 0)).toThrow(/ENOENT|no such file/);
  });

  it("ignores an override that does not exist and falls back", () => {
    process.env.AHM_DATA_PATH = path.join(tmpdir(), "definitely-not-here-ahm");
    expect(() => loadAhmData("a330-243p2f", 1, 0)).not.toThrow();
  });
});
