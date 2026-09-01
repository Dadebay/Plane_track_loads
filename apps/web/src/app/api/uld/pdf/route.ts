import { db } from "@tua/db";
import { renderUldListPdf, type UldListRow } from "@tua/documents";
import { auth } from "@/auth";

/**
 * `/uld` page's "Export PDF" action — a flat listing of the current ULD
 * stock. Sits under /api (excluded from middleware.ts's matcher), so auth
 * is checked here directly — see /api/schedule/pdf for the same pattern.
 */
export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const ulds = await db.uld.findMany({
    include: { assignedStation: true, currentStation: true, currentFlight: true },
    orderBy: { code: "asc" },
  });

  const rows: UldListRow[] = ulds.map((u) => ({
    baseplateCode: u.baseplateCode ?? "",
    code: u.code,
    typeCode: u.typeCode,
    serial: u.serial ?? "",
    ownerCode: u.ownerCode ?? "",
    assignedStation: u.assignedStation?.iata ?? "",
    currentStation: u.currentStation?.iata ?? "",
    status: u.status,
    condition: u.condition,
    flight: u.currentFlight?.flightNo ?? "",
  }));

  const buffer = await renderUldListPdf(rows);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="uld-stock-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
