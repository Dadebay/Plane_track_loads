import { getTranslations } from "next-intl/server";
import { db } from "@tua/db";
import { DataTable, PageHeader, type DataTableColumn } from "@tua/ui";
import { auth } from "@/auth";
import { formatDateTime } from "@/lib/format-date";

interface HistoryRow {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  at: string;
}

export default async function AccountPage() {
  const session = await auth();
  const t = await getTranslations("account");
  const tNav = await getTranslations("nav");

  if (!session?.user) return null;

  const [user, history] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: session.user.id }, include: { station: true } }),
    db.auditLog.findMany({ where: { actorId: session.user.id }, orderBy: { at: "desc" }, take: 50 }),
  ]);

  const historyRows: HistoryRow[] = history.map((h) => ({
    id: h.id,
    action: h.action,
    entity: h.entity,
    entityId: h.entityId,
    at: h.at.toISOString(),
  }));

  const columns: DataTableColumn<HistoryRow>[] = [
    { key: "action", header: t("history.action"), render: (h) => h.action },
    { key: "entity", header: t("history.entity"), render: (h) => h.entity },
    { key: "entityId", header: t("history.entityId"), render: (h) => h.entityId, hideOnCard: true },
    { key: "at", header: t("history.at"), render: (h) => `${formatDateTime(new Date(h.at))} UTC` },
  ];

  return (
    <div className="flex flex-col">
      <PageHeader title={tNav("account")} />
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <div className="flex items-center gap-4 rounded-lg border border-border p-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-500 text-lg font-semibold text-fg-on-brand">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-fg">{user.name}</p>
            <p className="truncate text-sm text-fg-subtle">{user.email}</p>
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-3 rounded-lg border border-border p-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-fg-muted">{t("fields.name")}</dt>
            <dd className="mt-0.5 text-sm text-fg">{user.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-fg-muted">{t("fields.email")}</dt>
            <dd className="mt-0.5 text-sm text-fg">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-fg-muted">{t("fields.role")}</dt>
            <dd className="mt-0.5 text-sm text-fg">{t(`roles.${user.role}`)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-fg-muted">{t("fields.station")}</dt>
            <dd className="mt-0.5 text-sm text-fg">{user.station?.name ?? t("noStation")}</dd>
          </div>
        </dl>

        <div id="history">
          <h2 className="mb-1 text-sm font-semibold text-fg">{t("history.title")}</h2>
          <p className="mb-2 text-xs text-fg-subtle">{t("history.subtitle")}</p>
          <div className="overflow-hidden rounded-lg border border-border">
            <DataTable columns={columns} rows={historyRows} rowKey={(h) => h.id} emptyState={t("history.empty")} />
          </div>
        </div>
      </div>
    </div>
  );
}
