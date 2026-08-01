# PRD: Treatwell Availability Chat (MVP)

Status: ready-for-agent

## Problem Statement

I run a single-practitioner Treatwell venue. To know whether I can take a booking
at a given time, I have to log into Treatwell Connect and read the calendar by eye,
mentally subtracting existing appointments and personal blocks from my working hours.
Treatwell has no public API, so there is no faster way to ask a plain question like
"can I fit a makeup next Friday at 3?" or "do I have anything free next week?".

## Solution

A small chat application where I type natural-language questions about my calendar and
get availability answers back. The app authenticates to Treatwell Connect using my
existing browser session cookie, reads the calendar for the range in question, computes
what is actually free (working hours minus appointments minus blocks), and answers:

- a specific time is free → confirm it
- a specific time is taken → offer the nearest few alternatives
- an open-ended range ("next week") → a compact, grouped-by-day summary of openings

Read-only: the app never creates, cancels, or modifies bookings.

## User Stories

1. As the practitioner, I want to ask "can I book makeup next Friday at 3pm?", so that I get a yes/no about that exact slot without opening Treatwell Connect.
2. As the practitioner, I want the app to understand my three service types (eyebrows 30m, hairstyle 60m, makeup 90m), so that "is 3pm free?" is judged against the correct treatment length.
3. As the practitioner, when I name a start time, I want the app to confirm the whole treatment duration fits before the next busy period, so that I don't accept a booking that would overrun into an existing appointment.
4. As the practitioner, when my requested time is taken, I want the nearest few free alternatives around it, so that I can offer the customer something close.
5. As the practitioner, I want to ask open-ended questions like "do you have anything next week?", so that I can see all my openings without naming a time.
6. As the practitioner, for an open-ended range I want the answer grouped by day, so that a week's worth of openings is readable rather than a wall of 15-minute slots.
7. As the practitioner, I want to use relative dates like "tomorrow", "next Friday", or "next week", so that I never have to type ISO dates.
8. As the practitioner, I want relative dates resolved in my venue's timezone (Europe/Vilnius), so that "tomorrow" means my tomorrow, not the server's.
9. As the practitioner, I want appointments treated as busy regardless of their status, so that any record on the calendar blocks the time.
10. As the practitioner, I want personal blocks (lunch, personal appointments, multi-day away periods like a trip) treated as busy, so that the app never offers time I've already reserved for myself.
11. As the practitioner, I want availability constrained to my working hours, so that the app never suggests a slot at 6am or 11pm.
12. As the practitioner, I want free slots offered on a 15-minute grid, so that suggested start times are tidy and predictable.
13. As the practitioner, I never want to be offered a slot in the past, so that today's suggestions only cover times still to come.
14. As the practitioner, if I ask about availability without naming a service, I want the app to ask which service I mean, so that it can apply the right duration.
15. As the practitioner, I want to paste my Treatwell session cookie into server configuration once, so that the app can read my calendar on my behalf.
16. As the practitioner, when my session cookie has expired, I want a clear failure I can act on (re-paste the cookie), so that I understand why answers stopped working.
17. As the practitioner, I want my customers' personal data (names, phone numbers, emails, prices) never sent to the language model, so that using the app doesn't leak client information to a third party.
18. As the practitioner, I want the app to run against my single venue and my single employee calendar out of the box, so that I don't have to specify who I am on every question.
19. As the practitioner, I want to swap the underlying model cheaply, so that I can control cost while experimenting.
20. As the practitioner, I want a simple chat interface with a running conversation, so that I can ask follow-up questions naturally.
21. As the practitioner, I want the availability decision made by deterministic code rather than the model's own arithmetic, so that the yes/no is trustworthy and repeatable.

## Implementation Decisions

**Stack.** Existing Next.js 16 / React 19 app. Vercel AI SDK for the chat loop, via
Vercel AI Gateway. Before writing any framework-level code, read the bundled Next docs
under `node_modules/next/dist/docs/` and the AI SDK docs — per AGENTS.md this Next.js
has breaking changes from prior versions.

**LLM access.** Vercel AI Gateway with a single `AI_GATEWAY_API_KEY`; no per-provider
keys, no provider SDK packages. The model is referenced as a swappable string
(e.g. `"google/gemini-*-flash"`), defaulting to a cheap Flash-class model to conserve
free gateway credit. Exact model id to be confirmed against the gateway model list at
build time.

**Treatwell authentication.** Manual cookie paste for the MVP. The full browser cookie
string is stored server-side in `TW_COOKIE` (`.env.local`) and sent verbatim as the
`Cookie` header. No credential storage, no headless login, no captcha/2FA handling.
Cookie expiry is handled by re-pasting. A sustainable auth mechanism is explicitly a
later problem.

**Data source.** The single known calendar endpoint:
`GET connect.treatwell.lt/api/venue/{VENUE_ID}/calendar.json` with
`date-from`, `date-to`, and `include=appointments,blocks`. One request per query range.
The response contains an `appointments[]` array (booked slots with `appointmentDate`,
`startTime`, `endTime`, `employeeId`, plus customer PII) and a `blocks[]` array (non-booking
busy time with `itemDate`, `itemTimeFrom`, `itemTimeTo`, and an `availabilityRuleTypeCode`;
multi-day away periods arrive pre-expanded into one row per day).

**Configuration constants (single module).**
- `VENUE_ID = 321461`, `EMPLOYEE_ID = 609398`
- `VENUE_TIMEZONE = "Europe/Vilnius"`
- Working-hours window (open/close, e.g. `08:00`–`20:00`)
- `SLOT_STEP = 15` minutes
- Service → duration map: `eyebrows` 30m, `hairstyle` 60m, `makeup` 90m

**Availability model (deterministic, computed in application code, not by the LLM).**
- Busy = every `appointments[]` row (any status code, no filtering) plus every `blocks[]`
  row, each reduced to a `{ date, startTime, endTime }` interval.
- A candidate slot is a start time on the 15-minute grid within working hours.
- A candidate is *free* when `[start, start + serviceDuration)` overlaps no busy interval
  and starts no earlier than venue-local "now".
- All times treated as venue-local wall-clock; no UTC conversion of endpoint times.
  "Today"/"now" are computed in `VENUE_TIMEZONE`.

**PII minimization.** The tool reduces the raw payload to bare busy intervals before any
availability result is returned. Customer names, phone numbers, emails, prices, and all
other appointment metadata never enter the model prompt, the model context, or the gateway.

**The one tool — `findAvailability`.** Parameters: `service`, `dateFrom`, `dateTo`,
optional `preferredTime`. It fetches the calendar for the range, strips to busy intervals,
computes the free-slot list, and returns a clean structured result (the free slots, and
whether `preferredTime` is among them). The model's role is only to narrate:
- `preferredTime` present and free → confirm it
- `preferredTime` present and taken → nearest few alternatives
- no `preferredTime` (open range) → grouped-by-day summary

**Date handling.** The system prompt injects venue-local today plus the working hours,
slot step, and service map. The model resolves relative phrases to explicit ISO dates and
passes them to the tool. If no service is named, the model asks which one before calling
the tool.

**App shape.** A chat route handler (`streamText` + the `findAvailability` tool + system
prompt, reading `TW_COOKIE` and `AI_GATEWAY_API_KEY` server-side); a client chat page using
the AI SDK `useChat` hook; a `lib`-level module holding the Treatwell fetch, the PII-stripping
reducer, and the pure availability computation; and the configuration-constants module.

## Testing Decisions

**What makes a good test here.** Tests assert external behavior — given a calendar payload
and a request, the correct free slots come out — not internal structure. They must not
assert on how intervals are represented internally, how the fetch is wired, or how the model
phrases its answer.

**The single seam.** Availability is a pure function: it takes an already-fetched calendar
payload plus the request (`service`, `dateFrom`, `dateTo`, optional `preferredTime`), the
config (working hours, slot step, timezone), and a fixed "now", and returns the free-slot
result. Fetching (cookie'd HTTP) happens upstream and is injected as data, so tests never
touch the network, the cookie, or the LLM. This is the highest seam that still isolates all
the real logic.

**Fixtures.** The real payload captured from Treatwell Connect (week of 2026-07-27 to
2026-08-02, employee 609398) is the primary fixture. Additional trimmed fixtures for edge
cases as needed.

**Representative cases to cover.**
- makeup (90m) at 15:00 on a day with a conflicting appointment → taken, alternatives returned
- eyebrows (30m) fitting a gap between two adjacent appointments → free
- a `blocks` multi-day away period (e.g. the `budapest` block on 2026-08-02) → whole day unavailable
- a single-day block (e.g. lunch `pietų pertrauka`) removing a mid-day slot
- a candidate earlier than venue-local "now" on today's date → excluded
- an open-ended multi-day range → free slots present across multiple days, grouped

**Boundaries left untested (thin wrappers, no logic):** the cookie'd `fetch` to Treatwell,
the AI SDK route / `streamText` call, and the `useChat` client.

**Prior art.** None yet — this is the first tested module in the repo. It establishes the
fixture-driven pure-function pattern for availability logic.

## Out of Scope

- Any write operations: creating, cancelling, or rescheduling bookings.
- Multiple employees or multiple venues.
- A sustainable / automated authentication mechanism (headless login, credential storage,
  session refresh, captcha/2FA). MVP is manual cookie paste only.
- The real Treatwell service/offer catalog and its `offerId`/`skuId` values — the MVP uses
  a fixed three-service duration map, not Treatwell's actual offers.
- Any UI beyond a basic chat page.
- Persisting conversation history beyond the live session.

## Further Notes

- The calendar endpoint returns *busy* time, not *free* time; the value of the app is the
  deterministic computation of free = working hours − appointments − blocks.
- Working hours have no authoritative field in the payload, hence the configurable constant.
- `availabilityRuleTypeCode` values observed: `D` (single-day personal blocks), `A` (a
  personal appointment block), `P` (multi-day away periods, pre-expanded per day). The MVP
  treats all block rows as busy regardless of code; decoding the codes further is unnecessary
  for correctness.
- Keeping the availability decision in code (not the model) is deliberate: it removes LLM
  arithmetic from the trust path and makes the tool the single source of truth.
