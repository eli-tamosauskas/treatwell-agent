import { describe, it, expect } from "vitest";
import {
  resolveAvailability,
  createFindAvailabilityTool,
  type FindAvailabilityInput,
  type FindAvailabilityResult,
} from "./find-availability-tool";
import { fetchBusyIntervals, type CalendarRange } from "./treatwell";
import { calendarWeekFixture } from "./fixtures/calendar-week";

/** UTC instant for a venue-local (Europe/Vilnius, summer UTC+3) wall-clock. */
function localInstant(isoLocal: string): Date {
  return new Date(`${isoLocal}:00+03:00`);
}

/** A "now" before the fixture week, so nothing is dropped as past. */
const beforeTheWeek = () => localInstant("2026-07-27T08:00");

/**
 * A `fetchBusy` that runs the *real* fetch + PII-stripping reducer (03) over the
 * primary fixture, standing in only the network. This exercises the true
 * end-to-end path — fetch → reduce → compute — minus the live cookie and LLM.
 * It also records the ranges it was asked for.
 */
function fixtureFetchBusy() {
  const ranges: CalendarRange[] = [];
  const fetchImpl = (async () =>
    new Response(JSON.stringify(calendarWeekFixture), {
      status: 200,
    })) as unknown as typeof fetch;
  const fetchBusy = (range: CalendarRange) => {
    ranges.push(range);
    return fetchBusyIntervals(range, { cookie: "session=live", fetchImpl });
  };
  return { fetchBusy, ranges };
}

function resolve(input: FindAvailabilityInput, now = beforeTheWeek) {
  const { fetchBusy } = fixtureFetchBusy();
  return resolveAvailability(input, { fetchBusy, now });
}

describe("resolveAvailability (real fetch + computation wired together)", () => {
  it("fetches exactly the requested range, once", async () => {
    const { fetchBusy, ranges } = fixtureFetchBusy();
    await resolveAvailability(
      { service: "makeup", dateFrom: "2026-07-29", dateTo: "2026-07-31" },
      { fetchBusy, now: beforeTheWeek },
    );
    expect(ranges).toEqual([{ dateFrom: "2026-07-29", dateTo: "2026-07-31" }]);
  });

  it("confirms a preferred time that the real calendar leaves free", async () => {
    // makeup 14:00–15:30 clears the 15:30 appointment on 2026-07-27.
    const result = await resolve({
      service: "makeup",
      dateFrom: "2026-07-27",
      dateTo: "2026-07-27",
      preferredTime: "14:00",
    });
    expect(result.preferredTime).toBe("14:00");
    expect(result.preferredTimeAvailable).toBe(true);
  });

  it("reports a taken preferred time and still offers nearest alternatives", async () => {
    // makeup 15:00–16:30 overruns the real 15:30–16:00 appointment.
    const result = await resolve({
      service: "makeup",
      dateFrom: "2026-07-27",
      dateTo: "2026-07-27",
      preferredTime: "15:00",
    });
    expect(result.preferredTimeAvailable).toBe(false);
    const times = result.slots.map((s) => s.startTime);
    expect(times).not.toContain("15:00");
    expect(times).toContain("14:00");
  });

  it("groups real openings across days for an open-ended range", async () => {
    const result = await resolve({
      service: "eyebrows",
      dateFrom: "2026-07-29",
      dateTo: "2026-07-31",
    });
    const dates = new Set(result.slots.map((s) => s.date));
    expect(dates.has("2026-07-29")).toBe(true);
    expect(dates.has("2026-07-31")).toBe(true);
    // Chronological, so the model can group by day.
    const serialised = result.slots.map((s) => `${s.date} ${s.startTime}`);
    expect(serialised).toEqual([...serialised].sort());
  });

  it("excludes slots earlier than venue-local now on today", async () => {
    const result = await resolve(
      { service: "eyebrows", dateFrom: "2026-07-27", dateTo: "2026-07-27" },
      () => localInstant("2026-07-27T12:00"),
    );
    const times = result.slots.map((s) => s.startTime);
    expect(times.length).toBeGreaterThan(0);
    for (const time of times) expect(time >= "12:00").toBe(true);
  });

  it("never lets customer PII reach the result", async () => {
    const result = await resolve({
      service: "eyebrows",
      dateFrom: "2026-07-27",
      dateTo: "2026-08-02",
    });
    const serialised = JSON.stringify(result);
    expect(serialised).not.toContain("Kazlauskienė");
    expect(serialised).not.toContain("Petrauskas");
    expect(serialised).not.toContain("+37060011122");
    expect(serialised).not.toContain("example.lt");
    expect(serialised).not.toMatch(/price/i);
    // Every slot is bare {date,startTime} only.
    for (const slot of result.slots) {
      expect(Object.keys(slot).sort()).toEqual(["date", "startTime"]);
    }
  });
});

describe("createFindAvailabilityTool", () => {
  it("builds a tool whose execute resolves availability through the deps", async () => {
    const { fetchBusy } = fixtureFetchBusy();
    const tool = createFindAvailabilityTool({ fetchBusy, now: beforeTheWeek });
    const execute = tool.execute!;
    const result = (await execute(
      { service: "makeup", dateFrom: "2026-07-27", dateTo: "2026-07-27" },
      // The AI SDK passes call context here; the tool ignores it.
      { toolCallId: "test", messages: [] } as never,
    )) as FindAvailabilityResult;
    expect(result.service).toBe("makeup");
    expect(result.durationMinutes).toBe(90);
    expect(result.slots.length).toBeGreaterThan(0);
  });
});
