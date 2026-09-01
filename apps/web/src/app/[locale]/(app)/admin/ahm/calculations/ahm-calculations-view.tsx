"use client";

import { useLocale, useTranslations } from "next-intl";
import { PageHeader, DataTable, type DataTableColumn } from "@tua/ui";

export interface CalculationRow {
  id: string;
  edition: number;
  calculatedAt: Date;
  flightNo: string;
  legSeq: number;
  ahmAircraftType: string;
  ahmEdition: number;
  ahmRevision: number;
}

export function AhmCalculationsView({ rows }: { rows: CalculationRow[] }) {
  const t = useTranslations("admin.ahm");
  const locale = useLocale();

  const columns: DataTableColumn<CalculationRow>[] = [
    { key: "flightNo", header: t("calculations.flight"), render: (r) => r.flightNo },
    { key: "legSeq", header: t("calculations.leg"), render: (r) => r.legSeq },
    { key: "edition", header: t("list.edition"), render: (r) => r.edition },
    {
      key: "ahmRevision",
      header: t("calculations.ahmRevision"),
      render: (r) => `${r.ahmAircraftType} Ed.${r.ahmEdition}/Rev.${r.ahmRevision}`,
    },
    {
      key: "calculatedAt",
      header: t("calculations.calculatedAt"),
      render: (r) => new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(r.calculatedAt),
    },
  ];

  return (
    <div className="flex flex-col">
      <PageHeader title={t("calculations.title")} />
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} emptyState={t("calculations.empty")} />
    </div>
  );
}
