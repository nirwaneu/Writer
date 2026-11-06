import { describe, expect, it } from "vitest";
import { parseSurgicalTakes } from "@/lib/ai/surgical";
import { surgicalPresetInputSchema } from "@/lib/schemas";
import { DEFAULT_SURGICAL_PRESETS } from "@/lib/surgical/defaults";

describe("parseSurgicalTakes", () => {
  it("parses the documented JSON object", () => {
    expect(parseSurgicalTakes('{"takes":["First take.","Second take."]}')).toEqual([
      "First take.",
      "Second take.",
    ]);
  });

  it("parses fenced JSON", () => {
    expect(
      parseSurgicalTakes('```json\n{"takes":["A","B"]}\n```'),
    ).toEqual(["A", "B"]);
  });

  it("falls back to delimiter-separated takes", () => {
    expect(parseSurgicalTakes("First take.\n\n---\n\nSecond take.")).toEqual([
      "First take.",
      "Second take.",
    ]);
  });

  it("falls back to the whole output when no delimiters exist", () => {
    expect(parseSurgicalTakes("not json and no delimiters")).toEqual([
      "not json and no delimiters",
    ]);
  });
});

describe("surgical preset defaults", () => {
  it("has unique IDs and labels within the UI limit", () => {
    const ids = DEFAULT_SURGICAL_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const preset of DEFAULT_SURGICAL_PRESETS) {
      expect(preset.label.length).toBeLessThanOrEqual(20);
      expect(preset.instruction.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("surgical preset validation", () => {
  it("rejects labels over 20 characters", () => {
    expect(
      surgicalPresetInputSchema.safeParse({
        label: "x".repeat(21),
        instruction: "Rewrite it.",
        icon: "",
        active: true,
      }).success,
    ).toBe(false);
  });

  it("requires an instruction", () => {
    expect(
      surgicalPresetInputSchema.safeParse({
        label: "Tighten",
        instruction: "",
        icon: "",
        active: true,
      }).success,
    ).toBe(false);
  });

  it("accepts a valid preset", () => {
    expect(
      surgicalPresetInputSchema.safeParse({
        label: "Tighten",
        instruction: "Strip filler.",
        icon: "✂️",
        active: true,
      }).success,
    ).toBe(true);
  });
});