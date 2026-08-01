# 02 — Real availability computation (pure function + tests)

**What to build:** The deterministic core that decides what's free. A pure function that
takes an already-fetched calendar payload, a request (`service`, `dateFrom`, `dateTo`,
optional `preferredTime`), the config (working hours, slot step, timezone), and a fixed
"now", and returns the free-slot result in the contract shape T1 locked. No network, no
cookie, no LLM — fetching happens upstream and is passed in as data.

This is the single test seam. Tests are fixture-driven, using the real calendar week
captured from Treatwell Connect (2026-07-27 to 2026-08-02, employee 609398) as the
primary fixture, and assert external behaviour (which slots come out) — never internal
representation.

**Blocked by:** 01 (shared config module + tool result contract).

**Status:** ready-for-agent

- [ ] Busy = every `appointments[]` row (any status, no filtering) + every `blocks[]` row, each reduced to a `{ date, start, end }` interval.
- [ ] Candidate slots are start times on the 15-minute grid within working hours; a candidate is free when `[start, start + serviceDuration)` overlaps no busy interval.
- [ ] Slots earlier than venue-local "now" (Europe/Vilnius) are excluded; all endpoint times treated as venue-local wall-clock, no UTC conversion.
- [ ] When `preferredTime` is given, the result indicates whether it is among the free slots.
- [ ] Test: makeup (90m) at 15:00 on a day with a conflicting appointment → taken, alternatives present.
- [ ] Test: eyebrows (30m) fits a gap between two adjacent appointments → free.
- [ ] Test: a multi-day away block (`budapest`, 2026-08-02) → that day fully unavailable.
- [ ] Test: a single-day block (lunch `pietų pertrauka`) removes the corresponding mid-day slots.
- [ ] Test: a candidate earlier than venue-local "now" on today's date → excluded.
- [ ] Test: an open-ended multi-day range → free slots present across multiple days.
