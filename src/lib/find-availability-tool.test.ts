import { describe, it, expect } from "vitest";
import { stubbedAvailability } from "./find-availability-tool";

describe("stubbedAvailability (result contract)", () => {
  it("returns the service's duration and echoes the range", () => {
    const result = stubbedAvailability({
      service: "makeup",
      dateFrom: "2026-08-07",
      dateTo: "2026-08-07",
    });
    expect(result.service).toBe("makeup");
    expect(result.durationMinutes).toBe(90);
    expect(result.dateFrom).toBe("2026-08-07");
    expect(result.dateTo).toBe("2026-08-07");
  });

  it("emits bare slot data only — no customer fields leak", () => {
    const result = stubbedAvailability({
      service: "eyebrows",
      dateFrom: "2026-08-07",
      dateTo: "2026-08-07",
    });
    expect(result.slots.length).toBeGreaterThan(0);
    for (const slot of result.slots) {
      expect(Object.keys(slot).sort()).toEqual(["date", "startTime"]);
    }
  });

  it("omits the preferred-time verdict when no preferred time is asked", () => {
    const result = stubbedAvailability({
      service: "makeup",
      dateFrom: "2026-08-07",
      dateTo: "2026-08-07",
    });
    expect(result.preferredTime).toBeUndefined();
    expect(result.preferredTimeAvailable).toBeUndefined();
  });

  it("reports a free preferred time as available", () => {
    const result = stubbedAvailability({
      service: "makeup",
      dateFrom: "2026-08-07",
      dateTo: "2026-08-07",
      preferredTime: "15:00",
    });
    expect(result.preferredTime).toBe("15:00");
    expect(result.preferredTimeAvailable).toBe(true);
  });

  it("reports a taken preferred time as unavailable", () => {
    const result = stubbedAvailability({
      service: "makeup",
      dateFrom: "2026-08-07",
      dateTo: "2026-08-07",
      preferredTime: "13:00",
    });
    expect(result.preferredTimeAvailable).toBe(false);
  });
});
