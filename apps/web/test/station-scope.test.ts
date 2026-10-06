import { describe, expect, it } from "vitest";
import { canEditSchedule, canWorkDeparture, stationScopeOf } from "../src/lib/station-scope";

const ASB = "station-asb";
const MXP = "station-mxp";

describe("station-scope", () => {
  it("lets the administrator work and file everything", () => {
    const scope = stationScopeOf({ role: "ADMIN", stationId: ASB });
    expect(scope.departureStationId).toBeNull();
    expect(canWorkDeparture(scope, MXP)).toBe(true);
    expect(canEditSchedule(scope)).toBe(true);
  });

  it("confines a station's controller to the flights it dispatches", () => {
    // Ashgabat works ASB-MXP; the return leg belongs to Milan.
    const scope = stationScopeOf({ role: "LOAD_CONTROLLER", stationId: ASB });
    expect(canWorkDeparture(scope, ASB)).toBe(true);
    expect(canWorkDeparture(scope, MXP)).toBe(false);
  });

  it("mirrors that for an outstation", () => {
    const scope = stationScopeOf({ role: "LOAD_CONTROLLER", stationId: MXP });
    expect(canWorkDeparture(scope, MXP)).toBe(true);
    expect(canWorkDeparture(scope, ASB)).toBe(false);
  });

  it("does not let a station file flights", () => {
    expect(canEditSchedule(stationScopeOf({ role: "LOAD_CONTROLLER", stationId: ASB }))).toBe(false);
    expect(canEditSchedule(stationScopeOf({ role: "CHECKER", stationId: ASB }))).toBe(false);
  });

  it("leaves an account with no station posted to it unconfined", () => {
    const scope = stationScopeOf({ role: "LOAD_CONTROLLER", stationId: null });
    expect(canWorkDeparture(scope, ASB)).toBe(true);
    expect(canWorkDeparture(scope, MXP)).toBe(true);
    // Still not the schedule, though: that is the administrator's.
    expect(canEditSchedule(scope)).toBe(false);
  });

  it("gives a signed-out request nothing", () => {
    const scope = stationScopeOf(undefined);
    expect(scope.isAdmin).toBe(false);
    expect(canEditSchedule(scope)).toBe(false);
  });
});
