import { Decimal } from "decimal.js";
import { d } from "./decimal-utils";
import type {
  IndexFormula,
  LateralSide,
  Position,
  PositionConfiguration,
  PositionConflict,
  PositionFootprint,
} from "./types";

/**
 * AHM 560 Appendix I s.74 — mutually exclusive loading positions.
 *
 * The plate prints the main and lower deck as a stack of alternative row
 * configurations of one physical floor: a 125" bridge position, the two 88"
 * singles it spans and the side-by-side pair of the same name are three ways
 * of using the same square metres. What the plate does NOT print is a
 * conflict matrix, so this module computes one instead of transcribing a
 * guess (see AHM560_ERRATA.md Kayıt 9).
 *
 * The computation needs two facts, both published:
 *
 *   1. the position's arm, recoverable from its index per kg because
 *      AHM 560 s.15-16 §3 defines `index = W x (arm - refSta) / C`, so
 *      `arm = refSta + C x indexPerKg`;
 *   2. the ULD's fore-aft length, printed in the configuration row's own
 *      title ("SINGLE ROW 88\" x 125\"").
 *
 * Two positions conflict when their footprints share floor on the same deck
 * and their lateral placements are not disjoint. This reproduces the plate's
 * own geometry: the lower-deck pallet pairs come out tiling exactly the
 * containers they displace, which is why 11P and 43P do not exist.
 */

/** Definition of the inch. Not an AHM constant — the plate prints ULD sizes
 * in inches and every arm in this package is metric. */
export const METRES_PER_INCH = "0.0254";

/**
 * Footprints are built from an index per kg published to five decimals, so an
 * arm carries up to ±0.0125 m of rounding. Two positions that merely abut can
 * therefore appear to overlap by up to 0.025 m. Anything at or below this is
 * treated as touching, not conflicting.
 */
export const FOOTPRINT_TOLERANCE_M = "0.05";

/** Trailing L/R on a side-by-side or half-container code, e.g. "ABL", "11R". */
function sideFromCode(code: string, placement: PositionConfiguration["lateralPlacement"]): LateralSide {
  if (placement === "CENTRE") return "CENTRE";
  if (code.endsWith("L")) return "LEFT";
  if (code.endsWith("R")) return "RIGHT";
  return "CENTRE";
}

/** Two lateral placements share floor unless one is strictly left and the
 * other strictly right. A centred ULD spans the full width. */
function lateralOverlaps(a: LateralSide, b: LateralSide): boolean {
  if (a === "CENTRE" || b === "CENTRE") return true;
  return a === b;
}

export function positionKey(uldType: string, code: string): string {
  return `${uldType}/${code}`;
}

/**
 * Derives every loadable position's fore-aft footprint, in metres from the
 * nose datum.
 *
 * Positions whose configuration has no printed ULD length (bulk) are omitted:
 * the plate gives no geometry for them and a made-up one would be an invented
 * constant (CLAUDE.md rule #3).
 *
 * Half containers are expanded here: a lower-deck row titled 60.4" x 61.5" OR
 * 60.4" x 125" takes either one full-size unit or two half-size units side by
 * side, so each such position also yields an `L` and an `R` footprint over the
 * same floor.
 */
export function buildPositionFootprints(
  positions: Position[],
  configurations: PositionConfiguration[],
  indexFormula: IndexFormula,
  halfContainerPositions: string[] = [],
): PositionFootprint[] {
  const byId = new Map(configurations.map((c) => [c.id, c]));
  const refSta = d(indexFormula.refSta);
  const c = d(indexFormula.c);
  const inch = d(METRES_PER_INCH);
  const halves = new Set(halfContainerPositions);

  const footprints: PositionFootprint[] = [];

  for (const position of positions) {
    const configuration = byId.get(position.uldType);
    if (!configuration || configuration.longitudinalInches === null) continue;

    const arm = refSta.plus(c.times(d(position.indexPerKg)));
    const halfLength = d(configuration.longitudinalInches).times(inch).dividedBy(2);
    const from = arm.minus(halfLength);
    const to = arm.plus(halfLength);

    footprints.push({
      key: positionKey(position.uldType, position.code),
      code: position.code,
      uldType: position.uldType,
      deck: position.deck,
      from: from.toString(),
      to: to.toString(),
      side: sideFromCode(position.code, configuration.lateralPlacement),
    });

    if (halves.has(position.code)) {
      for (const [suffix, side] of [
        ["L", "LEFT"],
        ["R", "RIGHT"],
      ] as const) {
        footprints.push({
          key: positionKey(position.uldType, `${position.code}${suffix}`),
          code: `${position.code}${suffix}`,
          uldType: position.uldType,
          deck: position.deck,
          from: from.toString(),
          to: to.toString(),
          side,
        });
      }
    }
  }

  return footprints;
}

function overlapLength(a: PositionFootprint, b: PositionFootprint): Decimal {
  const start = Decimal.max(d(a.from), d(b.from));
  const end = Decimal.min(d(a.to), d(b.to));
  return end.minus(start);
}

/**
 * Reports every pair of simultaneously occupied positions that shares floor.
 *
 * `occupied` are footprint keys (`uldType/code`). Keys with no footprint —
 * bulk, or a code the position data does not carry — are ignored here; the
 * caller validates position existence separately (PositionNotFoundError).
 *
 * Never throws for a conflict: like the other check functions in this package
 * it returns findings, so a live UI can show them while the controller is
 * still moving ULDs around. Blocking finalization is the server's job.
 */
export function findPositionConflicts(
  occupied: string[],
  footprints: PositionFootprint[],
): PositionConflict[] {
  const byKey = new Map(footprints.map((f) => [f.key, f]));
  const present = occupied
    .map((key) => byKey.get(key))
    .filter((f): f is PositionFootprint => f !== undefined);

  const tolerance = d(FOOTPRINT_TOLERANCE_M);
  const conflicts: PositionConflict[] = [];

  for (let i = 0; i < present.length; i += 1) {
    for (let j = i + 1; j < present.length; j += 1) {
      const a = present[i]!;
      const b = present[j]!;
      if (a.deck !== b.deck) continue;
      if (!lateralOverlaps(a.side, b.side)) continue;

      const overlap = overlapLength(a, b);
      if (overlap.lte(tolerance)) continue;

      conflicts.push({
        a: a.key,
        b: b.key,
        deck: a.deck,
        overlap: overlap.toDecimalPlaces(3).toString(),
        reason:
          `${a.key} and ${b.key} share ${overlap.toDecimalPlaces(2).toString()} m of ` +
          `${a.deck.toLowerCase()} deck floor and cannot both be loaded`,
      });
    }
  }

  return conflicts;
}

/**
 * All positions that would conflict with `candidate` if it were loaded while
 * `occupied` stays as it is. Drives "which cells must grey out" in the UI.
 */
export function conflictingPositionsFor(
  candidate: string,
  occupied: string[],
  footprints: PositionFootprint[],
): string[] {
  return findPositionConflicts([candidate, ...occupied.filter((k) => k !== candidate)], footprints)
    .filter((conflict) => conflict.a === candidate || conflict.b === candidate)
    .map((conflict) => (conflict.a === candidate ? conflict.b : conflict.a));
}
