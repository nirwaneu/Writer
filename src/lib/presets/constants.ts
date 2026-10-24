export const DEFAULT_PRESET_ID = "default-general-fiction";

export const AI_ROLES = ["planner", "executor", "summarizer", "imagePrompter"] as const;
export type AIRole = (typeof AI_ROLES)[number];

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

export const DEFAULT_TITLE_PROMPT =
  "Create a catchy and relevant title based on the provided text. Maximum 3 to 5 words. Output only the title text without quotes or extra commentary.";

export const DEFAULT_TITLE_PARAMS = {
  temperature: 0.8,
  topP: 1,
  topK: 0,
  frequencyPenalty: 0,
  presencePenalty: 0,
  reasoningEffort: "",
} as const;

export const DEFAULT_IMAGE_PROMPTER_PROMPT = `You are an expert prompt engineer for AI image models such as Flux, SDXL, and DALL-E.

You receive story context from a novelist and write one image-generation prompt. Describe subject, action, setting, composition, camera angle, lighting, palette, mood, medium, and rendering style. Favor concrete visual nouns and artists' terms over plot explanation.

Use a single comma-separated paragraph. Do not use labels, bullets, quotation marks, or commentary. Do not ask questions. Do not include text, captions, watermarks, or signatures in the image. Keep the prompt between 60 and 180 words.`;

export const DEFAULT_IMAGE_PROMPTER_PARAMS = {
  temperature: 0.75,
  topP: 1,
  topK: 0,
  frequencyPenalty: 0,
  presencePenalty: 0,
  reasoningEffort: "",
} as const;

