"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Search, Trash2 } from "lucide-react";
import { DatePicker, FilterField } from "@tua/ui";
import { usePathname, useRouter } from "@/i18n/navigation";
import { StationCombobox } from "@/components/station-combobox";
import type { FlightListFilters } from "@/lib/flight-queries";
import type { ReactNode } from "react";

/**
 * The flight filter panel, shared by Flight selection and Flight schedule.
 *
 * Both pages filter the same legs with the same query, so they get the same
 * controls from one place rather than two copies that drift apart — a
 * filter that behaves differently on two screens is a support call waiting
 * to happen.
 *
 * Owns its own URL handling: filtering is a navigation, so the result is
 * shareable and survives a reload.
 */

const fieldBase = "h-11 rounded-md border border-border bg-bg px-3 text-sm text-fg sm:h-9";
const fieldClass = `${fieldBase} w-full`;

/** One bordered box of related filters, matching how the crew's current
 * system groups them. */
function FilterGroup({ legend, children }: { legend?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-bg-subtle p-3">
      {legend ? (
        <span className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">{legend}</span>
      ) : null}
      {children}
    </div>
  );
}

export interface StationOption {
  id: string;
  iata: string;
  icao: string;
  name: string;
  city?: string | null;
  country?: string | null;
}

/** Splits a stored `flightNo` filter ("T5 692") back into the two controls
 * that produce it. A value with no carrier prefix stays entirely in the
 * number box, so a filter typed before this split still round-trips. */
function splitFlightNo(value: string): { prefix: string; number: string } {
  const match = /^([A-Za-z][A-Za-z0-9])\s*(.*)$/.exec(value.trim());
  return match ? { prefix: match[1]!.toUpperCase(), number: match[2]!.trim() } : { prefix: "", number: value.trim() };
}

export function FlightFilters({
  filters,
  stations,
  serviceTypes,
  flightNumberPrefixes,
  registrations,
}: {
  filters: FlightListFilters;
  stations: StationOption[];
  serviceTypes: string[];
  flightNumberPrefixes: string[];
  registrations: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("flights.list");
  const tCommon = useTranslations("common");

  const initialFlightNo = splitFlightNo(filters.flightNo ?? "");
  const [flightNoPrefix, setFlightNoPrefix] = useState(initialFlightNo.prefix);
  const [flightNoNumber, setFlightNoNumber] = useState(initialFlightNo.number);
  const [pending, setPending] = useState({
    from: filters.from ?? "",
    via: filters.via ?? "",
    to: filters.to ?? "",
    flightNo: filters.flightNo ?? "",
    registration: filters.registration ?? "",
    dayOfWeek: filters.dayOfWeek ? String(filters.dayOfWeek) : "",
    serviceType: filters.serviceType ?? "",
    dateFrom: filters.dateFrom ?? "",
    dateTo: filters.dateTo ?? "",
  });

  const days = Array.from({ length: 7 }, (_, i) => ({
    value: i + 1,
    label: tCommon(`weekdays.${i + 1}` as never),
  }));

  function navigateWithParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    router.push(`${pathname}?${params.toString()}`);
  }

  /** Keeps the two visible controls and the single `flightNo` filter in
   * step, so only one of them is ever the source of truth. */
  function setFlightNo(prefix: string, number: string) {
    setFlightNoPrefix(prefix);
    setFlightNoNumber(number);
    setPending((p) => ({ ...p, flightNo: [prefix, number.trim()].filter(Boolean).join(" ") }));
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

  function clearFilters() {
    const empty = {
      from: "",
      via: "",
      to: "",
      flightNo: "",
      registration: "",
      dayOfWeek: "",
      serviceType: "",
      dateFrom: "",
      dateTo: "",
    };
    setPending(empty);
    setFlightNoPrefix("");
    setFlightNoNumber("");
    navigateWithParams((params) => {
      for (const key of Object.keys(empty)) params.delete(key);
      params.set("page", "1");
    });
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
      <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FilterGroup>
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
        </FilterGroup>

        <FilterGroup legend={t("routes")}>
          <FilterField inline label={tCommon("from")}>
            <StationCombobox
              value={pending.from}
              onChange={(iata) => setPending((p) => ({ ...p, from: iata }))}
              stations={stations}
              placeholder={tCommon("search")}
              allLabel={t("allStations")}
              clearLabel={tCommon("clear")}
            />
          </FilterField>
          <FilterField inline label={t("via")}>
            <StationCombobox
              value={pending.via}
              onChange={(iata) => setPending((p) => ({ ...p, via: iata }))}
              stations={stations}
              placeholder={tCommon("search")}
              allLabel={t("allStations")}
              clearLabel={tCommon("clear")}
            />
          </FilterField>
          <FilterField inline label={tCommon("to")}>
            <StationCombobox
              value={pending.to}
              onChange={(iata) => setPending((p) => ({ ...p, to: iata }))}
              stations={stations}
              placeholder={tCommon("search")}
              allLabel={t("allStations")}
              clearLabel={tCommon("clear")}
            />
          </FilterField>
        </FilterGroup>

        <FilterGroup>
          <FilterField label={t("flightNumber")}>
            {/* Carrier prefix and number are entered separately, the way
                the crew reads a flight number off a schedule, but they
                still travel as the single `flightNo` filter the server
                already understands. */}
            <span className="flex w-full gap-2">
              <select
                value={flightNoPrefix}
                onChange={(e) => setFlightNo(e.target.value, flightNoNumber)}
                aria-label={t("flightNumberPrefix")}
                className={`${fieldBase} w-20 shrink-0`}
              >
                <option value="">--</option>
                {flightNumberPrefixes.map((prefix) => (
                  <option key={prefix} value={prefix}>
                    {prefix}
                  </option>
                ))}
              </select>
              <input
                value={flightNoNumber}
                onChange={(e) => setFlightNo(flightNoPrefix, e.target.value)}
                aria-label={t("flightNumber")}
                placeholder={t("flightNumberPlaceholder")}
                inputMode="numeric"
                // min-w-0 lets it shrink inside the flex row instead of
                // forcing the row wider than the card.
                className={`${fieldBase} min-w-0 flex-1`}
              />
            </span>
          </FilterField>
          <FilterField label={t("dayOfWeek")}>
            <select
              value={pending.dayOfWeek}
              onChange={(e) => setPending((p) => ({ ...p, dayOfWeek: e.target.value }))}
              className={fieldClass}
            >
              <option value="">{t("allDays")}</option>
              {days.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </FilterField>
        </FilterGroup>

        <FilterGroup>
          <FilterField label={t("aircraftRegistration")}>
            {/* Picked from the fleet rather than typed: a mistyped
                registration is indistinguishable from "no such flights". */}
            <select
              value={pending.registration}
              onChange={(e) => setPending((p) => ({ ...p, registration: e.target.value }))}
              className={fieldClass}
            >
              <option value="">{t("allAircraft")}</option>
              {registrations.map((registration) => (
                <option key={registration} value={registration}>
                  {registration}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label={t("serviceType")}>
            <select
              value={pending.serviceType}
              onChange={(e) => setPending((p) => ({ ...p, serviceType: e.target.value }))}
              className={fieldClass}
            >
              <option value="">{t("allTypes")}</option>
              {serviceTypes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FilterField>
        </FilterGroup>
      </div>

      <div className="flex gap-2 lg:flex-col lg:justify-start">
        <button
          type="button"
          onClick={applyFilters}
          aria-label={tCommon("filter")}
          title={tCommon("filter")}
          className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md bg-brand-500 px-4 text-sm font-medium text-fg-on-brand lg:h-11 lg:w-11 lg:flex-none lg:px-0"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          <span className="lg:sr-only">{tCommon("filter")}</span>
        </button>
        <button
          type="button"
          onClick={clearFilters}
          aria-label={t("clearFilters")}
          title={t("clearFilters")}
          className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md border border-border px-4 text-sm font-medium text-fg-muted hover:bg-bg-muted hover:text-fg lg:h-11 lg:w-11 lg:flex-none lg:px-0"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          <span className="lg:sr-only">{t("clearFilters")}</span>
        </button>
      </div>
    </div>
  );
}
