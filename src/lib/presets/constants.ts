export const DEFAULT_PRESET_ID = "default-general-fiction";

export const AI_ROLES = ["planner", "executor", "summarizer", "imagePrompter"] as const;
export type AIRole = (typeof AI_ROLES)[number];

export const CORE_ROLES = ["planner", "executor", "summarizer"] as const;
export type CoreRole = (typeof CORE_ROLES)[number];

export const ROLE_LABELS: Record<AIRole, string> = {
  planner: "Planner",
  executor: "Executor",
  summarizer: "Summarizer",
  imagePrompter: "Image Prompter",
};

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

