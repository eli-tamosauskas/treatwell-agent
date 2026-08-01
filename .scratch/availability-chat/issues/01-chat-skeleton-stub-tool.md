# 01 — Chat skeleton with a stubbed findAvailability tool

**What to build:** A working chat page where the practitioner types a question and gets
a streamed answer from the model, going thinly through every layer. The model is given a
`findAvailability` tool that (for now) returns hardcoded free slots, and a system prompt
carrying venue-local today, the service map, and the presentation rules (confirm exact
hit / nearest alternatives / grouped-by-day for open ranges). This ticket also lays down
the config-constants module and env wiring that later tickets build on.

Demoable: ask "anything Friday for makeup?" → the model calls the tool → narrates the
stub slots in prose. Proves the Next 16 / AI SDK wiring, the AI Gateway connection,
tool-calling, and locks the tool's result contract (bare slot data, no PII).

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Read the bundled Next docs (`node_modules/next/dist/docs/`) and AI SDK docs before writing framework code (AGENTS.md: this Next.js has breaking changes).
- [ ] Chat page uses the AI SDK `useChat` hook: message list + input, running conversation in-session.
- [ ] Route handler streams via `streamText` through Vercel AI Gateway using `AI_GATEWAY_API_KEY`; model referenced as a swappable string defaulting to a cheap Flash-class model (no provider SDK packages).
- [ ] A `findAvailability` tool is registered with params `service`, `dateFrom`, `dateTo`, optional `preferredTime`, returning a hardcoded free-slot result shaped as bare slot data (no customer fields).
- [ ] System prompt injects venue-local today (Europe/Vilnius), the service→duration map, and the presentation rules; if no service is named the model asks which one before calling the tool.
- [ ] Config-constants module exists: `VENUE_ID`, `EMPLOYEE_ID`, `VENUE_TIMEZONE`, working-hours window, `SLOT_STEP = 15`, service→duration map.
- [ ] Env wiring for `AI_GATEWAY_API_KEY` and a `TW_COOKIE` placeholder, read server-side only.
- [ ] Demo: an open-ended and a specific-time question each produce a tool call and a narrated answer from the stub data.
