import type { CalendarPayload } from "../availability";

/**
 * Reconstructed Treatwell Connect calendar for the week of 2026-07-27 to
 * 2026-08-02, employee 609398 — the primary availability fixture.
 *
 * The raw week capture referenced in the PRD was never committed to the repo,
 * and re-capturing needs a live session cookie the test environment does not
 * have. This fixture is a faithful reconstruction of the documented payload
 * shape (PRD "Data source": `appointments[]` with `appointmentDate` /
 * `startTime` / `endTime` / `employeeId` plus customer PII, and `blocks[]`
 * with `itemDate` / `itemTimeFrom` / `itemTimeTo` / `availabilityRuleTypeCode`,
 * multi-day away periods pre-expanded to one row per day). Every appointment
 * carries realistic customer PII precisely so the reducer can be shown to drop
 * it (PRD user story 17).
 *
 * The rows are arranged to exercise the scenarios ticket 02 enumerates:
 *  - 2026-07-27 15:30–16:00 appointment → a makeup (90m) at 15:00 overruns it.
 *  - 2026-07-28 11:00–11:30 and 12:00–12:45 appointments → a 30m eyebrows fits
 *    the 11:30–12:00 gap exactly.
 *  - 2026-07-28 `pietų pertrauka` lunch block 13:00–14:00 → removes midday slots.
 *  - 2026-08-01 & 2026-08-02 `budapest` away block, pre-expanded per day →
 *    each day fully unavailable.
 *  - 2026-07-29 to 2026-07-31 left open → free slots across multiple days.
 */
export const calendarWeekFixture: CalendarPayload = {
  appointments: [
    {
      appointmentDate: "2026-07-27",
      startTime: "15:30:00",
      endTime: "16:00:00",
      employeeId: 609398,
      statusCode: "CONFIRMED",
      customerName: "Rūta Kazlauskienė",
      customerPhone: "+37060011122",
      customerEmail: "ruta.k@example.lt",
      price: 25,
    },
    {
      appointmentDate: "2026-07-28",
      startTime: "11:00:00",
      endTime: "11:30:00",
      employeeId: 609398,
      statusCode: "CONFIRMED",
      customerName: "Jonas Petrauskas",
      customerPhone: "+37061122334",
      customerEmail: "jonas.p@example.lt",
      price: 30,
    },
    {
      appointmentDate: "2026-07-28",
      startTime: "12:00:00",
      endTime: "12:45:00",
      employeeId: 609398,
      statusCode: "ARRIVED",
      customerName: "Greta Vasiliauskaitė",
      customerPhone: "+37062233445",
      customerEmail: "greta.v@example.lt",
      price: 45,
    },
    {
      appointmentDate: "2026-07-30",
      startTime: "10:00:00",
      endTime: "11:00:00",
      employeeId: 609398,
      statusCode: "CANCELLED",
      customerName: "Mindaugas Žukauskas",
      customerPhone: "+37063344556",
      customerEmail: "mindaugas.z@example.lt",
      price: 40,
    },
  ],
  blocks: [
    {
      itemDate: "2026-07-28",
      itemTimeFrom: "13:00:00",
      itemTimeTo: "14:00:00",
      availabilityRuleTypeCode: "D",
      description: "pietų pertrauka",
    },
    {
      itemDate: "2026-08-01",
      itemTimeFrom: "00:00:00",
      itemTimeTo: "23:59:00",
      availabilityRuleTypeCode: "P",
      description: "budapest",
    },
    {
      itemDate: "2026-08-02",
      itemTimeFrom: "00:00:00",
      itemTimeTo: "23:59:00",
      availabilityRuleTypeCode: "P",
      description: "budapest",
    },
  ],
};
