# 03 — Treatwell fetch + PII-stripping reducer

**What to build:** The boundary that reads the calendar and hands back clean data. Given a
date range, fetch the Treatwell Connect calendar endpoint for the configured venue using
the stored session cookie, then reduce the raw payload to bare busy intervals
(`{ date, start, end }`) — dropping all customer PII (names, phones, emails, prices, and
other appointment metadata) right here, so it never travels further into the app.

Verifiable by fetching a real range with a freshly pasted cookie and getting back clean
intervals, plus a clear, actionable failure when the cookie has expired.

**Blocked by:** 01 (shared config module + env wiring).

**Status:** ready-for-agent

- [ ] Fetches `GET connect.treatwell.lt/api/venue/{VENUE_ID}/calendar.json` with `date-from`, `date-to`, `include=appointments,blocks`, one request per range.
- [ ] Sends the full `TW_COOKIE` string verbatim as the `Cookie` header; secret stays server-side.
- [ ] Reduces `appointments[]` (date + `startTime`/`endTime`) and `blocks[]` (date + `itemTimeFrom`/`itemTimeTo`) to a flat list of busy intervals.
- [ ] No customer PII appears in the returned data.
- [ ] An expired/invalid session surfaces a clear failure the practitioner can act on (re-paste the cookie) rather than a silent or cryptic error.
- [ ] Output is exactly the busy-interval shape the availability function (02) consumes.
