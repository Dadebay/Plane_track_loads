/**
 * Kept in its own module (no @tua/db import) so client components can use
 * it without pulling Prisma/the db client into the browser bundle — see
 * flight-queries.ts, which is server-only.
 */
export const DEFAULT_PAGE_SIZE = 10;
