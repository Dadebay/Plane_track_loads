"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import {
  DataTable,
  DatePicker,
  FilterField,
  FilterPanel,
  PageHeader,
  Pagination,
  StatusBadge,
  type DataTableColumn,
  type FlightStatus,
} from "@tua/ui";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { FlightLegRow, FlightListFilters } from "@/lib/flight-queries";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

// Locally-shaped subset of Prisma's Station type — importing the real type
// from @tua/db (even as `import type`) risks a bundler pulling the whole
// @tua/db module graph (Prisma client + extensions) into the client
// bundle when mixed with any value import from a sibling module. See
// flight-queries.ts / pagination.ts split for the same reasoning.
interface StationOption {
  id: string;
  iata: string;
  name: string;
}

// Jan 1 2024 was a Monday — used as a stable reference date to generate
// correctly-localized weekday names for the day-of-week filter without a
// hardcoded 7-language translation table.
function weekdayOptions(locale: string): { value: number; label: string }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.UTC(2024, 0, 1 + i));
    return { value: i + 1, label: new Intl.DateTimeFormat(locale, { weekday: "long" }).format(date) };
  });
}

export function FlightsListView({
  rows,
  total,
  filters,
  stations,
  serviceTypes,
}: {
  rows: FlightLegRow[];
  total: number;
  filters: FlightListFilters;
  stations: StationOption[];
  serviceTypes: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("flights.list");
  const tCommon = useTranslations("common");
  const tStatus = useTranslations("flights.status");

  const [utcMode, setUtcMode] = useState(false);
  const [pending, setPending] = useState({
    from: filters.from ?? "",
    to: filters.to ?? "",
    flightNo: filters.flightNo ?? "",
    registration: filters.registration ?? "",
    dayOfWeek: filters.dayOfWeek ? String(filters.dayOfWeek) : "",
    serviceType: filters.serviceType ?? "",
    dateFrom: filters.dateFrom ?? "",
    dateTo: filters.dateTo ?? "",
  });

  function navigateWithParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    router.push(`${pathname}?${params.toString()}`);
  }

  function applyFilters() {
    navigateWithParams((params) => {
      for (const [key, value] of Object.entries(pending)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      params.set("page", "1");
    });
  }

  function handleSort(key: string) {
    const dir = filters.sort === key && filters.dir === "asc" ? "desc" : "asc";
    navigateWithParams((params) => {
      params.set("sort", key);
      params.set("dir", dir);
    });
  }

  function handlePageChange(page: number) {
    navigateWithParams((params) => params.set("page", String(page)));
  }

  function handlePageSizeChange(size: number) {
    navigateWithParams((params) => {
      params.set("pageSize", String(size));
      params.set("page", "1");
    });
  }

  function formatTime(date: Date | null, timezone: string): string {
    if (!date) return "—";
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: utcMode ? "UTC" : timezone,
    }).format(new Date(date));
  }

  const columns: DataTableColumn<FlightLegRow>[] = [
    {
      key: "status",
      header: tCommon("status"),
      sortable: true,
      render: (r) => {
        const status = r.flight.status.toLowerCase() as FlightStatus;
        return <StatusBadge status={status}>{tStatus(status)}</StatusBadge>;
      },
    },
    { key: "stdDep", header: t("schTimeDep"), sortable: true, render: (r) => formatTime(r.stdDep, r.fromStation.timezone) },
    { key: "etdDep", header: t("estTimeDep"), render: (r) => formatTime(r.etdDep, r.fromStation.timezone), hideOnCard: true },
    { key: "atdDep", header: t("actTimeDep"), render: (r) => formatTime(r.atdDep, r.fromStation.timezone), hideOnCard: true },
    { key: "staArr", header: t("schTimeArr"), render: (r) => formatTime(r.staArr, r.toStation.timezone) },
    { key: "from", header: tCommon("from"), sortable: true, render: (r) => r.fromStation.iata },
    { key: "to", header: tCommon("to"), sortable: true, render: (r) => r.toStation.iata },
    {
      key: "route",
      header: t("routes"),
      render: (r) => `${r.fromStation.iata}${r.via ? `-${r.via}` : ""}-${r.toStation.iata}`,
    },
    { key: "flightNo", header: t("flightNumber"), sortable: true, render: (r) => r.flight.flightNo },
    {
      key: "reg",
      header: t("aircraftRegistration"),
      render: (r) => r.flight.aircraft.registration,
      hideOnCard: true,
    },
    { key: "type", header: tCommon("type"), render: (r) => r.flight.aircraft.type, hideOnCard: true },
    { key: "svcType", header: t("serviceType"), render: (r) => r.flight.serviceType, hideOnCard: true },
  ];

  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const days = weekdayOptions(locale);

  return (
    <div className="flex flex-col">
      <PageHeader
        title={t("title")}
        actions={
          <button
            type="button"
            onClick={() => setUtcMode((m) => !m)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-fg hover:bg-bg-muted"
          >
            {utcMode ? tCommon("utc") : tCommon("local")}
          </button>
        }
      />
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <FilterPanel
          trailing={
            <button
              type="button"
              onClick={applyFilters}
              className="inline-flex h-11 items-center rounded-md bg-brand-500 px-4 text-sm font-medium text-fg-on-brand sm:h-9"
            >
              {tCommon("filter")}
            </button>
          }
        >
          <FilterField label={tCommon("from")}>
            <select
              value={pending.from}
              onChange={(e) => setPending((p) => ({ ...p, from: e.target.value }))}
              className="h-11 rounded-md border border-border bg-bg px-3 text-sm sm:h-9"
            >
              <option value="">{t("allStations")}</option>
              {stations.map((s) => (
                <option key={s.id} value={s.iata}>
                  {s.iata} — {s.name}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label={tCommon("to")}>
            <select
              value={pending.to}
              onChange={(e) => setPending((p) => ({ ...p, to: e.target.value }))}
              className="h-11 rounded-md border border-border bg-bg px-3 text-sm sm:h-9"
            >
              <option value="">{t("allStations")}</option>
              {stations.map((s) => (
                <option key={s.id} value={s.iata}>
                  {s.iata} — {s.name}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label={t("flightNumber")}>
            <input
              value={pending.flightNo}
              onChange={(e) => setPending((p) => ({ ...p, flightNo: e.target.value }))}
              placeholder="692"
              className="h-11 rounded-md border border-border bg-bg px-3 text-sm sm:h-9"
            />
          </FilterField>
          <FilterField label={t("aircraftRegistration")}>
            <input
              value={pending.registration}
              onChange={(e) => setPending((p) => ({ ...p, registration: e.target.value }))}
              placeholder="EZ-F430"
              className="h-11 rounded-md border border-border bg-bg px-3 text-sm sm:h-9"
            />
          </FilterField>
          <FilterField label={t("dayOfWeek")}>
            <select
              value={pending.dayOfWeek}
              onChange={(e) => setPending((p) => ({ ...p, dayOfWeek: e.target.value }))}
              className="h-11 rounded-md border border-border bg-bg px-3 text-sm sm:h-9"
            >
              <option value="">{t("allDays")}</option>
              {days.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label={t("serviceType")}>
            <select
              value={pending.serviceType}
              onChange={(e) => setPending((p) => ({ ...p, serviceType: e.target.value }))}
              className="h-11 rounded-md border border-border bg-bg px-3 text-sm sm:h-9"
            >
              <option value="">{t("allTypes")}</option>
              {serviceTypes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label={t("startDateTime")}>
            <DatePicker
              value={pending.dateFrom}
              onChange={(v) => setPending((p) => ({ ...p, dateFrom: v }))}
              locale={locale}
              labels={{ clear: tCommon("clear"), today: tCommon("today") }}
            />
          </FilterField>
          <FilterField label={t("endDateTime")}>
            <DatePicker
              value={pending.dateTo}
              onChange={(v) => setPending((p) => ({ ...p, dateTo: v }))}
              locale={locale}
              labels={{ clear: tCommon("clear"), today: tCommon("today") }}
            />
          </FilterField>
        </FilterPanel>

        <div className="overflow-hidden rounded-lg border border-border">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            emptyState={tCommon("noResults")}
            sortKey={filters.sort}
            sortDirection={filters.dir}
            onSort={handleSort}
          />
          <Pagination
            page={filters.page ?? 1}
            pageCount={pageCount}
            total={total}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            itemsPerPageLabel={tCommon("itemsPerPage")}
            totalLabel={tCommon("total")}
            pageLabel={(current, totalPages) => tCommon("page", { current, total: totalPages })}
          />
        </div>
      </div>
    </div>
  );
}
