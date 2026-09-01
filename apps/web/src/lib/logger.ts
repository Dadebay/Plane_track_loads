/**
 * Structured JSON logging (Faz 15 task 5). No external dependency: one
 * JSON object per line on stdout/stderr, which is what every container
 * log collector (Docker, Hetzner, Cloudflare) expects without extra
 * configuration.
 *
 * Error tracking is `captureError` — it logs a structured "error" event
 * today. Wiring it to an external service (Sentry or similar) is a single
 * function body change here; nothing else in the app needs to know.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  [key: string]: unknown;
}

function write(level: LogLevel, message: string, fields?: LogFields): void {
  const entry = {
    time: new Date().toISOString(),
    level,
    msg: message,
    ...fields,
  };
  const line = JSON.stringify(entry);
  if (level === "error" || level === "warn") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (message: string, fields?: LogFields) => write("debug", message, fields),
  info: (message: string, fields?: LogFields) => write("info", message, fields),
  warn: (message: string, fields?: LogFields) => write("warn", message, fields),
  error: (message: string, fields?: LogFields) => write("error", message, fields),
};

/**
 * Records an unexpected error with structured context. Always logs; also
 * the integration point for an external error tracker (Sentry, etc.) —
 * add the SDK call here once the operator decides on one (CLAUDE.md rule
 * #1 doesn't apply to apps/web, only wnb-core, so this is a fine place
 * for a framework/vendor dependency later).
 */
export function captureError(error: unknown, context?: LogFields): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  write("error", message, { ...context, stack });
}
