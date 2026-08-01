import { tool } from "ai";
import { z } from "zod";
import { SERVICE_DURATIONS, SERVICE_NAMES, type ServiceName } from "./config";

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
 * STUB. Ignores the real calendar and returns a small fixed set of free slots,
 * so the chat can be exercised end-to-end before the real fetch + availability
 * computation land in later tickets. The result *shape* is the real contract.
 */
export function stubbedAvailability(
  input: FindAvailabilityInput,
): FindAvailabilityResult {
  const { service, dateFrom, dateTo, preferredTime } = input;

  // Hardcoded openings on the search's first day.
  const slots: FreeSlot[] = [
    { date: dateFrom, startTime: "09:00" },
    { date: dateFrom, startTime: "11:30" },
    { date: dateFrom, startTime: "15:00" },
  ];

  const result: FindAvailabilityResult = {
    service,
    durationMinutes: SERVICE_DURATIONS[service],
    dateFrom,
    dateTo,
    slots,
  };

  if (preferredTime !== undefined) {
    result.preferredTime = preferredTime;
    result.preferredTimeAvailable = slots.some(
      (s) => s.startTime === preferredTime,
    );
  }

  return result;
}

/**
 * The one tool the availability chat exposes. Fetches the calendar for a range,
 * strips it to free slots, and returns them for the model to narrate. Currently
 * stubbed (see {@link stubbedAvailability}).
 */
export const findAvailabilityTool = tool({
  description:
    "Find the free appointment slots for a service over a date range. " +
    "Returns bare slot times only. When a specific start time is given as " +
    "preferredTime, also reports whether that exact slot is free.",
  inputSchema,
  execute: async (input): Promise<FindAvailabilityResult> =>
    stubbedAvailability(input),
});
