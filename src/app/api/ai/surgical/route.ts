import { z } from "zod";
import { assertSameOrigin, errorResponse, jsonOk, parseBody } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { chatCompletion } from "@/lib/ai/client";
import { renderPrompt, vaultContext } from "@/lib/ai/prompts";
import { parseSurgicalTakes } from "@/lib/ai/surgical";
import { resolveModelRoute } from "@/lib/ai/routing";
import { requireConfig } from "@/lib/storage/config";
import { getBookConfig } from "@/lib/storage/book-config";
import { getNovel } from "@/lib/storage/novels";
import { getPromptMap } from "@/lib/storage/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

const schema = z.object({
  slug: z.string().min(1).max(80),
  chapter: z.number().int().positive().max(500),
  selection: z.string().trim().min(1).max(20_000),
  before: z.string().max(8_000).optional().default(""),
  after: z.string().max(8_000).optional().default(""),
  instruction: z.string().trim().min(1).max(2_000),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = await parseBody(request, schema);
    const global = await requireConfig();
    const outline = await getNovel(input.slug);
    const book = await getBookConfig(input.slug);
    const role = book.config.roles.executor;
    const prompts = await getPromptMap();
    const modelId =
      book.config.models.surgical ||
      global.models.surgical ||
      book.config.models.executor ||
      global.models.executor;
    const route = resolveModelRoute(global, modelId);

    const result = await chatCompletion({
      baseUrl: route.provider.baseUrl,
      apiKey: route.provider.apiKey,
      model: route.model,
      messages: [
        { role: "system", content: prompts.surgical_system },
        {
          role: "user",
          content: renderPrompt(prompts.surgical_task, {
            vault: vaultContext(outline, input.chapter),
            before: input.before.trim() || "(none)",
            selection: input.selection,
            after: input.after.trim() || "(none)",
            instruction: input.instruction,
          }),
        },
      ],
      params: role.params,
      maxTokens: 4_000,
      timeoutMs: 120_000,
      retries: 1,
    });

    const takes = parseSurgicalTakes(result.content);
    if (takes.length < 2) {
      throw new AppError(
        "AI_BAD_RESPONSE",
        "The surgical editor did not return two valid variations. Try again.",
        { status: 502, retryable: true },
      );
    }

    return jsonOk({ takes });
  } catch (error) {
    return errorResponse(error);
  }
}