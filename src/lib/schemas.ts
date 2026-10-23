import { z } from "zod";
import { DEFAULT_PRESET_ID } from "@/lib/presets/constants";

export const chapterStatusSchema = z.enum([
  "planned",
  "drafted",
  "summarized",
  "summary_failed",
  "summary_skipped",
]);

export const chapterSchema = z.object({
  number: z.number().int().positive(),
  title: z.string().min(1).max(200),
  summary: z.string().max(20_000).default(""),
  status: chapterStatusSchema.default("planned"),
  wordCount: z.number().int().nonnegative().default(0),
  summaryStale: z.boolean().default(false),
  updatedAt: z.string().min(1),
  summaryUpdatedAt: z.string().optional(),
});

export const characterSchema = z.object({
  name: z.string().min(1).max(120),
  role: z.string().max(200).default(""),
  description: z.string().max(4_000).default(""),
});

export const outlineSchema = z.object({
  version: z.literal(1),
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  premise: z.string().max(20_000).default(""),
  status: z.enum(["brainstorming", "active", "complete"]).default("active"),
  characters: z.array(characterSchema).max(100).default([]),
  chapters: z.array(chapterSchema).max(500).default([]),
  currentChapter: z.number().int().positive().default(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const chatAlternativeSchema = z.object({
  id: z.string().min(1),
  content: z.string(),
  reasoning: z.string().max(1_000_000).optional(),
  createdAt: z.string().min(1),
  model: z.string().optional(),
  failed: z.boolean().optional(),
});

export const chatMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  reasoning: z.string().max(1_000_000).optional(),
  createdAt: z.string().min(1),
  model: z.string().optional(),
  failed: z.boolean().optional(),
  alternatives: z.array(chatAlternativeSchema).max(50).optional(),
  activeAlternativeId: z.string().optional(),
});

export const chatSchema = z.object({
  version: z.literal(1),
  scope: z.union([z.literal("premise"), z.number().int().positive()]),
  messages: z.array(chatMessageSchema).max(2_000).default([]),
  updatedAt: z.string().min(1),
});

export const generationParamsSchema = z.object({
  temperature: z.number().min(0).max(2).default(0.7),
  topP: z.number().min(0).max(1).default(1),
  topK: z.number().int().min(0).max(200).default(0),
  frequencyPenalty: z.number().min(-2).max(2).default(0),
  presencePenalty: z.number().min(-2).max(2).default(0),
  reasoningEffort: z.string().max(100).default(""),
});

export const roleConfigSchema = z.object({
  systemPrompt: z.string().trim().min(1).max(30_000),
  params: generationParamsSchema,
});

export const presetRolesSchema = z.object({
  planner: roleConfigSchema,
  executor: roleConfigSchema,
  summarizer: roleConfigSchema,
});

export const presetSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(80),
  description: z.string().max(500).default(""),
  builtIn: z.boolean().default(false),
  roles: presetRolesSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const modelRolesSchema = z.object({
  planner: z.string().trim().min(1).max(500),
  executor: z.string().trim().min(1).max(500),
  summarizer: z.string().trim().min(1).max(500),
});

export const providerConnectionSchema = z.object({
  ok: z.boolean().default(false),
  checkedAt: z.string().optional(),
  latencyMs: z.number().int().nonnegative().optional(),
  detail: z.string().max(1_000).optional(),
});

export const providerSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(80),
  baseUrl: z.string().max(2_000).default(""),
  apiKey: z.string().max(4_000).default(""),
  connection: providerConnectionSchema.default({ ok: false }),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const bookConfigSchema = z.object({
  version: z.literal(1),
  presetId: z.string().min(1).max(100),
  presetName: z.string().trim().min(1).max(80),
  models: modelRolesSchema,
  roles: presetRolesSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const presetCreateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().max(500).optional(),
  roles: presetRolesSchema.optional(),
});

export const presetUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().max(500).default(""),
  roles: presetRolesSchema,
});

export const bookConfigUpdateSchema = z.object({
  presetId: z.string().min(1).max(100).optional(),
  presetName: z.string().trim().min(1).max(80).optional(),
  models: modelRolesSchema,
  roles: presetRolesSchema,
});

export const appConfigSchema = z.object({
  version: z.literal(1),
  baseUrl: z.string().max(2_000).default(""),
  apiKey: z.string().max(4_000).default(""),
  models: z.object({
    planner: z.string().max(500).default(""),
    executor: z.string().max(500).default(""),
    summarizer: z.string().max(500).default(""),
  }),
  providers: z.array(providerSchema).max(20).default([]),
  connection: z.object({
    ok: z.boolean().default(false),
    checkedAt: z.string().optional(),
    latencyMs: z.number().int().nonnegative().optional(),
    detail: z.string().max(1_000).optional(),
  }),
  presets: z.array(presetSchema).default([]),
  defaultPresetId: z.string().min(1).max(100).default(DEFAULT_PRESET_ID),
  updatedAt: z.string().min(1),
});

export type Chapter = z.infer<typeof chapterSchema>;
export type Character = z.infer<typeof characterSchema>;
export type Outline = z.infer<typeof outlineSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatAlternative = z.infer<typeof chatAlternativeSchema>;
export type Chat = z.infer<typeof chatSchema>;
export type AppConfig = z.infer<typeof appConfigSchema>;
export type ChapterStatus = z.infer<typeof chapterStatusSchema>;
export type GenerationParams = z.infer<typeof generationParamsSchema>;
export type ProviderConnection = z.infer<typeof providerConnectionSchema>;
export type Provider = z.infer<typeof providerSchema>;
export type RoleConfig = z.infer<typeof roleConfigSchema>;
export type PresetRoles = z.infer<typeof presetRolesSchema>;
export type Preset = z.infer<typeof presetSchema>;
export type ModelRoles = z.infer<typeof modelRolesSchema>;
export type BookConfig = z.infer<typeof bookConfigSchema>;
export type PresetCreateInput = z.infer<typeof presetCreateSchema>;
export type PresetUpdateInput = z.infer<typeof presetUpdateSchema>;
export type BookConfigUpdateInput = z.infer<typeof bookConfigUpdateSchema>;

export type PublicProvider = {
  id: string;
  name: string;
  baseUrl: string;
  hasApiKey: boolean;
  apiKeyHint: string | null;
  connection: Provider["connection"];
  createdAt: string;
  updatedAt: string;
};

export type PublicAppConfig = {
  providers: PublicProvider[];
  models: AppConfig["models"];
  updatedAt: string;
};

export type NovelListItem = {
  slug: string;
  title: string;
  premise: string;
  status: Outline["status"];
  chapterCount: number;
  currentChapter: number;
  wordCount: number;
  updatedAt: string;
  createdAt: string;
};

export type NovelDetail = {
  slug: string;
  outline: Outline;
  wordCount: number;
  chapterCount: number;
};

export type Draft = {
  id: string;
  outline: Outline;
};

export type ConnectionResult = {
  ok: boolean;
  models: string[];
  latencyMs: number;
  detail: string;
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    retryable?: boolean;
    details?: unknown;
  };
};
