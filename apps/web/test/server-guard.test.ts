import { spawn } from "node:child_process";
import { mkdtempSync, copyFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

/**
 * The guard is what keeps the pilot server up: a client that disappears
 * mid-response must not take the process with it, and a real fault must
 * still stop it so the process manager can restart cleanly.
 *
 * Tested end to end — the guard is run as its own process against a stand-in
 * `server.js`, because "does this process stay alive" cannot be asserted by
 * importing a function.
 */

const GUARD = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "server-guard.mjs");

let dir: string | null = null;

function runGuardWith(serverBody: string): Promise<{ code: number | null; output: string }> {
  dir = mkdtempSync(path.join(tmpdir(), "guard-"));
  copyFileSync(GUARD, path.join(dir, "server-guard.mjs"));
  writeFileSync(path.join(dir, "server.js"), serverBody);

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(dir!, "server-guard.mjs")], { stdio: "pipe" });
    let output = "";
    child.stdout.on("data", (chunk) => (output += String(chunk)));
    child.stderr.on("data", (chunk) => (output += String(chunk)));

    // The "survives" case never exits on its own — stop it and report that.
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ code: null, output });
    }, 3000);

    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ code, output });
    });
  });
}

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = null;
});

describe("server-guard", () => {
  it("survives a client that disconnects mid-response", async () => {
    const { code, output } = await runGuardWith(`
      setInterval(() => {}, 1000);
      setTimeout(() => {
        const err = new Error("aborted");
        err.code = "ECONNRESET";
        throw err;
      }, 100);
    `);

    expect(code).toBe(null); // still running when the test stopped it
    expect(output).toContain("client disconnected");
  }, 10_000);

  it("survives an aborted async response (unhandled rejection)", async () => {
    const { code, output } = await runGuardWith(`
      setInterval(() => {}, 1000);
      setTimeout(() => {
        const err = new Error("premature close");
        err.code = "ERR_STREAM_PREMATURE_CLOSE";
        Promise.reject(err);
      }, 100);
    `);

    expect(code).toBe(null);
    expect(output).toContain("client disconnected");
  }, 10_000);

  it("exits on a real fault so the process manager sees it", async () => {
    const { code, output } = await runGuardWith(`
      setInterval(() => {}, 1000);
      setTimeout(() => {
        throw new Error("database is on fire");
      }, 100);
    `);

    expect(code).toBe(1);
    expect(output).toContain("database is on fire");
  }, 10_000);

  it("starts the server it wraps", async () => {
    const { output } = await runGuardWith(`
      console.log("server started");
      setInterval(() => {}, 1000);
    `);

    expect(output).toContain("server started");
  }, 10_000);
});
