# PRD: Humanize Availability Responses (warm tone + contiguous-run narration)

Status: needs-triage

Builds on the availability-chat MVP (`.scratch/availability-chat/`): the tool now
returns real availability end-to-end. This effort is about how those answers *read*.

## Problem Statement

The availability assistant works, but it reads like a machine. A practitioner
asking "anything free this week?" gets a wall of discrete grid times:

> Eyebrows (30 min) openings this week:
> - Thu 2026-08-06: 16:00, 16:15, 16:30, 16:45, 17:00, 17:15, 17:30, 17:45, 18:00, 19:30
> - Fri 2026-08-07: 16:30
>
> Would you like me to book one of these? If so, tell me the date and start time.

Two things are wrong. First, it doesn't sound like a person — no greeting, no
warmth, and it dumps every 15-minute slot instead of speaking in the ranges a
human scheduler naturally uses ("Thursday any time between 16:00 and 18:00"). A
real person would say the same thing in one warm sentence. Second, the closing
line **over-promises**: it offers to book — "Would you like me to book one of
these?" — when the assistant is strictly read-only and cannot create, change, or
cancel appointments. That's a correctness leak against the assistant's own
boundary.

## Solution

Make the assistant read like a warm, competent human scheduler, without loosening
any correctness guarantee.

The same question should read closer to:

> Hello 😊
>
> This week I could do Thursday any time between 16:00 and 18:00, and I've also
> got 19:30 free. Friday there's a 16:30 slot.
>
> Any of those work for you?

Two changes deliver this:

1. **Speak in ranges, computed in code.** The deterministic core collapses
   contiguous free starts into ranges before the model ever sees them. The model
   narrates ranges; it never does the grid arithmetic itself.
2. **Warm, honest narration.** The system prompt gains a voice — a first-turn
   greeting, sparing emoji, prose-when-short / lines-when-long structure, and a
   closing nudge that invites a reply without ever promising to book.

Read-only stays read-only: nothing here lets the assistant create, hold, or
change a booking.

## User Stories

1. As a practitioner, I want the assistant to greet me warmly at the start of a
   conversation, so that it feels like talking to a person rather than a form.
2. As a practitioner, I want my openings described in natural ranges ("any time
   between 16:00 and 18:00"), so that I can grasp my day at a glance instead of
   parsing a list of times.
3. As a practitioner, I want a run of free slots with a gap in it split into
   separate mentions ("...between 16:00 and 18:00, and also 19:30"), so that the
   assistant never implies I'm free during a time I'm actually booked.
4. As a practitioner, I want the assistant to speak in whole sentences when there
   are only a day or two to mention, so that short answers feel conversational.
5. As a practitioner, I want the assistant to lay days out one per line when a
   whole week has openings, so that a busy week stays scannable instead of
   becoming a run-on paragraph.
6. As a practitioner, I want contractions and casual phrasing ("could also do",
   "any of those work?"), so that the tone matches how I'd actually talk to a
   colleague.
7. As a practitioner, I want at most a single, tasteful emoji, so that the warmth
   reads as friendly rather than gimmicky.
8. As a practitioner, I want the assistant not to greet me again on every
   follow-up message, so that it doesn't feel robotic or scripted.
9. As a practitioner, I want the closing line to invite my reply without claiming
   it will book the slot, so that I'm never misled about what the assistant can
   actually do.
10. As a practitioner, when I reply "yes, book Thursday at 16:00", I want the
    assistant to gently explain that it can only check availability and that
    booking happens elsewhere, so that I understand the boundary without feeling
    rebuffed.
11. As a practitioner asking about a specific time that's free, I want a plain,
    warm confirmation of that exact slot, so that a direct question gets a direct
    answer.
12. As a practitioner asking about a specific time that's taken, I want the
    nearest few free alternatives offered warmly, so that a "no" still moves me
    forward.
13. As the venue owner, I want the range the assistant quotes to be bounded by
    the last *bookable start* for the service's full duration, so that a longer
    treatment is never implied to fit into a slot that can't hold it.
14. As the venue owner, I want the availability decision (including which slots
    are contiguous) to stay in code and out of the model, so that a cheap model
    can never miscount the grid and quietly misstate my availability.
15. As a developer, I want the run-grouping covered by fixture tests at the
    existing computation seam, so that contiguity and gap-splitting are locked in
    without a new test harness.
16. As a developer, I want the discrete `slots` list to remain on the tool result
    alongside the new ranges, so that specific-time confirmation logic keeps
    working unchanged.

## Implementation Decisions

- **Two seams, both already under test:**
  - **`computeAvailability`** (the pure decision core) gains contiguous-run
    grouping.
  - **`buildSystemPrompt`** (the narration layer) gains the warm voice.
  - No new modules; no new test files.

- **Contiguous-run grouping lives in the pure core, not the model** (per the
  standing "keep the decision out of the model" principle). `computeAvailability`
  already emits `slots` per day; it additionally emits `runs`: the free starts of
  each day collapsed into contiguous stretches.

- **Run shape.** Each run is `{ date, from, to }` where `from` is the first free
  start and `to` is the **last bookable start** of the stretch (both `HH:MM`,
  venue-local). Two consecutive free starts belong to the same run iff
  `next = prev + slotStep`. Any grid gap ends the run and begins a new one. A lone
  free start is a run with `from === to`. Runs are ordered chronologically within
  and across days.

- **`to` is a start time, not an end time.** Because every start in a run is
  itself a validated free slot for the service's full duration, quoting the range
  as "between {from} and {to}" is honest: starting at `to` still fits the whole
  treatment. This is what makes the last-bookable-start framing safe for longer
  services.

- **`runs` is added to `FindAvailabilityResult`; `slots` stays.** The
  preferred-time path (`preferredTimeAvailable`) continues to read from `slots`
  and is unchanged. Nothing downstream of the tool result breaks.

- **System prompt voice** (rewrite of the "How to present results" section):
  - Greet naturally on the **first** assistant turn of a conversation only; do
    not re-greet on later turns.
  - At most **one** optional emoji, at a greeting or closing moment — never in the
    middle of listing openings.
  - Contractions and casual connectors throughout.
  - **Structure by volume:** one or two days with openings → a natural sentence or
    two; three or more days → warm framing but one line per day so it stays
    scannable. The model chooses based on how much there is to say.
  - **Narrate from `runs`:** phrase each stretch as "any time between {from} and
    {to}", and a single-slot run as just that time. Never dump the raw `slots`
    list.
  - **Honest close:** end with a warm nudge to continue ("Any of those work for
    you?") that never states or implies the assistant will make the booking.
  - **Read-only boundary:** if the practitioner asks to book, the assistant
    gently explains it can only check availability and that booking happens
    elsewhere — it never claims to have booked or to be booking.
  - The three existing answer shapes are preserved: specific-time-free → plain
    warm confirmation; specific-time-taken → nearest few alternatives; open
    range → the grouped, range-based summary above.

## Testing Decisions

- **What makes a good test here:** assert externally observable outputs — the
  shape of the runs the core produces, and the presence of the narration *rules*
  in the prompt string. Do not assert the model's actual prose (non-deterministic)
  and do not reach into private helpers.

- **`computeAvailability` (fixtures, at the existing seam).** Extend
  `availability.test.ts`. Cover:
  - A contiguous block of free starts collapses to a single `{ from, to }` run
    with `to` = the last start.
  - A gap in the grid splits one day into two runs (the Thursday
    16:00–18:00 / 19:30 case).
  - A single free start yields a run with `from === to`.
  - Runs respect service duration: a longer service's last run does not extend
    past the last start whose full treatment fits before close.
  - An empty day yields no runs.
  - Prior art: the existing fixture-driven cases in `availability.test.ts` and the
    week fixture in `fixtures/calendar-week.ts`.

- **`buildSystemPrompt` (structural assertions).** Extend
  `system-prompt.test.ts` to assert the new rules are present in the prompt —
  e.g. that it instructs range/grouped narration, forbids promising to book, and
  carries the read-only-on-booking-request behavior. Follow the existing
  `toContain` structural style; do not assert tone or exact wording.

## Out of Scope

- Actually booking, holding, or reserving a slot — the assistant stays strictly
  read-only. The "book it" case is handled only by a graceful explanation.
- Any change to the fetch/PII-reducer boundary or the tool's network wiring from
  the availability-chat MVP.
- Localisation / multi-language tone, and configurable voice/persona.
- Multi-venue or multi-practitioner narration.
- Automated evaluation of subjective warmth (e.g. an LLM-judge tone harness).

## Further Notes

- The over-promising close ("Would you like me to book one of these?") is a
  pre-existing correctness leak against the read-only boundary; this spec fixes it
  as part of the closing-line rewrite.
- Model tier matters: the chat runs on a cheap Flash-class model
  (`openai/gpt-5-nano` by default). Keeping run-grouping in code rather than the
  prompt is what makes the "decision stays out of the model" guarantee safe on
  that tier.
