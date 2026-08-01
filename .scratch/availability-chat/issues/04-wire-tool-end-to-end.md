# 04 — Wire real fetch + computation into the tool

**What to build:** Replace the stub from ticket 01 so the `findAvailability` tool now does
the real thing: fetch the calendar for the requested range (03), reduce to busy intervals,
compute free slots (02), and return the clean result to the model. Real chat questions now
produce real availability answers end-to-end — specific-time confirmations, nearest
alternatives when taken, and grouped-by-day summaries for open-ended ranges.

**Blocked by:** 02, 03.

**Status:** ready-for-human

- [x] `findAvailability` calls the real fetch/reducer (03) then the pure computation (02); the hardcoded stub is removed.
- [x] "Can I book makeup next Friday at 3?" resolves the relative date in venue timezone, checks the real calendar, and confirms or offers nearest alternatives.
- [x] "Do you have anything next week?" returns a grouped-by-day summary of real openings.
- [x] Customer PII never reaches the model in any path.
- [x] The whole feature works against a live cookie: read-only, single venue/employee, no writes.

**Notes:** `stubbedAvailability` is gone; the tool is now `createFindAvailabilityTool({ fetchBusy, now })`,
a thin wrapper over the pure `resolveAvailability(input, deps)` seam (fetch 03 → compute 02).
The route injects `fetchBusyIntervals(range, { cookie: treatwellCookie() })` and `() => new Date()`;
the cookie stays server-side. Relative-date resolution and grouped-by-day narration remain the
system prompt's job. On an expired cookie, `fetchBusyIntervals` throws `TreatwellSessionError`;
AI SDK 7 serialises its actionable message into the tool result the model narrates (verified against
`ai@7.0.47`), so the practitioner is told to re-paste the cookie rather than seeing a silent failure.
