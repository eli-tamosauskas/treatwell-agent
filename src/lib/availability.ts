import {
  SERVICE_DURATIONS,
  SLOT_STEP,
  VENUE_TIMEZONE,
  WORKING_HOURS,
  type ServiceName,
} from "./config";
import {
  type FindAvailabilityResult,
  type FreeSlot,
} from "./find-availability-tool";
import { venueLocalTime } from "./venue-time";

/**
 * One booked appointment as it arrives in the raw Treatwell calendar payload.
 * Only the date and the time window are load-bearing here; every other field
 * (customer name, phone, email, price, status) is customer PII or metadata that
 * the reducer deliberately drops (PRD user story 17), hence the index signature.
 */
export interface CalendarAppointment {
  appointmentDate: string;
  startTime: string;
  endTime: string;
  [extra: string]: unknown;
}

/**
 * One non-booking busy period (lunch, personal appointment, multi-day away
 * trip) from the raw payload's `blocks[]`. Multi-day away periods arrive
 * pre-expanded into one row per day, so each row is a single-day interval.
 */
export interface CalendarBlock {
  itemDate: string;
  itemTimeFrom: string;
  itemTimeTo: string;
  [extra: string]: unknown;
}

/** The slice of the raw Treatwell calendar response the app consumes. */
export interface CalendarPayload {
  appointments: CalendarAppointment[];
  blocks: CalendarBlock[];
}

/**
 * A single stretch of busy time, venue-local wall-clock. `start`/`end` are
 * `HH:MM` on the given `YYYY-MM-DD` `date`, and the interval is half-open
 * `[start, end)`. This is the entire shape {@link computeAvailability} needs —
 * no customer data survives the reduction to it.
 */
export interface BusyInterval {
  date: string;
  start: string;
  end: string;
}

/** The request a `findAvailability` call resolves to, minus the payload. */
export interface AvailabilityRequest {
  service: ServiceName;
  dateFrom: string;
  dateTo: string;
  preferredTime?: string;
}

/** The knobs availability is computed against; injected so tests stay pure. */
export interface AvailabilityConfig {
  workingHours: { open: string; close: string };
  slotStep: number;
  serviceDurations: Record<ServiceName, number>;
  timezone: string;
}

/** The app's real configuration, assembled from the constants module. */
export const DEFAULT_AVAILABILITY_CONFIG: AvailabilityConfig = {
  workingHours: WORKING_HOURS,
  slotStep: SLOT_STEP,
  serviceDurations: SERVICE_DURATIONS,
  timezone: VENUE_TIMEZONE,
};

/** Minutes since midnight for an `HH:MM` or `HH:MM:SS` wall-clock string. */
function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
}

/** The `HH:MM` wall-clock string for minutes since midnight. */
function toHHMM(minutes: number): string {
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Normalise a payload time (`HH:MM` or `HH:MM:SS`) to `HH:MM`. */
function normalizeTime(time: string): string {
  return toHHMM(toMinutes(time));
}

/** Every ISO date from `from` to `to` inclusive, as `YYYY-MM-DD` strings. */
function eachDate(from: string, to: string): string[] {
  const dates: string[] = [];
  // Iterate in UTC so these pure date labels are never shifted by an offset.
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Reduce a raw calendar payload to bare busy intervals. Every `appointments[]`
 * row (any status, no filtering) and every `blocks[]` row becomes one
 * `{ date, start, end }` interval; all customer PII and metadata is left behind
 * (PRD user story 17). This is exactly the shape {@link computeAvailability}
 * consumes, and what the fetch/reducer of ticket 03 produces.
 */
export function toBusyIntervals(payload: CalendarPayload): BusyInterval[] {
  const fromAppointments = payload.appointments.map((a) => ({
    date: a.appointmentDate,
    start: normalizeTime(a.startTime),
    end: normalizeTime(a.endTime),
  }));
  const fromBlocks = payload.blocks.map((b) => ({
    date: b.itemDate,
    start: normalizeTime(b.itemTimeFrom),
    end: normalizeTime(b.itemTimeTo),
  }));
  return [...fromAppointments, ...fromBlocks];
}

/**
 * The deterministic core: given the busy intervals for a range, decide which
 * start times are free (PRD user story 21). A candidate is a start time on the
 * `slotStep` grid within working hours; it is free when the whole treatment
 * `[start, start + duration)` overlaps no busy interval, stays within working
 * hours, and starts no earlier than venue-local "now" on today's date. All
 * times are venue-local wall-clock — no UTC conversion of calendar times.
 *
 * `now` is injected (not read from the clock) so the computation is pure and
 * fixture tests are reproducible.
 */
export function computeAvailability(
  busy: BusyInterval[],
  request: AvailabilityRequest,
  config: AvailabilityConfig,
  now: Date,
): FindAvailabilityResult {
  const duration = config.serviceDurations[request.service];
  const open = toMinutes(config.workingHours.open);
  const close = toMinutes(config.workingHours.close);
  const localNow = venueLocalTime(now, config.timezone);

  // Group busy intervals by date as half-open [start, end) minute ranges.
  const busyByDate = new Map<string, Array<[number, number]>>();
  for (const interval of busy) {
    const ranges = busyByDate.get(interval.date) ?? [];
    ranges.push([toMinutes(interval.start), toMinutes(interval.end)]);
    busyByDate.set(interval.date, ranges);
  }

  const slots: FreeSlot[] = [];
  for (const date of eachDate(request.dateFrom, request.dateTo)) {
    const dayBusy = busyByDate.get(date) ?? [];
    const isToday = date === localNow.date;

    for (let start = open; start + duration <= close; start += config.slotStep) {
      if (isToday && start < localNow.minutesSinceMidnight) continue;

      const slotEnd = start + duration;
      // Half-open overlap: [start, slotEnd) meets [busyStart, busyEnd).
      const conflicts = dayBusy.some(
        ([busyStart, busyEnd]) => start < busyEnd && busyStart < slotEnd,
      );
      if (conflicts) continue;

      slots.push({ date, startTime: toHHMM(start) });
    }
  }

  const result: FindAvailabilityResult = {
    service: request.service,
    durationMinutes: duration,
    dateFrom: request.dateFrom,
    dateTo: request.dateTo,
    slots,
  };

  if (request.preferredTime !== undefined) {
    result.preferredTime = request.preferredTime;
    // Grid-based: a named time is "available" when it is itself a free slot.
    result.preferredTimeAvailable = slots.some(
      (slot) => slot.startTime === request.preferredTime,
    );
  }

  return result;
}
