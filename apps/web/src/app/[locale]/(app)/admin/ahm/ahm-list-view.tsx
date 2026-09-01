"use client";

import { useLocale, useTranslations } from "next-intl";
import { PageHeader, DataTable, type DataTableColumn } from "@tua/ui";
import { Link } from "@/i18n/navigation";
import type { AhmDocument } from "@tua/db";

function formatDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export function AhmListView({ documents }: { documents: AhmDocument[] }) {
  const t = useTranslations("admin.ahm");
  const locale = useLocale();

  const columns: DataTableColumn<AhmDocument>[] = [
    { key: "aircraftType", header: t("list.aircraftType"), render: (d) => d.aircraftType },
    { key: "edition", header: t("list.edition"), render: (d) => d.edition },
    { key: "revision", header: t("list.revision"), render: (d) => d.revision },
    {
      key: "effectiveDate",
      header: t("list.effectiveDate"),
      render: (d) => formatDate(d.effectiveDate, locale),
    },
    { key: "approvedBy", header: t("list.approvedBy"), render: (d) => d.approvedBy },
    {
      key: "actions",
      header: "",
      render: (d) => (
        <Link href={`/admin/ahm/${d.id}`} className="font-medium text-brand-500 hover:underline">
          {t("list.viewDetail")}
        </Link>
      ),
    },
  ];

  return (
    <div className="flex flex-col">
      <PageHeader
        title={t("title")}
        actions={
          <>
            <Link
              href="/admin/ahm/calculations"
              className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium text-fg hover:bg-bg-muted"
            >
              {t("calculations.title")}
            </Link>
            <Link
              href="/admin/ahm/diff"
              className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium text-fg hover:bg-bg-muted"
            >
              {t("list.compare")}
            </Link>
            <Link
              href="/admin/ahm/upload"
              className="inline-flex h-9 items-center rounded-md bg-brand-500 px-3 text-sm font-medium text-fg-on-brand"
            >
              {t("list.uploadNew")}
            </Link>
          </>
        }
      />
      <DataTable columns={columns} rows={documents} rowKey={(d) => d.id} emptyState={t("list.empty")} />
    </div>
  );
}
