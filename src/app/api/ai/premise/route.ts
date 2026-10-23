import { z } from "zod";
import { assertSameOrigin, errorResponse, jsonOk, parseBody } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { requireConfig } from "@/lib/storage/config";
import { getDraftBookConfig } from "@/lib/storage/book-config";
import { getDraft, publishDraft } from "@/lib/storage/novels";
import { readDraftChat } from "@/lib/storage/chats";
import {
  buildPremiseMessages,
  buildTitleMessages,
} from "@/lib/ai/prompts";
import { chatCompletion } from "@/lib/ai/client";
import { acquire, release } from "@/lib/ai/active";
import { resolveModelRoute } from "@/lib/ai/routing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const schema = z.object({
  draftId: z.string().min(1),
});

function cleanTitle(raw: string): string {
  const firstLine = raw.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "";
  return firstLine
    .replace(/^(title|book title)\s*[:\-]\s*/i, "")
    .replace(/^["'“”‘’#*\s]+|["'“”‘’#*.\s]+$/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 120)
    .trim();
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = await parseBody(request, schema);
    const global = await requireConfig();

    const lockKey = `premise:${input.draftId}`;
    acquire(lockKey);

    try {
      const draft = await getDraft(input.draftId);
      const chat = await readDraftChat(input.draftId, "premise");
      const draftConfig = (await getDraftBookConfig(input.draftId)).config;
      const summarizerRole = draftConfig.roles.summarizer;
      const summarizerRoute = resolveModelRoute(global, draftConfig.models.summarizer);
      const userMessages = chat.messages.filter(
        (message) => message.role === "user" && message.content.trim(),
      );

      if (!userMessages.length) {
        throw new AppError(
          "BAD_REQUEST",
          "Brainstorm the idea with the Planner before marking the premise done.",
          { status: 400 },
        );
      }

      let premise: string;
      try {
        const result = await chatCompletion({
          baseUrl: summarizerRoute.provider.baseUrl,
          apiKey: summarizerRoute.provider.apiKey,
          model: summarizerRoute.model,
          messages: buildPremiseMessages(chat.messages, summarizerRole.systemPrompt),
          params: summarizerRole.params,
          maxTokens: 700,
          timeoutMs: 120_000,
          retries: 2,
        });
        premise = result.content.trim();
      } catch (error) {
        const appError =
          error instanceof AppError
            ? error
            : new AppError(
                "AI_UNAVAILABLE",
                "The Summarizer could not write the premise. Your brainstorm is saved; retry when the model is available.",
                { status: 502, retryable: true },
              );
        throw new AppError(appError.code, appError.message, {
          status: appError.status,
          retryable: true,
          cause: appError,
        });
      }

      if (!premise) {
        throw new AppError(
          "AI_BAD_RESPONSE",
          "The Summarizer returned an empty premise. Your brainstorm is saved; try again.",
          { status: 502, retryable: true },
        );
      }

      let title = "Untitled Novel";
      let titleFallback = false;
      try {
        const titleRole = draftConfig.roles.planner;
        const titleRoute = resolveModelRoute(global, draftConfig.models.planner);
        const result = await chatCompletion({
          baseUrl: titleRoute.provider.baseUrl,
          apiKey: titleRoute.provider.apiKey,
          model: titleRoute.model,
          messages: buildTitleMessages(
            chat.messages,
            premise,
            titleRole.systemPrompt,
          ),
          params: titleRole.params,
          maxTokens: 40,
          timeoutMs: 60_000,
          retries: 1,
        });
        const cleaned = cleanTitle(result.content);
        if (cleaned) title = cleaned;
        else titleFallback = true;
      } catch {
        titleFallback = true;
      }

      const published = await publishDraft(input.draftId, { title, premise });
      return jsonOk({
        slug: published.slug,
        outline: published.outline,
        title,
        premise,
        titleFallback,
        draftId: draft.id,
      });
    } finally {
      release(lockKey);
    }
  } catch (error) {
    return errorResponse(error);
  }
}
