"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  DataTable,
  FilterField,
  FilterPanel,
  PageHeader,
  Pagination,
  StatusBadge,
  type DataTableColumn,
  type FlightStatus,
} from "@tua/ui";

const STATUSES: FlightStatus[] = [
  "reserved",
  "planned",
  "loading",
  "finalized",
  "departed",
  "arrived",
  "cancelled",
];

interface Row {
  id: string;
  name: string;
  value: string;
}

const ROWS: Row[] = [
  { id: "1", name: "MACZFW", value: "26,4" },
  { id: "2", name: "MACTOW", value: "26,7" },
  { id: "3", name: "STAB", value: "4,1" },
];

const columns: DataTableColumn<Row>[] = [
  { key: "name", header: "Field", render: (r) => r.name },
  { key: "value", header: "Value", render: (r) => r.value },
];

export default function ComponentsDevPage() {
  const t = useTranslations("flights.status");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  return (
    <div className="flex flex-col">
      <PageHeader title="Component showcase (dev only)" />
      <div className="flex flex-col gap-8 p-4 sm:p-6">
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-fg-muted">StatusBadge</h2>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <StatusBadge key={s} status={s}>
                {t(s)}
              </StatusBadge>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-fg-muted">FilterPanel</h2>
          <FilterPanel>
            <FilterField label="Route">
              <input className="h-9 rounded-md border border-border bg-bg px-3 text-sm" />
            </FilterField>
            <FilterField label="Flight number">
              <input className="h-9 rounded-md border border-border bg-bg px-3 text-sm" />
            </FilterField>
          </FilterPanel>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-fg-muted">
            DataTable (resize below 640px to see card mode)
          </h2>
          <div className="overflow-hidden rounded-lg border border-border">
            <DataTable columns={columns} rows={ROWS} rowKey={(r) => r.id} />
            <Pagination
              page={page}
              pageCount={1}
              total={ROWS.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              itemsPerPageLabel="Items per page"
              totalLabel="Total"
              pageLabel={(c, tt) => `Page ${c} of ${tt}`}
            />
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-fg-muted">Brand palette</h2>
          <div className="flex flex-wrap gap-1">
            {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((shade) => (
              <div
                key={shade}
                className="flex h-14 w-14 items-center justify-center rounded-md text-[10px] font-medium text-fg-on-brand"
                style={{ backgroundColor: `var(--brand-${shade})` }}
              >
                {shade}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
