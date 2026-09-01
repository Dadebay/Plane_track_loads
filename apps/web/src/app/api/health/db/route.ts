import { db } from "@tua/db";
import { logger } from "@/lib/logger";

/**
 * Readiness probe (Faz 15 task 4) — confirms the app can actually reach
 * Postgres, not just that the process is running. Used by compose.prod.yaml's
 * dependent services and by external uptime monitoring, so failures are
 * reported as 503 (not a thrown 500) with the reason in the body.
 */
export async function GET(): Promise<Response> {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", database: "reachable" }, { status: 200 });
  } catch (error) {
    logger.error("database health check failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ status: "error", database: "unreachable" }, { status: 503 });
  }
}
