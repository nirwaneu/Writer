import { PROMPT_DEFAULTS } from "@/lib/ai/prompt-definitions";

export const DEFAULT_PRESET_ID = "default-general-fiction";

export const AI_ROLES = ["planner", "executor", "summarizer", "imagePrompter"] as const;
export type AIRole = (typeof AI_ROLES)[number];

export const MODEL_ROLES = [...AI_ROLES, "surgical"] as const;
export type ModelRole = (typeof MODEL_ROLES)[number];

export const PRESET_EDIT_ROLES = [...AI_ROLES, "titleGenerator"] as const;
export type PresetRole = (typeof PRESET_EDIT_ROLES)[number];

export const CORE_ROLES = ["planner", "executor", "summarizer"] as const;
export type CoreRole = (typeof CORE_ROLES)[number];

export const ROLE_LABELS: Record<PresetRole, string> = {
  planner: "Planner",
  executor: "Executor",
  summarizer: "Summarizer",
  imagePrompter: "Image Prompter",
  titleGenerator: "Title Generation",
};

export const MODEL_ROLE_LABELS: Record<ModelRole, string> = {
  planner: "Planner",
  executor: "Executor",
  summarizer: "Summarizer",
  imagePrompter: "Image Prompter",
  surgical: "Surgical Polish",
};

export const DEFAULT_TITLE_PROMPT = PROMPT_DEFAULTS.title_generator_system;

export const DEFAULT_TITLE_PARAMS = {
  temperature: 0.8,
  topP: 1,
  topK: 0,
  frequencyPenalty: 0,
  presencePenalty: 0,
  reasoningEffort: "",
  advancedJson: "",
} as const;

export const DEFAULT_IMAGE_PROMPTER_PROMPT = PROMPT_DEFAULTS.image_prompter_system;

export const DEFAULT_IMAGE_PROMPTER_PARAMS = {
  temperature: 0.75,
  topP: 1,
  topK: 0,
  frequencyPenalty: 0,
  presencePenalty: 0,
  reasoningEffort: "",
  advancedJson: "",
} as const;

