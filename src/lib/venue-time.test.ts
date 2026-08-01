import { describe, it, expect } from "vitest";
import { venueLocalToday } from "./venue-time";

describe("venueLocalToday", () => {
  it("formats an instant as the venue-local ISO date", () => {
    // 2026-08-01 10:30 UTC → Vilnius is UTC+3 in summer → still Aug 1 local.
    const instant = new Date("2026-08-01T10:30:00Z");
    expect(venueLocalToday(instant)).toBe("2026-08-01");
  });

  it("rolls over to the next local day when UTC is still the previous evening", () => {
    // 2026-08-01 22:30 UTC → +3 → 2026-08-02 01:30 local.
    const instant = new Date("2026-08-01T22:30:00Z");
    expect(venueLocalToday(instant)).toBe("2026-08-02");
  });

  it("stays on the previous local day just before local midnight", () => {
    // 2026-08-01 20:30 UTC → +3 → 2026-08-01 23:30 local.
    const instant = new Date("2026-08-01T20:30:00Z");
    expect(venueLocalToday(instant)).toBe("2026-08-01");
  });
});
