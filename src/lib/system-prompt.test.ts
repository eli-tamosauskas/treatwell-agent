import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "./system-prompt";

describe("buildSystemPrompt", () => {
  const prompt = buildSystemPrompt("2026-08-01");

  it("injects the venue-local today", () => {
    expect(prompt).toContain("2026-08-01");
  });

  it("lists every service with its duration", () => {
    expect(prompt).toContain("eyebrows");
    expect(prompt).toContain("30");
    expect(prompt).toContain("hairstyle");
    expect(prompt).toContain("60");
    expect(prompt).toContain("makeup");
    expect(prompt).toContain("90");
  });

  it("lists every service with its list price in the fixed €NNN format", () => {
    expect(prompt).toContain("€50");
    expect(prompt).toContain("€90");
    expect(prompt).toContain("€110");
  });

  it("quotes list prices only when asked, never volunteered", () => {
    expect(prompt.toLowerCase()).toContain("price");
    expect(prompt.toLowerCase()).toContain("only when asked");
  });

  it("states the working-hours window and slot step", () => {
    expect(prompt).toContain("08:00");
    expect(prompt).toContain("20:00");
    expect(prompt).toContain("15");
  });

  it("carries the presentation rules for the three answer shapes", () => {
    expect(prompt.toLowerCase()).toContain("confirm");
    expect(prompt.toLowerCase()).toContain("alternative");
    expect(prompt.toLowerCase()).toContain("open range");
  });

  it("instructs range/grouped narration from runs, not the raw slot list", () => {
    expect(prompt).toContain("runs");
    expect(prompt).toContain("between {from} and {to}");
    // Structure by volume: a sentence for one–two days, one line per day for more.
    expect(prompt.toLowerCase()).toContain("natural sentence");
    expect(prompt.toLowerCase()).toContain("one line per day");
    expect(prompt.toLowerCase()).toContain("slots");
    // Forbids dumping the raw slot list.
    expect(prompt.toLowerCase()).toMatch(/never dump the raw/);
  });

  it("instructs brevity and forbids enumerating slot times or a checked-preamble", () => {
    expect(prompt.toLowerCase()).toContain("be brief");
    expect(prompt.toLowerCase()).toContain("never enumerate the individual start times");
    expect(prompt.toLowerCase()).toContain("never announce that you checked");
  });

  it("instructs a first-turn-only greeting with sparing emoji", () => {
    expect(prompt.toLowerCase()).toContain("first");
    expect(prompt.toLowerCase()).toContain("greet");
    expect(prompt.toLowerCase()).toContain("emoji");
  });

  it("closes with a reply nudge and forbids promising to book", () => {
    expect(prompt.toLowerCase()).toContain("never say or imply that you'll make");
    expect(prompt).not.toContain("Would you like me to book");
  });

  it("carries the read-only-on-booking-request behavior", () => {
    expect(prompt.toLowerCase()).toContain("only check availability");
    expect(prompt.toLowerCase()).toContain("happens elsewhere");
  });

  it("instructs the model to ask which service when none is named", () => {
    expect(prompt.toLowerCase()).toContain("ask");
    // The which-service ask covers a bare price question too, not just availability.
    expect(prompt.toLowerCase()).toContain("or how much");
  });
});
