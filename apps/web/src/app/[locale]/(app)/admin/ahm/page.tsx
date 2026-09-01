import { db } from "@tua/db";
import { AhmListView } from "./ahm-list-view";

export default async function AhmListPage() {
  const documents = await db.ahmDocument.findMany({
    orderBy: [{ aircraftType: "asc" }, { edition: "asc" }, { revision: "asc" }],
  });

  return <AhmListView documents={documents} />;
}
