/**
 * The flight service types a controller can pick from.
 *
 * A fixed catalogue rather than the distinct values already present in the
 * schedule: a type has to be offered before the first flight of that kind
 * exists, otherwise it can never be selected. `Flight.serviceType` stores
 * the label itself, so this list is also the set of legal stored values.
 *
 * Client-safe on purpose — no Prisma import — because the filter panel that
 * renders it is a client component.
 *
 * Not translated. Service type is schedule vocabulary the crew reads the
 * same way in every language, like the aviation abbreviations CLAUDE.md
 * keeps untranslated.
 */
export const SERVICE_TYPES = [
  "Scheduled intl. non-stop (passenger)",
  "Scheduled intl. non-stop (cargo)",
  "Scheduled domestic non-stop (passenger)",
  "Scheduled domestic non-stop (cargo)",
  "Charter intl. non-stop (passenger)",
  "Charter intl. non-stop (cargo)",
  "Charter domestic non-stop (passenger)",
  "Charter domestic non-stop (cargo)",
  "Scheduled intl. non-stop (mail)",
  "Scheduled domestic non-stop (mail)",
  "Charter intl. non-stop (mail)",
  "Charter domestic non-stop (mail)",
  "General Aviation",
  "Special/Other",
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

/**
 * The catalogue plus anything the schedule already stores that is not in it.
 *
 * Legacy rows exist (the seed once wrote "CARGO" and "Ferry (no cargo)").
 * Dropping those from the filter would make the flights that use them
 * unreachable, so they are appended instead of hidden.
 */
export function serviceTypeOptions(inUse: readonly string[]): string[] {
  const known = new Set<string>(SERVICE_TYPES);
  const extra = [...new Set(inUse)].filter((s) => !known.has(s)).sort();
  return [...SERVICE_TYPES, ...extra];
}
