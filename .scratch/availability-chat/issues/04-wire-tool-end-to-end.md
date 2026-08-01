# 04 — Wire real fetch + computation into the tool

**What to build:** Replace the stub from ticket 01 so the `findAvailability` tool now does
the real thing: fetch the calendar for the requested range (03), reduce to busy intervals,
compute free slots (02), and return the clean result to the model. Real chat questions now
produce real availability answers end-to-end — specific-time confirmations, nearest
alternatives when taken, and grouped-by-day summaries for open-ended ranges.

**Blocked by:** 02, 03.

**Status:** ready-for-agent

- [ ] `findAvailability` calls the real fetch/reducer (03) then the pure computation (02); the hardcoded stub is removed.
- [ ] "Can I book makeup next Friday at 3?" resolves the relative date in venue timezone, checks the real calendar, and confirms or offers nearest alternatives.
- [ ] "Do you have anything next week?" returns a grouped-by-day summary of real openings.
- [ ] Customer PII never reaches the model in any path.
- [ ] The whole feature works against a live cookie: read-only, single venue/employee, no writes.
