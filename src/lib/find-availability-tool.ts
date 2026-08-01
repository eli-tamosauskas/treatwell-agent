import { tool } from "ai";
import { z } from "zod";
import { SERVICE_NAMES, type ServiceName } from "./config";
import {
  computeAvailability,
  DEFAULT_AVAILABILITY_CONFIG,
  type AvailabilityConfig,
  type BusyInterval,
} from "./availability";
import { type CalendarRange } from "./treatwell";

/**
 * A single free start time. Bare slot data only — this is the whole contract
 * the model ever sees. Customer names, phone numbers, emails, prices, and every
 * other appointment field are stripped upstream and never reach here
 * (PRD user story 17).
 */
export interface FreeSlot {
  /** Venue-local calendar date, `YYYY-MM-DD`. */
  date: string;
  /** Venue-local start time on the slot grid, `HH:MM`. */
  startTime: string;
}

/**
 * The result of a `findAvailability` call. The model's only job is to narrate
 * this; the availability decision itself lives in code, not the model
 * (PRD user story 21).
 */
export interface FindAvailabilityResult {
  service: ServiceName;
  durationMinutes: number;
  dateFrom: string;
  dateTo: string;
  /** Echoed back only when the caller asked about a specific start time. */
  preferredTime?: string;
  /** Whether `preferredTime` is one of the free slots; set iff `preferredTime` was given. */
  preferredTimeAvailable?: boolean;
  /** Free slots across the range, in chronological order. */
  slots: FreeSlot[];
}

const inputSchema = z.object({
  service: z
    .enum(SERVICE_NAMES as [ServiceName, ...ServiceName[]])
    .describe("Which service the booking is for; determines the slot length."),
  dateFrom: z
    .string()
    .describe("Start of the range to search, inclusive, ISO YYYY-MM-DD."),
  dateTo: z
    .string()
    .describe("End of the range to search, inclusive, ISO YYYY-MM-DD."),
  preferredTime: z
    .string()
    .optional()
    .describe(
      "A specific requested start time as HH:MM (24h), when the practitioner named one.",
    ),
});

/** Input accepted by the tool, after schema validation. */
export type FindAvailabilityInput = z.infer<typeof inputSchema>;

/**
 * The dependencies the tool needs to answer a real question, injected so the
 * pure decision (02) and the network boundary (03) stay separately testable and
 * the tool itself carries no ambient state.
 */
export interface FindAvailabilityDeps {
  /**
   * Read the calendar for a range and return its busy intervals — already
   * stripped of customer PII by the reducer (03). The route wires this to
   * {@link ./treatwell.fetchBusyIntervals} with the session cookie.
   */
  fetchBusy: (range: CalendarRange) => Promise<BusyInterval[]>;
  /** "Now", injected (not read from the clock) so past-slot exclusion is testable. */
  now: () => Date;
  /** Availability knobs; defaults to the app's real configuration. */
  config?: AvailabilityConfig;
}

/**
 * Answer one availability question end-to-end: fetch the calendar for the range
 * (03), then run the deterministic free-slot computation (02) over the busy
 * intervals it hands back. This is the single seam the tool's `execute` is a
 * thin wrapper around, so the wiring can be tested without the AI SDK, the
 * network, or the LLM. No customer PII ever reaches here — the reducer drops it
 * upstream (PRD user story 17).
 */
export async function resolveAvailability(
  input: FindAvailabilityInput,
  { fetchBusy, now, config = DEFAULT_AVAILABILITY_CONFIG }: FindAvailabilityDeps,
): Promise<FindAvailabilityResult> {
  // FindAvailabilityInput is structurally the AvailabilityRequest (02) consumes,
  // so it flows straight through — no repackaging.
  const busy = await fetchBusy({ dateFrom: input.dateFrom, dateTo: input.dateTo });
  return computeAvailability(busy, input, config, now());
}

/**
 * The one tool the availability chat exposes. Fetches the calendar for a range,
 * reduces it to free slots, and returns them for the model to narrate — the
 * availability decision lives in code, not the model (PRD user story 21). The
 * network and clock are injected via {@link FindAvailabilityDeps} so this stays
 * a thin, deterministic wrapper around {@link resolveAvailability}.
 */
export function createFindAvailabilityTool(deps: FindAvailabilityDeps) {
  return tool({
    description:
      "Find the free appointment slots for a service over a date range. " +
      "Returns bare slot times only. When a specific start time is given as " +
      "preferredTime, also reports whether that exact slot is free.",
    inputSchema,
    execute: (input): Promise<FindAvailabilityResult> =>
      resolveAvailability(input, deps),
  });
}
