import { notFound } from "next/navigation";
import { db } from "@tua/db";
import { loadAhmData } from "@tua/ahm-data";
import { AhmDetailView } from "./ahm-detail-view";

/**
 * Rendered per request, never at build time: this page reads live
 * operational data, and a statically prerendered copy would show whatever
 * the database held when the release was built. It also kept `next build`
 * from running anywhere the database is unreachable — a build should not
 * need one.
 */
export const dynamic = "force-dynamic";


export default async function AhmDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const doc = await db.ahmDocument.findUnique({ where: { id } });
  if (!doc) notFound();

  const data = loadAhmData(doc.aircraftType, doc.edition, doc.revision);

  return <AhmDetailView doc={doc} data={data} />;
}
