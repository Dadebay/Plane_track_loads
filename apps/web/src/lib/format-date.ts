/**
 * Fixed `DD/MM/YYYY` formatting (CLAUDE.md — date display is
 * locale-independent, unlike UI strings). Reads UTC fields directly rather
 * than going through `Intl.DateTimeFormat` against the active UI locale,
 * which would (a) vary the separator/order per locale and (b) produce a
 * server/client hydration mismatch in any runtime whose Intl build lacks
 * full CLDR data for that locale (e.g. Node's default small-icu for "tk").
 */
export function formatDate(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getUTCFullYear()}`;
}

/**
 * Fixed `DD/MM/YYYY, HH:mm` formatting (CLAUDE.md — date/time display is
 * locale-independent, unlike UI strings). Built via `formatToParts` with a
 * fixed "en-US" source locale rather than `dateStyle`/`timeStyle` against
 * the active UI locale, which would (a) vary the separator/order per
 * locale and (b) silently produce wrong output in any runtime whose Intl
 * build lacks full CLDR data for that locale.
 */
export function formatDateTime(date: Date): string {
  return formatDateTimeInZone(date, "UTC");
}

/**
 * Same `DD/MM/YYYY, HH:mm` formatting as {@link formatDateTime}, but in a
 * caller-supplied IANA time zone instead of a fixed UTC — for views with a
 * Local/UTC toggle (CLAUDE.md: the Local/UTC key must always stay visible).
 * `timeZone` left `undefined` falls back to the runtime's own zone, which
 * is only safe for client-only rendering (never a value read during SSR).
 */
export function formatDateTimeInZone(date: Date, timeZone?: string): string {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  return `${parts.day}/${parts.month}/${parts.year}, ${parts.hour}:${parts.minute}`;
}

/**
 * The same instant split into its two printed lines: `DD/MM/YYYY` and
 * `HH:mm`, in a caller-supplied IANA zone.
 *
 * Kept separate from {@link formatDateTimeInZone} so a table can stack the
 * date over the time and label the zone on the time line — the flight list
 * shows every timestamp in the station's own zone, so each one has to say
 * so rather than relying on a single toggle somewhere else on the page.
 */
export function formatDateTimePartsInZone(date: Date, timeZone?: string): { date: string; time: string } {
  const [datePart, timePart] = formatDateTimeInZone(date, timeZone).split(", ");
  return { date: datePart ?? "", time: timePart ?? "" };
}
