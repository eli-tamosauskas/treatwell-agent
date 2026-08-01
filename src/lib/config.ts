/**
 * Static configuration for the single-venue, single-employee MVP.
 *
 * These are hardcoded constants rather than runtime config: the app runs against
 * one Treatwell venue and one employee calendar out of the box (PRD user story 18).
 */

/** Origin of the Treatwell Connect API this app reads. */
export const TREATWELL_BASE_URL = "https://connect.treatwell.lt";

/** Treatwell venue this app reads. */
export const VENUE_ID = 321461;

/** The single employee calendar availability is computed against. */
export const EMPLOYEE_ID = 609398;

/** IANA timezone the venue operates in. "Today"/"now" are resolved here. */
export const VENUE_TIMEZONE = "Europe/Vilnius";

/** Slot suggestions land on this minute grid (PRD user story 12). */
export const SLOT_STEP = 15;

/**
 * Working-hours window as venue-local wall-clock times. Availability is
 * constrained to this window (PRD user story 11). There is no authoritative
 * working-hours field in the Treatwell payload, hence the constant.
 */
export const WORKING_HOURS = {
  open: "08:00",
  close: "20:00",
} as const;

/**
 * The three services offered, mapped to their treatment duration in minutes.
 * A named service determines the length a candidate slot is judged against
 * (PRD user story 2). The MVP does not use Treatwell's real offer catalog.
 */
export const SERVICE_DURATIONS = {
  eyebrows: 30,
  hairstyle: 60,
  makeup: 90,
} as const;

/** Names of the services the app understands. */
export type ServiceName = keyof typeof SERVICE_DURATIONS;

/** The service names as a plain array, for prompts and validation. */
export const SERVICE_NAMES = Object.keys(SERVICE_DURATIONS) as ServiceName[];
