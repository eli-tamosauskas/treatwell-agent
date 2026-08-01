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
 * The three services offered, each with its treatment duration in minutes and
 * its fixed **list price** in euros. Duration determines the length a candidate
 * slot is judged against (PRD user story 2); the list price is the public menu
 * price the assistant quotes on request. The MVP does not use Treatwell's real
 * offer catalog — this hardcoded map is the single source of truth for both facts.
 *
 * A *list price* is not an *appointment price*: the amount a specific customer
 * paid is PII and is stripped at the Treatwell boundary before anything reaches
 * the model (PRD user story 17). These fixed menu prices are public and safe to
 * quote. See `docs/adr/0001-list-prices-are-not-appointment-prices.md`.
 */
export const SERVICES = {
  eyebrows: { durationMinutes: 30, priceEur: 50 },
  hairstyle: { durationMinutes: 60, priceEur: 90 },
  makeup: { durationMinutes: 90, priceEur: 110 },
} as const;

/** Names of the services the app understands. */
export type ServiceName = keyof typeof SERVICES;

/** The service names as a plain array, for prompts and validation. */
export const SERVICE_NAMES = Object.keys(SERVICES) as ServiceName[];

/**
 * Service → treatment duration in minutes, derived from {@link SERVICES}. The
 * availability computation needs only the length, so it consumes this narrow
 * projection rather than the whole catalog.
 */
export const SERVICE_DURATIONS = Object.fromEntries(
  SERVICE_NAMES.map((name) => [name, SERVICES[name].durationMinutes]),
) as Record<ServiceName, number>;
