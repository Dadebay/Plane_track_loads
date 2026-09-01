import { notFound } from "next/navigation";
import { db } from "@tua/db";
import { loadAhmData } from "@tua/ahm-data";
import { AhmDetailView } from "./ahm-detail-view";

export default async function AhmDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const doc = await db.ahmDocument.findUnique({ where: { id } });
  if (!doc) notFound();

  const data = loadAhmData(doc.aircraftType, doc.edition, doc.revision);

  return <AhmDetailView doc={doc} data={data} />;
}
