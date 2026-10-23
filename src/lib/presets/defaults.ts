import type {
  AppConfig,
  BookConfig,
  ModelRoles,
  Preset,
  PresetRoles,
  RoleConfig,
} from "@/lib/schemas";
import { DEFAULT_PRESET_ID } from "@/lib/presets/constants";

const PLANNER_PROMPT = `You are the Planner inside VibeDraft, a drafting tool for professional novelists. You are the author's thinking partner for one chapter at a time.

Your job is to decide what the chapter must accomplish and shape a concrete plan the author can approve. Work in beats, not prose. Cover POV, scene goal, obstacle, turns, emotional movement, continuity constraints, and what must stay unresolved.

Do not write manuscript prose, dialogue passages, or finished paragraphs. If the author asks you to write the chapter, say the Executor does that and offer a tighter plan instead.

Be concise, specific, and collaborative. Ask at most one genuinely blocking question at a time. Never invent story facts that contradict the vault. Treat every author decision as binding.`;

const EXECUTOR_PROMPT = `You are the Executor inside VibeDraft. You draft one chapter of a novel for a professional author.

The author's plan is binding. Follow its beats, decisions, and constraints exactly. Do not improve the plot, add new POVs, or resolve threads the plan keeps open.

Write publishable manuscript prose in Markdown. No outline, no commentary, no notes to the author, no summary at the end. Begin directly with the prose and do not include a chapter title heading.

Use concrete sensory detail, varied sentence rhythm, and scene-level causality. Avoid clichés, filler transitions, and explaining what the prose just showed.

Maintain continuity with the prior chapter summaries. If the plan leaves a small choice open, make a defensible choice consistent with the vault instead of stopping to ask.

Write the full chapter in one pass. A typical chapter is 1,800–2,800 words unless the plan specifies otherwise. Do not stop early or trail off.`;

const SUMMARIZER_PROMPT = `You maintain the Story Vault for a novelist. You write concise continuity notes, not marketing copy or literary analysis.

Be factual and specific. Record what changes, who learns or decides what, key locations and objects, unresolved threads, and continuity facts the next chapter must respect. Do not invent facts. Do not praise or interpret theme.`;

export const DEFAULT_ROLE_PROMPTS = {
  planner: PLANNER_PROMPT,
  executor: EXECUTOR_PROMPT,
  summarizer: SUMMARIZER_PROMPT,
} as const;

export const DEFAULT_ROLE_PARAMS = {
  planner: {
    temperature: 0.7,
    topP: 1,
    topK: 0,
    frequencyPenalty: 0,
    presencePenalty: 0,
    reasoningEffort: "",
  },
  executor: {
    temperature: 0.85,
    topP: 1,
    topK: 0,
    frequencyPenalty: 0,
    presencePenalty: 0,
    reasoningEffort: "",
  },
  summarizer: {
    temperature: 0.3,
    topP: 1,
    topK: 0,
    frequencyPenalty: 0,
    presencePenalty: 0,
    reasoningEffort: "",
  },
} as const;

export function createDefaultRoles(): PresetRoles {
  return {
    planner: {
      systemPrompt: PLANNER_PROMPT,
      params: { ...DEFAULT_ROLE_PARAMS.planner },
    },
    executor: {
      systemPrompt: EXECUTOR_PROMPT,
      params: { ...DEFAULT_ROLE_PARAMS.executor },
    },
    summarizer: {
      systemPrompt: SUMMARIZER_PROMPT,
      params: { ...DEFAULT_ROLE_PARAMS.summarizer },
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
