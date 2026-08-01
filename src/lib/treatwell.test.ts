import { describe, it, expect } from "vitest";
import {
  fetchBusyIntervals,
  TreatwellSessionError,
  type CalendarRange,
} from "./treatwell";
import { VENUE_ID } from "./config";

const range: CalendarRange = { dateFrom: "2026-07-27", dateTo: "2026-08-02" };

/** A raw calendar payload carrying customer PII the reducer must drop. */
const payloadWithPII = {
  appointments: [
    {
      appointmentDate: "2026-07-27",
      startTime: "15:30:00",
      endTime: "16:00:00",
      employeeId: 609398,
      customerName: "Rūta Kazlauskienė",
      customerPhone: "+37060011122",
      customerEmail: "ruta.k@example.lt",
      price: 25,
    },
  ],
  blocks: [
    {
      itemDate: "2026-07-28",
      itemTimeFrom: "13:00:00",
      itemTimeTo: "14:00:00",
      availabilityRuleTypeCode: "D",
    },
  ],
};

/** A fetch stand-in that records its call and returns a canned response. */
function fakeFetch(response: Response) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("fetchBusyIntervals", () => {
  it("requests the venue calendar endpoint for the range, once, with the cookie verbatim", async () => {
    const { impl, calls } = fakeFetch(jsonResponse(payloadWithPII));

    await fetchBusyIntervals(range, {
      cookie: "session=abc; other=def",
      fetchImpl: impl,
    });

    expect(calls).toHaveLength(1);
    const url = new URL(calls[0].url);
    expect(url.origin + url.pathname).toBe(
      `https://connect.treatwell.lt/api/venue/${VENUE_ID}/calendar.json`,
    );
    expect(url.searchParams.get("date-from")).toBe("2026-07-27");
    expect(url.searchParams.get("date-to")).toBe("2026-08-02");
    expect(url.searchParams.get("include")).toBe("appointments,blocks");

    const headers = new Headers(calls[0].init?.headers);
    expect(headers.get("cookie")).toBe("session=abc; other=def");
  });

  it("returns bare busy intervals with no customer PII", async () => {
    const { impl } = fakeFetch(jsonResponse(payloadWithPII));

    const busy = await fetchBusyIntervals(range, {
      cookie: "session=abc",
      fetchImpl: impl,
    });

    expect(busy).toEqual([
      { date: "2026-07-27", start: "15:30", end: "16:00" },
      { date: "2026-07-28", start: "13:00", end: "14:00" },
    ]);
    const serialized = JSON.stringify(busy);
    expect(serialized).not.toContain("Rūta");
    expect(serialized).not.toContain("37060011122");
    expect(serialized).not.toContain("example.lt");
    expect(serialized).not.toContain("25");
  });

  it("surfaces an actionable session error when the cookie is not configured", async () => {
    const { impl, calls } = fakeFetch(jsonResponse(payloadWithPII));

    await expect(
      fetchBusyIntervals(range, { cookie: undefined, fetchImpl: impl }),
    ).rejects.toBeInstanceOf(TreatwellSessionError);
    // Never hits the network without a cookie.
    expect(calls).toHaveLength(0);
  });

  it.each([401, 403])(
    "surfaces an actionable session error on HTTP %i (expired cookie)",
    async (status) => {
      const { impl } = fakeFetch(new Response("nope", { status }));

      const err = await fetchBusyIntervals(range, {
        cookie: "session=stale",
        fetchImpl: impl,
      }).catch((e) => e);

      expect(err).toBeInstanceOf(TreatwellSessionError);
      expect(String(err.message).toLowerCase()).toContain("cookie");
    },
  );

  it("throws a descriptive error on other non-OK responses", async () => {
    const { impl } = fakeFetch(new Response("boom", { status: 500 }));

    await expect(
      fetchBusyIntervals(range, { cookie: "session=abc", fetchImpl: impl }),
    ).rejects.toThrow(/500/);
  });

  it("treats a non-JSON body (e.g. a login redirect) as a session error", async () => {
    const { impl } = fakeFetch(
      new Response("<html>login</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );

    await expect(
      fetchBusyIntervals(range, { cookie: "session=abc", fetchImpl: impl }),
    ).rejects.toBeInstanceOf(TreatwellSessionError);
  });

  it("reports well-formed JSON of the wrong shape as a plain error, not a cookie problem", async () => {
    const { impl } = fakeFetch(jsonResponse({ error: "something else" }));

    const err = await fetchBusyIntervals(range, {
      cookie: "session=abc",
      fetchImpl: impl,
    }).catch((e) => e);

    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(TreatwellSessionError);
  });
});
