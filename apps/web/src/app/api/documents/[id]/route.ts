import { db } from "@tua/db";
import { auth } from "@/auth";
import { readDocument } from "@/lib/document-storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await auth();
  if (!session?.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { id } = await params;
  const document = await db.document.findUnique({ where: { id } });
  if (!document) {
    return new Response(JSON.stringify({ error: "notFound" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const buffer = await readDocument(document.pdfPath);
  const filename = `${document.type}_ED${String(document.edition).padStart(2, "0")}.pdf`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
