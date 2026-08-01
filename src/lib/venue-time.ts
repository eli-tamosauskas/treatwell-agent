import { VENUE_TIMEZONE } from "./config";

/**
 * The venue-local calendar date ("today") for a given instant, as an ISO
 * `YYYY-MM-DD` string. Relative phrases like "tomorrow" or "next Friday" are
 * resolved from this, in the venue's timezone rather than the server's
 * (PRD user story 8).
 */
export function venueLocalToday(instant: Date): string {
  return venueLocalTime(instant).date;
}

/**
 * The venue-local date and wall-clock time of a given instant: the ISO
 * `YYYY-MM-DD` date plus minutes since local midnight. Availability uses this
 * to drop candidate slots that start earlier than "now" on today's date
 * (PRD user story 13), all in venue-local wall-clock rather than UTC.
 */
export function venueLocalTime(
  instant: Date,
  timeZone: string = VENUE_TIMEZONE,
): { date: string; minutesSinceMidnight: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(instant);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)!.value;

  // Some environments render local midnight as hour "24"; normalise to 0.
  const hour = part("hour") === "24" ? 0 : Number(part("hour"));
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    minutesSinceMidnight: hour * 60 + Number(part("minute")),
  };
}
