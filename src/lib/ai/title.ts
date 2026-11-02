import { chatCompletion } from "@/lib/ai/client";
import {
  buildTitleGenerationMessages,
  type PromptInjections,
} from "@/lib/ai/prompts";
import type { GenerationParams } from "@/lib/schemas";

export const TITLE_MAX_TOKENS = 1_024;

export async function generateTitleText({
  baseUrl,
  apiKey,
  model,
  context,
  systemPrompt,
  params,
  injections,
  taskPrompt,
  timeoutMs = 60_000,
  retries = 1,
}: {
  baseUrl: string;
  apiKey: string;
  model: string;
  context: string;
  systemPrompt: string;
  params?: GenerationParams;
  injections?: PromptInjections;
  taskPrompt?: string;
  timeoutMs?: number;
  retries?: number;
}): Promise<string> {
  const result = await chatCompletion({
    baseUrl,
    apiKey,
    model,
    messages: buildTitleGenerationMessages(context, systemPrompt, injections, taskPrompt),
    params,
    maxTokens: TITLE_MAX_TOKENS,
    timeoutMs,
    retries,
  });
  return result.content;
}
