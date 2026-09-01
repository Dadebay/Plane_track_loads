/**
 * Converts a "wall clock" local datetime string (as produced by an HTML
 * `<input type="datetime-local">`, e.g. "2026-08-11T22:00") into the
 * correct UTC instant for a given IANA timezone.
 *
 * Flight leg times are entered as the departure/arrival STATION's local
 * time (aviation convention — STD/STA are always station-local), not the
 * browser's timezone, so this can't be a plain `new Date(string)` (which
 * would interpret the string in the runtime's own local zone).
 */

function timezoneOffsetMs(instant: Date, timeZone: string): number {
  // Reads instant's wall-clock representation in `timeZone` via
  // formatToParts (never re-parses a locale string with `new Date(...)`,
  // which would silently use the *runtime's* default zone instead of the
  // one requested — the bug in the naive "double toLocaleString" trick).
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const part of dtf.formatToParts(instant)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  const asUtcMs = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) === 24 ? 0 : Number(parts.hour), // h23 can format midnight as "24"
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtcMs - instant.getTime();
}

export function zonedTimeToUtc(localDateTime: string, timeZone: string): Date {
  const [datePart, timePart] = localDateTime.split("T");
  if (!datePart || !timePart) {
    throw new Error(`zonedTimeToUtc: invalid datetime-local value "${localDateTime}"`);
  }
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  const naiveUtcMs = Date.UTC(year!, month! - 1, day!, hour!, minute!);
  const offset = timezoneOffsetMs(new Date(naiveUtcMs), timeZone);
  return new Date(naiveUtcMs - offset);
}

/**
 * Inverse of `zonedTimeToUtc` — formats a stored UTC instant as the
 * station-local wall-clock string an `<input type="datetime-local">`
 * expects ("YYYY-MM-DDTHH:mm"), for pre-filling the edit form.
 */
export function utcToZonedTimeString(date: Date, timeZone: string): string {
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
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
}
