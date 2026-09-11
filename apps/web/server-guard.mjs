/**
 * Production entry point — Next's standalone server behind a guard.
 *
 * When a browser goes away mid-response (a tab closed, a refresh during a
 * slow page, a proxy timing out) Node raises ECONNRESET/EPIPE on the
 * socket. Next 15 does not catch all of these, so they surface as
 * uncaughtException and kill the process; the pilot server accumulated
 * 311 pm2 restarts that way, each one a few seconds of downtime for
 * everyone else.
 *
 * A dropped client is not a failure of this application, so those codes
 * are logged and swallowed. Anything else still exits non-zero — a real
 * fault must not be hidden, and the process manager has to see it to
 * restart cleanly.
 *
 * Run this instead of `apps/web/server.js`; it imports it.
 */

const CLIENT_GONE = new Set(["ECONNRESET", "EPIPE", "ECONNABORTED", "ERR_STREAM_PREMATURE_CLOSE"]);

function isClientGone(error) {
  const code = error?.code ?? error?.cause?.code;
  return typeof code === "string" && CLIENT_GONE.has(code);
}

process.on("uncaughtException", (error) => {
  if (isClientGone(error)) {
    console.warn(`[server-guard] client disconnected (${error.code ?? error.cause?.code}) — ignored`);
    return;
  }
  console.error("[server-guard] uncaught exception, exiting", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  if (isClientGone(reason)) {
    console.warn("[server-guard] client disconnected during an async response — ignored");
    return;
  }
  console.error("[server-guard] unhandled rejection, exiting", reason);
  process.exit(1);
});

await import("./server.js");
