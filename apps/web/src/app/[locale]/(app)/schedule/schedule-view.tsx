"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FileDown, Pencil, Plus, Trash2 } from "lucide-react";
import { DataTable, Pagination, StatusBadge, type DataTableColumn, type FlightStatus } from "@tua/ui";
import { PageHeader } from "@/components/page-header";
import { FlightFilters, type StationOption as FilterStationOption } from "@/components/flight-filters";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import type { FlightLegRow, FlightListFilters } from "@/lib/flight-queries";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { formatDateTimePartsInZone } from "@/lib/format-date";
import { FlightFormModal, type AircraftOption, type EditingFlight, type StationOption } from "./flight-form-modal";

/** A flight as the edit modal needs it: whole flight, every leg. */
export type EditableFlight = EditingFlight;

const ISO_WEEKDAY: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

function isoWeekday(date: Date, timeZone: string): number {
  const short = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone }).format(date);
  return ISO_WEEKDAY[short] ?? 1;
}

export function ScheduleView({
  rows,
  total,
  filters,
  editableByFlightId,
  stations,
  aircraft,
  serviceTypes,
  flightNumberPrefixes,
  registrations,
}: {
  rows: FlightLegRow[];
  total: number;
  filters: FlightListFilters;
  editableByFlightId: Record<string, EditableFlight>;
  stations: FilterStationOption[];
  aircraft: AircraftOption[];
  serviceTypes: string[];
  flightNumberPrefixes: string[];
  registrations: string[];
}) {
  const t = useTranslations("flights.schedule");
  const tList = useTranslations("flights.list");
  const tCommon = useTranslations("common");
  const tStatus = useTranslations("flights.status");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedLegId, setSelectedLegId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EditingFlight | null>(null);

  function navigateWithParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSort(key: string) {
    const dir = filters.sort === key && filters.dir === "asc" ? "desc" : "asc";
    navigateWithParams((params) => {
      params.set("sort", key);
      params.set("dir", dir);
    });
  }

  /** Every timestamp in its own station's zone, labelled — a departure and
   * an arrival are in different zones, so one page-wide switch could only
   * ever be right for half the columns. */
  function formatTime(date: Date | null, timezone: string) {
    if (!date) return <span className="text-fg-subtle">—</span>;
    const parts = formatDateTimePartsInZone(new Date(date), timezone);
    return (
      <span className="flex flex-col leading-tight">
        <span>{parts.date}</span>
        <span className="text-fg-muted">
          {parts.time} ({tCommon("local")})
        </span>
      </span>
    );
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
    { key: "stdDep", header: tList("schTimeDep"), sortable: true, render: (r) => formatTime(r.stdDep, r.fromStation.timezone) },
    { key: "etdDep", header: tList("estTimeDep"), render: (r) => formatTime(r.etdDep, r.fromStation.timezone), hideOnCard: true },
    { key: "atdDep", header: tList("actTimeDep"), render: (r) => formatTime(r.atdDep, r.fromStation.timezone), hideOnCard: true },
    { key: "staArr", header: tList("schTimeArr"), render: (r) => formatTime(r.staArr, r.toStation.timezone) },
    { key: "from", header: tCommon("from"), sortable: true, render: (r) => r.fromStation.iata },
    { key: "to", header: tCommon("to"), sortable: true, render: (r) => r.toStation.iata },
    {
      key: "route",
      header: tList("routes"),
      render: (r) => `${r.fromStation.iata}${r.via ? `-${r.via}` : ""}-${r.toStation.iata}`,
    },
    { key: "flightNo", header: tList("flightNoShort"), sortable: true, render: (r) => r.flight.flightNo },
    { key: "reg", header: tList("registrationShort"), render: (r) => r.flight.aircraft.registration, hideOnCard: true },
    {
      key: "type",
      header: tCommon("type"),
      render: (r) => (
        <span title={r.flight.aircraft.type}>{r.flight.aircraft.iataTypeCode ?? r.flight.aircraft.type}</span>
      ),
      hideOnCard: true,
    },
    { key: "svcType", header: tList("serviceTypeShort"), render: (r) => r.flight.serviceType, hideOnCard: true },
    {
      key: "day",
      header: tList("day"),
      render: (r) => tCommon(`weekdays.${isoWeekday(new Date(r.stdDep), r.fromStation.timezone)}` as never),
      hideOnCard: true,
    },
    {
      key: "actions",
      header: tCommon("actions"),
      render: (r) => {
        const editable = editableByFlightId[r.flight.id];
        // Actions arm on the selected row only, the way the crew's current
        // schedule behaves: you pick the flight first, then act on it, so an
        // edit can never land on the row above the one you meant.
        const active = r.id === selectedLegId && Boolean(editable);
        return (
          <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              disabled={!active}
              onClick={() => {
                if (!editable) return;
                setEditing(editable);
                setModalOpen(true);
              }}
              aria-label={t("editFlight")}
              title={active ? t("editFlight") : t("selectRowFirst")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border text-fg-on-brand disabled:cursor-not-allowed disabled:border-border disabled:bg-transparent disabled:text-fg-subtle disabled:opacity-40 border-info bg-info"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </button>
            {/* Deleting a flight is not offered here. A flight that has been
                loaded owns load plans, calculations and documents, and those
                are INSERT-only records (CLAUDE.md rule #5); removing the
                flight under them would orphan an audit trail. Cancelling a
                flight is a status change, made through the edit form. */}
            <span
              aria-hidden="true"
              title={t("deleteUnavailable")}
              className={`inline-flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-md border ${
                active ? "border-danger bg-danger-bg text-danger opacity-60" : "border-border text-fg-subtle opacity-40"
              }`}
            >
              <Trash2 className="h-4 w-4" />
            </span>
          </span>
        );
      },
    },
  ];

  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col">
      <PageHeader
        title={t("title")}
        actions={
          <>
            <a
              href="/api/schedule/pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-fg hover:bg-bg-muted"
            >
              <FileDown className="h-4 w-4" aria-hidden="true" />
              {t("exportPdf")}
            </a>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-500 px-3 text-sm font-medium text-fg-on-brand"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("addFlight")}
            </button>
          </>
        }
      />

      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <FlightFilters
          filters={filters}
          stations={stations}
          serviceTypes={serviceTypes}
          flightNumberPrefixes={flightNumberPrefixes}
          registrations={registrations}
        />

        <div className="overflow-hidden rounded-lg border border-border">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            onRowClick={(r) => setSelectedLegId((current) => (current === r.id ? null : r.id))}
            isRowSelected={(r) => r.id === selectedLegId}
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
            onPageChange={(page) => navigateWithParams((params) => params.set("page", String(page)))}
            onPageSizeChange={(size) =>
              navigateWithParams((params) => {
                params.set("pageSize", String(size));
                params.set("page", "1");
              })
            }
            itemsPerPageLabel={tCommon("itemsPerPage")}
            totalLabel={tCommon("total")}
            pageLabel={(current, totalPages) => tCommon("page", { current, total: totalPages })}
          />
        </div>
      </div>

      {/* Mounted only while open, and keyed by what it is editing.
          The form seeds every field from `editing` in useState initialisers,
          and React runs those once per mount — so a permanently mounted
          modal kept whatever was in it the first time it appeared. Pressing
          Edit opened a blank form holding the last thing typed, with none of
          the flight's own values in it. */}
      {modalOpen ? (
        <FlightFormModal
          key={editing?.id ?? "new"}
          open
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false);
            router.refresh();
          }}
          stations={stations as unknown as StationOption[]}
          aircraft={aircraft}
          serviceTypes={serviceTypes}
          editing={editing}
        />
      ) : null}
    </div>
  );
}
