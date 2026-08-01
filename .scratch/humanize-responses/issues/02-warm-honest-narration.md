# 02 — Warm, honest narration in the system prompt

Status: ready-for-agent

## Parent

`.scratch/humanize-responses/PRD.md`

## What to build

Give the availability assistant the voice of a warm, competent human scheduler,
and close a pre-existing correctness leak — without loosening any correctness
guarantee. All of this lives in the system prompt (`buildSystemPrompt`); the
availability decision stays in code.

Rewrite the "How to present results" guidance so the model:

- **Greets on the first assistant turn only** — a natural greeting to open a
  conversation, never re-greeting on follow-up messages.
- Uses **at most one** tasteful emoji, at a greeting or closing moment, never mid-list.
- Writes with contractions and casual connectors ("could also do", "any of those
  work?").
- **Structures by volume:** one or two days with openings → a natural sentence or
  two; three or more days → warm framing but one line per day so a busy week stays
  scannable. The model chooses based on how much there is to say.
- **Narrates from `runs`** (added in issue 01): phrase each stretch as "any time
  between {from} and {to}", and a single-slot run as just that time. Never dumps
  the raw `slots` list.
- **Closes honestly:** ends with a warm nudge to continue ("Any of those work for
  you?") that never states or implies the assistant will make the booking. This
  replaces the current over-promising close ("Would you like me to book one of
  these?"), which is a correctness leak against the read-only boundary.
- **Holds the read-only boundary on a booking request:** if the practitioner asks
  to book, the assistant gently explains it can only check availability and that
  booking happens elsewhere — it never claims to have booked or to be booking.

The three existing answer shapes are preserved: specific-time-free → plain warm
confirmation; specific-time-taken → nearest few alternatives; open range → the
grouped, range-based summary above.

## Acceptance criteria

- [ ] The prompt instructs a first-turn-only greeting and no re-greeting on follow-ups.
- [ ] The prompt limits emoji to at most one, at a greeting/closing moment.
- [ ] The prompt instructs range/grouped narration from `runs` and forbids dumping the raw slot list.
- [ ] The prompt instructs structure-by-volume (sentence for one–two days, one line per day for three or more).
- [ ] The closing guidance invites a reply and explicitly forbids promising to book; the old "would you like me to book" phrasing is gone.
- [ ] The prompt carries the read-only-on-booking-request behavior (gentle explanation that booking happens elsewhere).
- [ ] The three answer shapes (specific-free, specific-taken, open-range) are still present.
- [ ] Structural `toContain`-style assertions in `system-prompt.test.ts` cover the new rules — range/grouped narration, no-promise-to-book, and read-only-on-booking. No assertions on tone or exact prose.

## Blocked by

- `.scratch/humanize-responses/issues/01-contiguous-run-grouping.md` (the narration reads from `runs`, which issue 01 produces)
