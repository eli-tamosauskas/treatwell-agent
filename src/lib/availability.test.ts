import { describe, it, expect } from "vitest";
import {
  computeAvailability,
  toBusyIntervals,
  DEFAULT_AVAILABILITY_CONFIG,
  type AvailabilityRequest,
} from "./availability";
import { calendarWeekFixture } from "./fixtures/calendar-week";

const config = DEFAULT_AVAILABILITY_CONFIG;
const busy = toBusyIntervals(calendarWeekFixture);

/** UTC instant for a venue-local (Europe/Vilnius, summer UTC+3) wall-clock. */
function localInstant(isoLocal: string): Date {
  // e.g. "2026-07-27T12:00" local → 09:00Z.
  return new Date(`${isoLocal}:00+03:00`);
}

/** A "now" at the start of the working day, so nothing is excluded as past. */
const startOfWeek = localInstant("2026-07-27T08:00");

function run(request: AvailabilityRequest, now: Date = startOfWeek) {
  return computeAvailability(busy, request, config, now);
}

function startTimesOn(request: AvailabilityRequest, now?: Date): string[] {
  return run(request, now)
    .slots.filter((s) => s.date === request.dateFrom)
    .map((s) => s.startTime);
}

describe("toBusyIntervals", () => {
  it("reduces every appointment and block to a bare {date,start,end}", () => {
    // 4 appointments + 3 blocks in the fixture.
    expect(busy).toHaveLength(7);
    for (const interval of busy) {
      expect(Object.keys(interval).sort()).toEqual(["date", "end", "start"]);
    }
  });

  it("keeps appointments of any status, without filtering", () => {
    // The 2026-07-30 appointment is CANCELLED but still busy.
    expect(busy).toContainEqual({
      date: "2026-07-30",
      start: "10:00",
      end: "11:00",
    });
  });

  it("carries no customer PII into the intervals", () => {
    const serialised = JSON.stringify(busy);
    expect(serialised).not.toContain("Kazlauskienė");
    expect(serialised).not.toContain("+37060011122");
    expect(serialised).not.toContain("example.lt");
    expect(serialised).not.toMatch(/price/i);
  });
});

describe("computeAvailability", () => {
  it("echoes the request and the resolved service duration", () => {
    const result = run({
      service: "makeup",
      dateFrom: "2026-07-29",
      dateTo: "2026-07-29",
    });
    expect(result).toMatchObject({
      service: "makeup",
      durationMinutes: 90,
      dateFrom: "2026-07-29",
      dateTo: "2026-07-29",
    });
    expect(result.preferredTime).toBeUndefined();
    expect(result.preferredTimeAvailable).toBeUndefined();
  });

  it("marks a preferred time taken when the treatment overruns an appointment", () => {
    // makeup 15:00–16:30 overruns the 15:30–16:00 appointment on 2026-07-27.
    const result = run({
      service: "makeup",
      dateFrom: "2026-07-27",
      dateTo: "2026-07-27",
      preferredTime: "15:00",
    });
    expect(result.preferredTime).toBe("15:00");
    expect(result.preferredTimeAvailable).toBe(false);
    // Alternatives are still offered, and 15:00 is not among them.
    expect(result.slots.length).toBeGreaterThan(0);
    const times = result.slots.map((s) => s.startTime);
    expect(times).not.toContain("15:00");
    expect(times).toContain("14:00"); // 14:00–15:30 clears the appointment
  });

  it("confirms a preferred time that is free", () => {
    // makeup 14:00–15:30 ends before the 15:30 appointment on 2026-07-27.
    const result = run({
      service: "makeup",
      dateFrom: "2026-07-27",
      dateTo: "2026-07-27",
      preferredTime: "14:00",
    });
    expect(result.preferredTimeAvailable).toBe(true);
  });

  it("fits a short service into the gap between two adjacent appointments", () => {
    // 2026-07-28: appts 11:00–11:30 and 12:00–12:45 leave a 30m gap at 11:30.
    const times = startTimesOn({
      service: "eyebrows",
      dateFrom: "2026-07-28",
      dateTo: "2026-07-28",
    });
    expect(times).toContain("11:30");
    expect(times).not.toContain("11:00"); // inside the first appointment
    expect(times).not.toContain("12:00"); // inside the second appointment
  });

  it("removes the slots a single-day lunch block covers", () => {
    // 2026-07-28 `pietų pertrauka` 13:00–14:00 blocks midday eyebrows slots.
    const times = startTimesOn({
      service: "eyebrows",
      dateFrom: "2026-07-28",
      dateTo: "2026-07-28",
    });
    expect(times).not.toContain("13:00");
    expect(times).not.toContain("13:30");
    expect(times).toContain("14:00"); // free the moment the block ends
  });

  it("makes a whole away-block day unavailable", () => {
    // 2026-08-02 is one pre-expanded day of the multi-day `budapest` block.
    const result = run({
      service: "eyebrows",
      dateFrom: "2026-08-02",
      dateTo: "2026-08-02",
    });
    expect(result.slots).toEqual([]);
  });

  it("excludes candidate slots earlier than venue-local now on today", () => {
    // "Now" is 2026-07-27 12:00 local; nothing before noon may be offered.
    const noon = localInstant("2026-07-27T12:00");
    const times = startTimesOn(
      { service: "eyebrows", dateFrom: "2026-07-27", dateTo: "2026-07-27" },
      noon,
    );
    expect(times.length).toBeGreaterThan(0);
    expect(times).not.toContain("08:00");
    expect(times).not.toContain("11:45");
    expect(times[0] >= "12:00").toBe(true);
    for (const time of times) expect(time >= "12:00").toBe(true);
  });

  it("does not exclude past-of-server slots on a future day", () => {
    // Same noon "now", but the query is a later day — full morning is free.
    const noon = localInstant("2026-07-27T12:00");
    const times = startTimesOn(
      { service: "eyebrows", dateFrom: "2026-07-29", dateTo: "2026-07-29" },
      noon,
    );
    expect(times).toContain("08:00");
  });

  it("returns openings across multiple days for an open-ended range", () => {
    // 2026-07-29..2026-07-31 are open days.
    const result = run({
      service: "eyebrows",
      dateFrom: "2026-07-29",
      dateTo: "2026-07-31",
    });
    const dates = new Set(result.slots.map((s) => s.date));
    expect(dates.size).toBeGreaterThanOrEqual(2);
    expect(dates.has("2026-07-29")).toBe(true);
    expect(dates.has("2026-07-31")).toBe(true);
    // Chronological across the range.
    const serialised = result.slots.map((s) => `${s.date} ${s.startTime}`);
    expect(serialised).toEqual([...serialised].sort());
  });

  it("keeps the whole treatment within working hours", () => {
    // makeup 90m against 08:00–20:00: last viable start is 18:30, not 19:00.
    const times = startTimesOn({
      service: "makeup",
      dateFrom: "2026-07-29",
      dateTo: "2026-07-29",
    });
    expect(times[0]).toBe("08:00");
    expect(times.at(-1)).toBe("18:30");
    expect(times).not.toContain("18:45");
  });
});

describe("computeAvailability runs", () => {
  it("collapses a contiguous block of free starts into a single run", () => {
    // 2026-07-29 is fully open; eyebrows (30m) is free 08:00 through 19:30
    // (19:30 + 30 = 20:00 close), all adjacent on the 15-minute grid.
    const result = run({
      service: "eyebrows",
      dateFrom: "2026-07-29",
      dateTo: "2026-07-29",
    });
    expect(result.runs).toEqual([
      { date: "2026-07-29", from: "08:00", to: "19:30" },
    ]);
  });

  it("splits a day into two runs where a busy interval breaks the grid", () => {
    // 2026-07-27 has one appointment 15:30–16:00. A makeup (90m) is free up to
    // a 14:00 start (14:00–15:30), then the next fit is a 16:00 start — one gap,
    // two runs. `to` is the last bookable start, not an end time.
    const result = run({
      service: "makeup",
      dateFrom: "2026-07-27",
      dateTo: "2026-07-27",
    });
    expect(result.runs).toEqual([
      { date: "2026-07-27", from: "08:00", to: "14:00" },
      { date: "2026-07-27", from: "16:00", to: "18:30" },
    ]);
  });

  it("represents a lone free start as a run with from === to", () => {
    // 2026-07-28: appts 11:00–11:30 and 12:00–12:45 leave exactly one eyebrows
    // (30m) start at 11:30 (11:30–12:00) isolated between them.
    const result = run({
      service: "eyebrows",
      dateFrom: "2026-07-28",
      dateTo: "2026-07-28",
    });
    expect(result.runs).toContainEqual({
      date: "2026-07-28",
      from: "11:30",
      to: "11:30",
    });
  });

  it("bounds a run's last start by the service duration", () => {
    // Same open 2026-07-29, but makeup (90m): the single run must stop at the
    // last start whose full treatment fits before close — 18:30, not 19:30.
    const result = run({
      service: "makeup",
      dateFrom: "2026-07-29",
      dateTo: "2026-07-29",
    });
    expect(result.runs).toEqual([
      { date: "2026-07-29", from: "08:00", to: "18:30" },
    ]);
  });

  it("yields no runs for a fully unavailable day", () => {
    // 2026-08-02 is a pre-expanded away-block day: no slots, so no runs.
    const result = run({
      service: "eyebrows",
      dateFrom: "2026-08-02",
      dateTo: "2026-08-02",
    });
    expect(result.slots).toEqual([]);
    expect(result.runs).toEqual([]);
  });

  it("orders runs chronologically within and across days", () => {
    const result = run({
      service: "eyebrows",
      dateFrom: "2026-07-27",
      dateTo: "2026-07-31",
    });
    const keys = result.runs.map((r) => `${r.date} ${r.from}`);
    expect(keys).toEqual([...keys].sort());
    // Every run stays inside its day and never runs backwards.
    for (const r of result.runs) expect(r.from <= r.to).toBe(true);
  });
});
