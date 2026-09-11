"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { FileText, Package } from "lucide-react";
import {
  DataTable,
  Pagination,
  StatusBadge,
  type DataTableColumn,
  type FlightStatus,
} from "@tua/ui";
import { PageHeader } from "@/components/page-header";
import { Link } from "@/i18n/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { FlightFilters } from "@/components/flight-filters";
import { FlightTimeline, type TimelineMarker } from "./flight-timeline";
import type { FlightLegRow, FlightListFilters } from "@/lib/flight-queries";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { formatDateTimePartsInZone } from "@/lib/format-date";

// Locally-shaped subset of Prisma's Station type — importing the real type
// from @tua/db (even as `import type`) risks a bundler pulling the whole
// @tua/db module graph (Prisma client + extensions) into the client
// bundle when mixed with any value import from a sibling module. See
// flight-queries.ts / pagination.ts split for the same reasoning.

interface StationOption {
  id: string;
  iata: string;
  icao: string;
  name: string;
  city?: string | null;
  country?: string | null;
}

// Weekday names come from the message files, never from Intl: browser ICU has
// no Turkmen weekday data and silently falls back to English, while Node ships
// full ICU — that mismatch produced a hydration error. `en-US` short names are
// only used as a stable key to derive the ISO day number (1 = Mon .. 7 = Sun);
// that dataset exists in every runtime, so both sides agree.
const ISO_WEEKDAY: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

function isoWeekday(date: Date, timeZone: string): number {
  const short = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone }).format(date);
  return ISO_WEEKDAY[short] ?? 1;
}

export function FlightsListView({
  rows,
  total,
  filters,
  stations,
  serviceTypes,
  flightNumberPrefixes,
  registrations,
}: {
  rows: FlightLegRow[];
  total: number;
  filters: FlightListFilters;
  stations: StationOption[];
  serviceTypes: string[];
  /** Carrier prefixes present in the schedule, e.g. ["T5"]. */
  flightNumberPrefixes: string[];
  /** Every active aircraft in the fleet. */
  registrations: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("flights.list");
  const tCommon = useTranslations("common");
  const tStatus = useTranslations("flights.status");
  const tTimeline = useTranslations("flights.timeline");

  const [selectedLegId, setSelectedLegId] = useState<string | null>(null);

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

  function handlePageChange(page: number) {
    navigateWithParams((params) => params.set("page", String(page)));
  }

  function handlePageSizeChange(size: number) {
    navigateWithParams((params) => {
      params.set("pageSize", String(size));
      params.set("page", "1");
    });
  }

  /**
   * Every timestamp is shown in its own station's local zone, with the zone
   * named on the line. There is no Local/UTC toggle on this page: a
   * departure and an arrival belong to different zones, so one page-wide
   * switch could only ever be right for half the columns. Labelling each
   * value is what keeps it unambiguous.
   */
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

  /** Weekday of the scheduled departure, read in the station's own zone —
   * a flight leaving 23:00 ASB is Saturday there even when it is already
   * Sunday in UTC. Follows the Local/UTC switch for the same reason the
   * times do. */
  function weekdayLabel(date: Date, timezone: string): string {
    return tCommon(`weekdays.${isoWeekday(new Date(date), timezone)}` as never);
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
    { key: "flightNo", header: t("flightNoShort"), sortable: true, render: (r) => r.flight.flightNo },
    {
      key: "reg",
      header: t("registrationShort"),
      render: (r) => r.flight.aircraft.registration,
      hideOnCard: true,
    },
    {
      key: "type",
      header: tCommon("type"),
      // The IATA type code the crew reads on every other system ("332"),
      // with the full model name as the tooltip. Falls back to the model
      // name for an aircraft whose code has not been entered yet.
      render: (r) => (
        <span title={r.flight.aircraft.type}>{r.flight.aircraft.iataTypeCode ?? r.flight.aircraft.type}</span>
      ),
      hideOnCard: true,
    },
    { key: "svcType", header: t("serviceTypeShort"), render: (r) => r.flight.serviceType, hideOnCard: true },
    {
      key: "day",
      header: t("day"),
      render: (r) => weekdayLabel(r.stdDep, r.fromStation.timezone),
      hideOnCard: true,
    },
    {
      key: "actions",
      header: t("actions"),
      render: (r) => (
        // Stops a click on an action from also triggering the row click.
        <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Link
            href={`/flights/${r.id}/load-plan`}
            aria-label={t("openLoadPlan", { flightNo: r.flight.flightNo })}
            title={t("openLoadPlan", { flightNo: r.flight.flightNo })}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-fg-muted hover:bg-bg-muted hover:text-fg"
          >
            <Package className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href={`/documents?legId=${r.id}`}
            aria-label={t("openDocuments", { flightNo: r.flight.flightNo })}
            title={t("openDocuments", { flightNo: r.flight.flightNo })}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-fg-muted hover:bg-bg-muted hover:text-fg"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
          </Link>
        </span>
      ),
    },
  ];

  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const selectedLeg = rows.find((r) => r.id === selectedLegId) ?? null;

  /** `T5 3431 ASB-URC 10/09/2026 05:40 (LOCAL) EZ-F430` — the line the crew
   * reads at the top of their current system's strip. */
  function timelineTitle(leg: FlightLegRow): string {
    const parts = formatDateTimePartsInZone(new Date(leg.stdDep), leg.fromStation.timezone);
    return `${leg.flight.flightNo} ${leg.fromStation.iata}-${leg.toStation.iata} ${parts.date} ${parts.time} (${tCommon("local")}) ${leg.flight.aircraft.registration}`;
  }

  /** Only timestamps the schedule holds. A leg with no actual departure
   * gets no ATD marker rather than a placeholder one. */
  function timelineMarkers(leg: FlightLegRow): TimelineMarker[] {
    const markers: TimelineMarker[] = [
      { key: "std", label: tTimeline("markers.std"), at: new Date(leg.stdDep), tone: "scheduled" },
    ];
    if (leg.etdDep) markers.push({ key: "etd", label: tTimeline("markers.etd"), at: new Date(leg.etdDep), tone: "estimated" });
    if (leg.atdDep) markers.push({ key: "atd", label: tTimeline("markers.atd"), at: new Date(leg.atdDep), tone: "actual" });
    markers.push({ key: "sta", label: tTimeline("markers.sta"), at: new Date(leg.staArr), tone: "scheduled" });
    return markers;
  }


  return (
    <div className="flex flex-col">
      <PageHeader title={t("title")} />
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        {/* Grouped the way the crew's existing system groups them — dates,
            routes, flight identity, aircraft — so the fields sit where the
            controllers already expect them. On a phone the groups stack. */}
        <FlightFilters
          filters={filters}
          stations={stations}
          serviceTypes={serviceTypes}
          flightNumberPrefixes={flightNumberPrefixes}
          registrations={registrations}
        />

        {selectedLeg ? (
          <FlightTimeline
            // Remounted per leg, so the strip re-centres on the newly
            // selected flight instead of keeping the previous pan.
            key={selectedLeg.id}
            title={timelineTitle(selectedLeg)}
            timezone={selectedLeg.fromStation.timezone}
            markers={timelineMarkers(selectedLeg)}
            onClose={() => setSelectedLegId(null)}
            openLoadPlanLabel={t("openLoadPlanShort")}
            onOpenLoadPlan={() => router.push(`/flights/${selectedLeg.id}/load-plan`)}
          />
        ) : null}

        <div className="overflow-hidden rounded-lg border border-border">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            // A click selects the leg and opens its timeline above the
            // table. Opening the load plan stays an explicit action — the
            // button on the timeline, or the icon in the action column — so
            // inspecting a flight never navigates away by accident.
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
