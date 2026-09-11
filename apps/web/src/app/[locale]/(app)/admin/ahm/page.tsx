import { db } from "@tua/db";
import { AhmListView } from "./ahm-list-view";

/**
 * Rendered per request, never at build time: this page reads live
 * operational data, and a statically prerendered copy would show whatever
 * the database held when the release was built. It also kept `next build`
 * from running anywhere the database is unreachable — a build should not
 * need one.
 */
export const dynamic = "force-dynamic";


export default async function AhmListPage() {
  const documents = await db.ahmDocument.findMany({
    orderBy: [{ aircraftType: "asc" }, { edition: "asc" }, { revision: "asc" }],
  });

  return <AhmListView documents={documents} />;
}
