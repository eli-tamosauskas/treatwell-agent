import { VENUE_TIMEZONE } from "./config";

/**
 * The venue-local calendar date ("today") for a given instant, as an ISO
 * `YYYY-MM-DD` string. Relative phrases like "tomorrow" or "next Friday" are
 * resolved from this, in the venue's timezone rather than the server's
 * (PRD user story 8).
 */
export function venueLocalToday(instant: Date): string {
  // en-CA renders dates as ISO-8601 (YYYY-MM-DD).
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: VENUE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}
