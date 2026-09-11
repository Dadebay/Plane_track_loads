"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@tua/ui";

export interface StationOption {
  id: string;
  iata: string;
  icao: string;
  name: string;
  city?: string | null;
  country?: string | null;
}

/**
 * Type-to-search station picker.
 *
 * A plain `<select>` stops being usable once the station list is longer than
 * a screen, and a plain text box lets a typo look exactly like "no flights
 * match". This is the middle: the controller types freely, but the value
 * that leaves the component is always a station that exists — picked from
 * the list, never the raw text.
 *
 * Matches on IATA, ICAO, name and city, so "ash", "ASB" and "UTAA" all find
 * Ashgabat.
 */
export function StationCombobox({
  value,
  onChange,
  stations,
  placeholder,
  allLabel,
  clearLabel,
}: {
  /** Selected station's IATA code, or "" for no filter. */
  value: string;
  onChange: (iata: string) => void;
  stations: StationOption[];
  placeholder: string;
  /** Shown as the first option, meaning "no station filter". */
  allLabel: string;
  clearLabel: string;
}) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const selected = stations.find((s) => s.iata === value) ?? null;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stations;
    return stations.filter((s) =>
      [s.iata, s.icao, s.name, s.city ?? "", s.country ?? ""].some((field) => field.toLowerCase().includes(q)),
    );
  }, [stations, query]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) close();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function close() {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }

  function commit(iata: string) {
    onChange(iata);
    close();
    inputRef.current?.blur();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      close();
      return;
    }
    if (!open && (event.key === "ArrowDown" || event.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(matches.length, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      // Index 0 is the "any station" row; the rest are stations.
      if (activeIndex === 0) commit("");
      else {
        const station = matches[activeIndex - 1];
        if (station) commit(station.iata);
      }
    }
  }

  // What the box shows: the search text while searching, otherwise the
  // chosen station's code — so a picked value stays visible like the
  // reference system's filled "ASB".
  const display = open ? query : (selected?.iata ?? "");

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={display}
        placeholder={selected ? selected.iata : placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIndex(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        className="h-11 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg sm:h-9"
      />

      {selected && !open ? (
        <button
          type="button"
          onClick={() => commit("")}
          aria-label={clearLabel}
          title={clearLabel}
          className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-fg-subtle hover:text-fg"
        >
          <span aria-hidden="true">&times;</span>
        </button>
      ) : null}

      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full min-w-64 overflow-y-auto rounded-lg border border-border bg-bg py-1 shadow-xl"
        >
          <li>
            <button
              type="button"
              role="option"
              aria-selected={value === ""}
              onMouseEnter={() => setActiveIndex(0)}
              onClick={() => commit("")}
              className={cn(
                "flex w-full px-3 py-2 text-left text-sm text-fg-muted",
                activeIndex === 0 && "bg-bg-muted",
              )}
            >
              {allLabel}
            </button>
          </li>

          {matches.map((station, index) => (
            <li key={station.id}>
              <button
                type="button"
                role="option"
                aria-selected={station.iata === value}
                onMouseEnter={() => setActiveIndex(index + 1)}
                onClick={() => commit(station.iata)}
                className={cn(
                  "flex w-full flex-col gap-0.5 px-3 py-2 text-left",
                  activeIndex === index + 1 && "bg-bg-muted",
                )}
              >
                <span className="text-sm text-fg">
                  <span className="font-mono font-semibold text-brand-600">{station.iata}</span>
                  <span className="text-fg-muted"> &ndash; </span>
                  {station.name}
                </span>
                {station.city || station.country ? (
                  <span className="text-xs text-fg-subtle">
                    {[station.city, station.country].filter(Boolean).join(", ")}
                  </span>
                ) : null}
              </button>
            </li>
          ))}

          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-fg-subtle">{placeholder}</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
