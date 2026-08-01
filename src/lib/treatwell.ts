import { TREATWELL_BASE_URL, VENUE_ID } from "./config";
import {
  toBusyIntervals,
  type BusyInterval,
  type CalendarPayload,
} from "./availability";

/**
 * The boundary that reads the Treatwell Connect calendar and hands back clean
 * data. It fetches the venue calendar for a date range with the practitioner's
 * session cookie, then reduces the raw payload to bare busy intervals — dropping
 * all customer PII right here so it never travels further into the app
 * (PRD user story 17).
 *
 * The cookie is *injected*, not read from the environment inside this module:
 * that keeps the `server-only` secret boundary in {@link ./env} (importing
 * `server-only` throws under the test runner) and lets these tests exercise the
 * URL, headers, and error handling without touching a real session. Ticket 04's
 * route handler passes `treatwellCookie()` through.
 */

/** The inclusive date range to read, as ISO `YYYY-MM-DD` strings. */
export interface CalendarRange {
  dateFrom: string;
  dateTo: string;
}

/** What {@link fetchBusyIntervals} needs beyond the range. */
export interface FetchCalendarOptions {
  /** The full Treatwell browser cookie string, sent verbatim; `undefined` when unset. */
  cookie: string | undefined;
  /** Overridable for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

/**
 * A failure the practitioner can act on: the session cookie is missing or has
 * been rejected by Treatwell. The remedy is always the same — re-paste a fresh
 * cookie into `TW_COOKIE` — so callers can surface this as one clear message
 * rather than a silent or cryptic error (PRD user story 16).
 */
export class TreatwellSessionError extends Error {
  constructor(detail: string) {
    super(`${detail} Re-paste a fresh Treatwell session cookie into TW_COOKIE.`);
    this.name = "TreatwellSessionError";
  }
}

/**
 * Build the calendar request URL. The ISO date values and the literal
 * `appointments,blocks` include-list need no escaping, so the query is assembled
 * by hand — keeping the comma literal, as Treatwell expects it.
 */
function calendarUrl(range: CalendarRange): string {
  const query = `date-from=${range.dateFrom}&date-to=${range.dateTo}&include=appointments,blocks`;
  return `${TREATWELL_BASE_URL}/api/venue/${VENUE_ID}/calendar.json?${query}`;
}

/** True when the parsed body has the two arrays the reducer consumes. */
function isCalendarPayload(body: unknown): body is CalendarPayload {
  const payload = body as CalendarPayload | null;
  return (
    typeof payload === "object" &&
    payload !== null &&
    Array.isArray(payload.appointments) &&
    Array.isArray(payload.blocks)
  );
}

/**
 * Fetch the venue calendar for `range` and return the busy intervals it implies
 * — exactly the `{ date, start, end }` shape {@link toBusyIntervals} produces
 * and the availability computation consumes. One HTTP request per range. Throws
 * {@link TreatwellSessionError} when the cookie is missing or rejected, and a
 * descriptive error on any other failed response.
 */
export async function fetchBusyIntervals(
  range: CalendarRange,
  { cookie, fetchImpl = fetch }: FetchCalendarOptions,
): Promise<BusyInterval[]> {
  if (!cookie) {
    throw new TreatwellSessionError("No Treatwell session cookie is configured.");
  }

  const response = await fetchImpl(calendarUrl(range), {
    method: "GET",
    headers: {
      Cookie: cookie,
      Accept: "application/json",
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new TreatwellSessionError(
      "Treatwell rejected the session cookie (it has likely expired).",
    );
  }
  if (!response.ok) {
    throw new Error(
      `Treatwell calendar request failed: ${response.status} ${response.statusText}`.trim(),
    );
  }

  // An expired session often 200s with an HTML login page rather than a 401.
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new TreatwellSessionError(
      "Treatwell returned a non-JSON response (likely a login page).",
    );
  }
  // Well-formed JSON that simply lacks the two arrays is not an auth problem —
  // don't send the practitioner chasing a cookie that may be fine.
  if (!isCalendarPayload(body)) {
    throw new Error(
      "Treatwell calendar response was missing the appointments/blocks arrays.",
    );
  }

  return toBusyIntervals(body);
}
