import type {
  AppConfig,
  BookConfig,
  ModelRoles,
  Preset,
  PresetRoles,
  RoleConfig,
} from "@/lib/schemas";
import { PROMPT_DEFAULTS } from "@/lib/ai/prompt-definitions";
import {
  DEFAULT_PRESET_ID,
  DEFAULT_IMAGE_PROMPTER_PARAMS,
  DEFAULT_IMAGE_PROMPTER_PROMPT,
  DEFAULT_TITLE_PARAMS,
  DEFAULT_TITLE_PROMPT,
} from "@/lib/presets/constants";

const PLANNER_PROMPT = PROMPT_DEFAULTS.planner_system;
const EXECUTOR_PROMPT = PROMPT_DEFAULTS.executor_system;
const SUMMARIZER_PROMPT = PROMPT_DEFAULTS.summarizer_system;

export const DEFAULT_ROLE_PROMPTS = {
  planner: PLANNER_PROMPT,
  executor: EXECUTOR_PROMPT,
  summarizer: SUMMARIZER_PROMPT,
  imagePrompter: DEFAULT_IMAGE_PROMPTER_PROMPT,
  titleGenerator: DEFAULT_TITLE_PROMPT,
} as const;

export const DEFAULT_ROLE_PARAMS = {
  planner: {
    temperature: 0.7,
    topP: 1,
    topK: 0,
    frequencyPenalty: 0,
    presencePenalty: 0,
    reasoningEffort: "",
    advancedJson: "",
  },
  executor: {
    temperature: 0.85,
    topP: 1,
    topK: 0,
    frequencyPenalty: 0,
    presencePenalty: 0,
    reasoningEffort: "",
    advancedJson: "",
  },
  summarizer: {
    temperature: 0.3,
    topP: 1,
    topK: 0,
    frequencyPenalty: 0,
    presencePenalty: 0,
    reasoningEffort: "",
    advancedJson: "",
  },
  imagePrompter: { ...DEFAULT_IMAGE_PROMPTER_PARAMS },
  titleGenerator: { ...DEFAULT_TITLE_PARAMS },
} as const;

export function createDefaultRoles(): PresetRoles {
  return {
    planner: {
      systemPrompt: PLANNER_PROMPT,
      injectionAfterSystemPrompt: "",
      injectionAfterLastMessage: "",

      contextAnchorRole: "system",
      params: { ...DEFAULT_ROLE_PARAMS.planner },
    },
    executor: {
      systemPrompt: EXECUTOR_PROMPT,
      injectionAfterSystemPrompt: "",
      injectionAfterLastMessage: "",

      contextAnchorRole: "system",
      params: { ...DEFAULT_ROLE_PARAMS.executor },
    },
    summarizer: {
      systemPrompt: SUMMARIZER_PROMPT,
      injectionAfterSystemPrompt: "",
      injectionAfterLastMessage: "",

      contextAnchorRole: "system",
      params: { ...DEFAULT_ROLE_PARAMS.summarizer },
    },
    imagePrompter: {
      systemPrompt: DEFAULT_IMAGE_PROMPTER_PROMPT,
      injectionAfterSystemPrompt: "",
      injectionAfterLastMessage: "",

      contextAnchorRole: "system",
      params: { ...DEFAULT_ROLE_PARAMS.imagePrompter },
    },
    titleGenerator: {
      systemPrompt: DEFAULT_TITLE_PROMPT,
      injectionAfterSystemPrompt: "",
      injectionAfterLastMessage: "",

      contextAnchorRole: "system",
      params: { ...DEFAULT_ROLE_PARAMS.titleGenerator },
    },
  };
}

export function createDefaultPreset(timestamp = new Date().toISOString()): Preset {
  return {
    id: DEFAULT_PRESET_ID,
    name: "Default / General Fiction",
    description:
      "The app's original planning, drafting, and continuity prompts. A general-purpose starting point for long-form fiction.",
    builtIn: true,
    roles: createDefaultRoles(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function clonePresetRoles(roles: PresetRoles): PresetRoles {
  return JSON.parse(JSON.stringify(roles)) as PresetRoles;
}

export function normalizeConfig(config: AppConfig): AppConfig {
  const presets = config.presets.map((preset) =>
    preset.id === DEFAULT_PRESET_ID ? { ...preset, builtIn: true } : preset,
  );

  if (!presets.some((preset) => preset.id === DEFAULT_PRESET_ID)) {
    presets.unshift(createDefaultPreset(config.updatedAt));
  }

  presets.sort((a, b) => {
    if (a.id === DEFAULT_PRESET_ID) return -1;
    if (b.id === DEFAULT_PRESET_ID) return 1;
    return 0;
  });

  const defaultPresetId = presets.some(
    (preset) => preset.id === config.defaultPresetId,
  )
    ? config.defaultPresetId
    : DEFAULT_PRESET_ID;

  return { ...config, presets, defaultPresetId };
}

export function resolvePreset(config: AppConfig, presetId?: string): Preset {
  const normalized = normalizeConfig(config);
  return (
    normalized.presets.find((preset) => preset.id === presetId) ??
    normalized.presets.find((preset) => preset.id === normalized.defaultPresetId) ??
    normalized.presets[0]
  );
}

export function createBookConfigSnapshot(
  preset: Preset,
  models: ModelRoles,
  timestamp = new Date().toISOString(),
): BookConfig {
  return {
    version: 1,
    presetId: preset.id,
    presetName: preset.name,
    models: {
      planner: models.planner,
      executor: models.executor,
      summarizer: models.summarizer,
      imagePrompter: models.imagePrompter ?? "",
    },
    roles: clonePresetRoles(preset.roles),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function buildFallbackBookConfig(config: AppConfig): BookConfig {
  return createBookConfigSnapshot(resolvePreset(config), config.models);
}

export function roleConfig(roles: PresetRoles, role: keyof PresetRoles): RoleConfig {
  return roles[role];
}

