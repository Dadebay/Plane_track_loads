/**
 * Liveness probe (Faz 15 task 4) — "is the process up and serving
 * requests." Deliberately checks nothing external (no DB): a dependency
 * outage should surface via /api/health/db, not make the container
 * orchestrator restart a perfectly healthy web process. Public and
 * unauthenticated — this is Docker/the load balancer, not a browser
 * session, and /api sits outside middleware.ts's auth matcher already.
 */
export async function GET(): Promise<Response> {
  return Response.json(
    {
      status: "ok",
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
