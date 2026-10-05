import { Decimal } from "decimal.js";

/**
 * Block (ramp) fuel ↔ take-off fuel.
 *
 * The refuelling slip states the fuel put *on* the aircraft — the block
 * figure, which is also what the tanks hold at the gate. The loadsheet
 * prints TAKE OFF FUEL, which is that figure less the taxi burn, because
 * taxi fuel is gone before the take-off roll (AHM 560 s.16 §3.2; the same
 * reason LITOW is computed from take-off fuel, Bulgu #8).
 *
 * Controllers were typing the slip's block figure into a field that meant
 * take-off fuel, which put 600 kg too much through TOW, landing weight and
 * taxi weight on every sheet. The fix is to take the block figure as the
 * input and subtract taxi here, so the two never have to be told apart by
 * whoever is holding the slip.
 *
 * `takeoffFuel` stays the stored canonical (one number, one place — see
 * `FuelRecord` in the Prisma schema), so these two functions are the only
 * place a block figure exists. They round-trip exactly: Decimal addition and
 * subtraction of the same taxi figure is lossless, so what was typed is what
 * is shown back.
 */

/** Taxi fuel is 600 kg on every sheet the operator has shown us, the way
 * density is 0.785 — a default to correct on the rare flight, not a figure
 * to retype on every one. Both stay editable. */
export const DEFAULT_TAXI_FUEL = "600";

function parse(value: string): Decimal | null {
  if (value.trim() === "") return null;
  try {
    const parsed = new Decimal(value);
    return parsed.isFinite() ? parsed : null;
  } catch {
    return null;
  }
}

/** Take-off fuel plus taxi fuel — what the refuelling slip calls block. */
export function blockFuelOf(takeoffFuel: string, taxiFuel: string): string {
  const takeoff = parse(takeoffFuel);
  if (takeoff === null) return "";
  return takeoff.plus(parse(taxiFuel) ?? 0).toString();
}

/** Block fuel less taxi fuel — what the loadsheet prints as TAKE OFF FUEL. */
export function takeoffFuelOf(blockFuel: string, taxiFuel: string): string {
  const block = parse(blockFuel);
  if (block === null) return "";
  return block.minus(parse(taxiFuel) ?? 0).toString();
}
