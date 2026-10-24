import { describe, expect, it } from "vitest";
import {
  buildFallbackBookConfig,
  createBookConfigSnapshot,
  createDefaultPreset,
  normalizeConfig,
  resolvePreset,
} from "@/lib/presets/defaults";
import { DEFAULT_PRESET_ID } from "@/lib/presets/constants";
import type { AppConfig } from "@/lib/schemas";

const models = {
  planner: "planner-model",
  executor: "executor-model",
  summarizer: "summarizer-model",
  imagePrompter: "image-prompter-model",
};

const config: AppConfig = {
  version: 1,
  baseUrl: "http://localhost:8787/v1",
  apiKey: "",
  models,
  providers: [],
  connection: { ok: true },
  presets: [],
  defaultPresetId: "missing-preset",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("default preset", () => {
  it("has the base id and all three roles", () => {
    const preset = createDefaultPreset();
    expect(preset.id).toBe(DEFAULT_PRESET_ID);
    expect(preset.builtIn).toBe(true);
    expect(preset.roles.planner.systemPrompt).toContain("You are the Planner");
    expect(preset.roles.executor.systemPrompt).toContain("You are the Executor");
    expect(preset.roles.summarizer.systemPrompt).toContain("Story Vault");
    expect(preset.roles.titleGenerator.systemPrompt).toContain(
      "catchy and relevant title",
    );
    expect(preset.roles.executor.params.temperature).toBeGreaterThan(0);
  });
});

describe("normalizeConfig", () => {
  it("adds the base preset and repairs a missing default", () => {
    const normalized = normalizeConfig(config);
    expect(normalized.presets[0].id).toBe(DEFAULT_PRESET_ID);
    expect(normalized.defaultPresetId).toBe(DEFAULT_PRESET_ID);
  });

  it("keeps a valid custom default", () => {
    const custom = createDefaultPreset();
    const normalized = normalizeConfig({
      ...config,
      presets: [{ ...custom, id: "custom", builtIn: false, name: "Custom" }],
      defaultPresetId: "custom",
    });
    expect(normalized.presets.some((preset) => preset.id === DEFAULT_PRESET_ID)).toBe(true);
    expect(normalized.defaultPresetId).toBe("custom");
    expect(resolvePreset(normalized, "custom").name).toBe("Custom");
  });
});

describe("copy-on-write snapshots", () => {
  it("copies prompts and params into an independent book config", () => {
    const preset = createDefaultPreset();
    const snapshot = createBookConfigSnapshot(preset, models);
    preset.roles.planner.systemPrompt = "changed after snapshot";
    expect(snapshot.roles.planner.systemPrompt).not.toBe("changed after snapshot");
    expect(snapshot.models).toEqual(models);
    expect(snapshot.presetId).toBe(preset.id);
  });

  it("falls back to the default preset and global models", () => {
    const fallback = buildFallbackBookConfig(normalizeConfig(config));
    expect(fallback.models).toEqual(models);
    expect(fallback.roles.executor.systemPrompt).toContain("You are the Executor");
  });
});
