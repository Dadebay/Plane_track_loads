import { db } from "@tua/db";
import { auth } from "@/auth";
import { readDocument } from "@/lib/document-storage";
import { documentFilename } from "@/lib/document-filename";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await auth();
  if (!session?.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { id } = await params;
  const url = new URL(request.url);
  // The eye icon previews in the browser, the arrow saves to disk. Same
  // bytes, different disposition.
  const asAttachment = url.searchParams.get("download") === "1";

  const document = await db.document.findUnique({
    where: { id },
    include: { leg: { include: { flight: true, fromStation: true } } },
  });
  if (!document) {
    return new Response(JSON.stringify({ error: "notFound" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // A Document row is insert-only, but the file store behind it is not part
  // of the database — a wiped dev volume, or a restore that missed the
  // document directory, leaves a row whose bytes are gone. Say so, instead
  // of throwing a bare 500 the caller cannot interpret.
  let buffer: Buffer;
  try {
    buffer = await readDocument(document.pdfPath);
  } catch {
    return new Response(JSON.stringify({ error: "fileMissing", pdfPath: document.pdfPath }), {
      status: 410,
      headers: { "Content-Type": "application/json" },
    });
  }
  const filename = documentFilename({
    type: document.type,
    flightNo: document.leg.flight.flightNo,
    departure: document.leg.stdDep,
    timeZone: document.leg.fromStation.timezone,
    edition: document.edition,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${asAttachment ? "attachment" : "inline"}; filename="${filename}"`,
    },
  });
}
