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

  it("states the working-hours window and slot step", () => {
    expect(prompt).toContain("08:00");
    expect(prompt).toContain("20:00");
    expect(prompt).toContain("15");
  });

  it("carries the presentation rules for the three answer shapes", () => {
    expect(prompt.toLowerCase()).toContain("confirm");
    expect(prompt.toLowerCase()).toContain("alternative");
    expect(prompt.toLowerCase()).toContain("grouped");
  });

  it("instructs the model to ask which service when none is named", () => {
    expect(prompt.toLowerCase()).toContain("ask");
  });
});
