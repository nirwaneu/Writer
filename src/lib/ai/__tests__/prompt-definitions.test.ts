import { describe, expect, it } from "vitest";
import {
  PROMPT_DEFAULTS,
  PROMPT_DEFINITIONS,
  resolveRolePrompt,
  type PromptMap,
} from "@/lib/ai/prompt-definitions";

describe("prompt definitions", () => {
  it("defines a unique, non-empty default for every prompt", () => {
    const keys = PROMPT_DEFINITIONS.map((definition) => definition.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const definition of PROMPT_DEFINITIONS) {
      expect(definition.defaultValue.trim().length).toBeGreaterThan(0);
      expect(PROMPT_DEFAULTS[definition.key]).toBe(definition.defaultValue);
    }
  });

  it("prefers a custom book override and otherwise uses the global prompt", () => {
    const prompts = { ...PROMPT_DEFAULTS, planner_system: "GLOBAL PROMPT" } as PromptMap;
    expect(resolveRolePrompt(prompts, "planner_system")).toBe("GLOBAL PROMPT");
    expect(
      resolveRolePrompt(prompts, "planner_system", PROMPT_DEFAULTS.planner_system),
    ).toBe("GLOBAL PROMPT");
    expect(resolveRolePrompt(prompts, "planner_system", "CUSTOM PROMPT")).toBe("CUSTOM PROMPT");
  });
});