import { describe, expect, it } from "vitest";
import { loadAhmData } from "../src/schema";

// AHM 560 Ed.1 Rev.2 s.6 §III — the only page transcribed for Rev.2 so far.
// See data/a330-243p2f/ed1-rev2/PROVENANCE.md for what is inherited from Rev.0.
describe("AHM 560 Ed.1 Rev.2", () => {
  const rev2 = loadAhmData("a330-243p2f", 1, 2);
  const rev0 = loadAhmData("a330-243p2f", 1, 0);

  it("declares itself as edition 1 revision 2, valid from 10.06.2025", () => {
    expect(rev2.aircraft.edition).toBe(1);
    expect(rev2.aircraft.revision).toBe(2);
    expect(rev2.aircraft.effectiveDate).toBe("2025-06-10");
  });

  it("has a full 4x7 crew matrix for both registrations", () => {
    for (const reg of ["EZ-F429", "EZ-F430"] as const) {
      const cells = rev2.dowDoiMatrix[reg];
      expect(cells).toHaveLength(28);
      for (let cockpit = 1; cockpit <= 4; cockpit++) {
        for (let courier = 0; courier <= 6; courier++) {
          expect(
            cells.filter((c) => c.cockpitCrew === cockpit && c.courierCrew === courier),
          ).toHaveLength(1);
        }
      }
    }
  });

  // Remark on s.6: courier crew weight including baggage is 80 kg,
  // cockpit crew weight including baggage is 100 kg. The DOW table must
  // step by exactly those amounts — a strong transcription check.
  it("steps DOW by 80 kg per courier and 100 kg per cockpit occupant", () => {
    for (const reg of ["EZ-F429", "EZ-F430"] as const) {
      const at = (cockpit: number, courier: number) =>
        Number(rev2.dowDoiMatrix[reg].find((c) => c.cockpitCrew === cockpit && c.courierCrew === courier)!.dow);
      for (let cockpit = 1; cockpit <= 4; cockpit++) {
        for (let courier = 1; courier <= 6; courier++) {
          expect(at(cockpit, courier) - at(cockpit, courier - 1)).toBe(80);
        }
      }
      for (let cockpit = 2; cockpit <= 4; cockpit++) {
        for (let courier = 0; courier <= 6; courier++) {
          expect(at(cockpit, courier) - at(cockpit - 1, courier)).toBe(100);
        }
      }
    }
  });

  // GROUND_TRUTH.md Bulgu #2: the T5 692 loadsheet printed DOW 111043.70 /
  // DOI 78.22 for EZ-F430 crew 2/3. Rev.0 said 111720 / 77.74 (676 kg out);
  // Rev.2 lands within the whole-kg rounding of the printed table.
  it("closes Bulgu #2 for EZ-F430 crew 2/3", () => {
    const cell = rev2.dowDoiMatrix["EZ-F430"].find((c) => c.cockpitCrew === 2 && c.courierCrew === 3)!;
    expect(cell.dow).toBe("111044");
    expect(cell.doi).toBe("78.19");
    expect(Math.abs(Number(cell.dow) - 111043.7)).toBeLessThan(1);
    expect(Math.abs(Number(cell.doi) - 78.22)).toBeLessThan(0.05);

    const old = rev0.dowDoiMatrix["EZ-F430"].find((c) => c.cockpitCrew === 2 && c.courierCrew === 3)!;
    expect(Math.abs(Number(old.dow) - 111043.7)).toBeGreaterThan(600);
  });

  // Independent corroboration: the operator's manual Excel sheet
  // (AIRBUS TAZE SENTR.xlsx, cell U24) carries 111224 for EZ-F430 crew 3/4.
  it("matches the operator's manual Excel sheet for EZ-F430 crew 3/4", () => {
    const cell = rev2.dowDoiMatrix["EZ-F430"].find((c) => c.cockpitCrew === 3 && c.courierCrew === 4)!;
    expect(cell.dow).toBe("111224");
  });
});
