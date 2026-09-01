/**
 * Fixed `DD/MM/YYYY, HH:mm` formatting (CLAUDE.md — date/time display is
 * locale-independent, unlike UI strings). Built via `formatToParts` with a
 * fixed "en-US" source locale rather than `dateStyle`/`timeStyle` against
 * the active UI locale, which would (a) vary the separator/order per
 * locale and (b) silently produce wrong output in any runtime whose Intl
 * build lacks full CLDR data for that locale.
 */
export function formatDateTime(date: Date): string {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
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
