import { z } from "zod";
import { assertSameOrigin, errorResponse, jsonOk, parseBody } from "@/lib/api";
import { chatCompletion } from "@/lib/ai/client";
import { buildImagePromptMessages } from "@/lib/ai/prompts";
import { resolveModelRoute } from "@/lib/ai/routing";
import { AppError, NotFoundError } from "@/lib/errors";
import { requireConfig } from "@/lib/storage/config";
import { getBookConfig } from "@/lib/storage/book-config";
import { getNovel } from "@/lib/storage/novels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const schema = z.object({
  slug: z.string().min(1).max(80),
  kind: z.enum(["chapter", "cover"]),
  pageNumber: z.number().int().positive().max(500).optional(),
});

function cleanPrompt(raw: string): string {
  return raw
    .replace(/```[a-z]*\n?/gi, "")
    .replace(/```/g, "")
    .replace(/^(prompt|image prompt)\s*[:\-]\s*/i, "")
    .replace(/^["'“”`\s]+|["'“”`\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4_000);
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = await parseBody(request, schema);
    const global = await requireConfig();
    const outline = await getNovel(input.slug);
    const book = await getBookConfig(input.slug);
    const role = book.config.roles.imagePrompter;
    const model = book.config.models.imagePrompter || global.models.imagePrompter;
    if (!model.trim()) {
      throw new AppError(
        "AI_NOT_CONFIGURED",
        "Choose an Image Prompter model in Book settings or global Settings first.",
        { status: 428 },
      );
    }

    let context: Parameters<typeof buildImagePromptMessages>[0];
    if (input.kind === "cover") {
      context = {
        kind: "cover",
        title: outline.title,
        premise: outline.premise,
      };
    } else {
      if (!input.pageNumber) {
        throw new AppError("BAD_REQUEST", "Choose an illustration page first.", {
          status: 400,
        });
      }
      const page = outline.chapters.find((item) => item.number === input.pageNumber);
      if (!page) throw new NotFoundError("That page does not exist.");
      if (page.kind !== "illustration") {
        throw new AppError("BAD_REQUEST", "This page is not an illustration page.", {
          status: 400,
        });
      }
      const previous = outline.chapters
        .filter(
          (item) =>
            item.kind === "chapter" &&
            item.number < input.pageNumber! &&
            item.summary.trim(),
        )
        .sort((a, b) => b.number - a.number)[0];
      if (!previous) {
        throw new AppError(
          "BAD_REQUEST",
          "There is no summarized chapter before this illustration page yet.",
          { status: 400 },
        );
      }
      context = {
        kind: "chapter",
        title: outline.title,
        premise: outline.premise,
        summary: previous.summary,
        previousTitle: previous.title,
      };
    }

    const route = resolveModelRoute(global, model);
    const result = await chatCompletion({
      baseUrl: route.provider.baseUrl,
      apiKey: route.provider.apiKey,
      model: route.model,
      messages: buildImagePromptMessages(context, role.systemPrompt),
      params: role.params,
      maxTokens: 500,
      timeoutMs: 90_000,
      retries: 1,
    });
    const prompt = cleanPrompt(result.content);
    if (!prompt) {
      throw new AppError("AI_BAD_RESPONSE", "The Image Prompter returned an empty prompt.", {
        status: 502,
        retryable: true,
      });
    }

    return jsonOk({ prompt, model: route.model, provider: route.provider.name });
  } catch (error) {
    return errorResponse(error);
  }
}
