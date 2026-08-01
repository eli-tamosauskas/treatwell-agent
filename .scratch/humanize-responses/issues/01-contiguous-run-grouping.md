# 01 — Contiguous-run grouping in the availability core

Status: ready-for-agent

## Parent

`.scratch/humanize-responses/PRD.md`

## What to build

Teach the deterministic availability core to describe each day's openings as
contiguous ranges, not just a list of grid times, so the narration layer can
later speak in ranges instead of dumping every 15-minute slot.

`computeAvailability` already produces per-day free `slots`. It additionally
produces `runs`: each day's free start times collapsed into contiguous stretches.
A run is `{ date, from, to }` where `from` is the first free start of the stretch
and `to` is the **last bookable start** of the stretch (both `HH:MM`,
venue-local). Two consecutive free starts belong to the same run iff
`next === prev + slotStep`; any gap on the grid ends the run and starts a new one.
A lone free start is a run with `from === to`. Runs are ordered chronologically
within and across days.

`to` is deliberately a *start* time, not an end time: because every start in a run
is itself a validated free slot for the service's full duration, quoting "between
{from} and {to}" is honest — starting at `to` still fits the whole treatment. This
is what keeps the range framing safe for longer services.

Add `runs` to the `FindAvailabilityResult` contract alongside the existing
`slots`. Everything downstream stays unchanged: the `preferredTime` path keeps
reading from `slots`, and `slots` / `preferredTimeAvailable` are untouched.

## Acceptance criteria

- [ ] `computeAvailability` returns a `runs` array on its result, in addition to `slots`.
- [ ] Each run is `{ date, from, to }` as `HH:MM` venue-local times, with `to` = the last bookable start of the contiguous stretch.
- [ ] Consecutive free starts one `slotStep` apart form a single run; any grid gap splits into separate runs.
- [ ] A single isolated free start yields a run with `from === to`.
- [ ] Runs never extend past the last start whose full service duration fits before close (verified with a longer service).
- [ ] A day with no free slots contributes no runs.
- [ ] `slots` and `preferredTimeAvailable` behavior is unchanged.
- [ ] `runs` is added to the `FindAvailabilityResult` type.
- [ ] Fixture tests in `availability.test.ts` cover: contiguous block → one run; grid gap → two runs (the Thursday 16:00–18:00 / 19:30 case); lone start → `from === to`; duration bounds `to`; empty day → no runs. Reuse the existing week fixture where it fits; no new test file.

## Blocked by

None - can start immediately
