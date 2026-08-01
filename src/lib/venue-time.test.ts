import { describe, it, expect } from "vitest";
import { venueLocalToday, venueLocalTime } from "./venue-time";

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

describe("venueLocalTime", () => {
  it("reports the venue-local date and minutes-since-midnight", () => {
    // 2026-07-27 09:00 UTC → Vilnius +3 → 12:00 local.
    const instant = new Date("2026-07-27T09:00:00Z");
    expect(venueLocalTime(instant)).toEqual({
      date: "2026-07-27",
      minutesSinceMidnight: 12 * 60,
    });
  });

  it("rolls the date and time over local midnight", () => {
    // 2026-08-01 22:30 UTC → +3 → 2026-08-02 01:30 local.
    const instant = new Date("2026-08-01T22:30:00Z");
    expect(venueLocalTime(instant)).toEqual({
      date: "2026-08-02",
      minutesSinceMidnight: 1 * 60 + 30,
    });
  });
});
