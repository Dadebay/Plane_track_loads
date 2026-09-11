/**
 * The filename a generated document is served under.
 *
 * Matches the convention the crew already files by — `LS_T53431_10092026_ED04.pdf`
 * — so a document downloaded here sorts and searches alongside the ones they
 * already hold. Four fields, underscore separated:
 *
 *   TYPE _ FLIGHTNO (no spaces) _ DDMMYYYY _ ED + two digits
 *
 * The date is the leg's scheduled departure read in the departure station's
 * own zone: that is the date printed on the document itself, and a UTC
 * reading would name a 23:00 local departure with the following day.
 */
export function documentFilename(input: {
  type: string;
  flightNo: string;
  /** Scheduled departure. */
  departure: Date;
  /** IANA zone of the departure station. */
  timeZone: string;
  edition: number;
}): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: input.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(input.departure);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const date = `${get("day")}${get("month")}${get("year")}`;

  const flightNo = input.flightNo.replace(/\s+/g, "");
  const edition = `ED${String(input.edition).padStart(2, "0")}`;

  return `${input.type}_${flightNo}_${date}_${edition}.pdf`;
}
