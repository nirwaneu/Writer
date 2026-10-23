import { z } from "zod";
import { assertSameOrigin, errorResponse, parseBody } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { requireConfig } from "@/lib/storage/config";
import { getBookConfig } from "@/lib/storage/book-config";
import {
  ensureChapter,
  getChapterContent,
  getNovel,
  saveChapterContent,
} from "@/lib/storage/novels";
import { readNovelChat } from "@/lib/storage/chats";
import { buildExecutorMessages } from "@/lib/ai/prompts";
import { openChatStream } from "@/lib/ai/client";
import { parseOpenAIStream, sseResponse } from "@/lib/ai/sse";
import { acquire, release } from "@/lib/ai/active";
import { resolveModelRoute } from "@/lib/ai/routing";
import type { Chapter } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const schema = z.object({
  slug: z.string().min(1),
  chapter: z.number().int().positive(),
  confirmOverwrite: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = await parseBody(request, schema);
    const global = await requireConfig();

    await ensureChapter(input.slug, input.chapter);
    const outline = await getNovel(input.slug);
    const existingContent = await getChapterContent(input.slug, input.chapter);
    const chat = await readNovelChat(input.slug, input.chapter);

    const bookConfig = (await getBookConfig(input.slug)).config;
    const executorRole = bookConfig.roles.executor;

    let messages;
    try {
      messages = buildExecutorMessages(
        outline,
        input.chapter,
        chat.messages,
        executorRole.systemPrompt,
      );
    } catch {
      throw new AppError(
        "BAD_REQUEST",
        "Brainstorm this chapter with the Planner first. The Executor needs a plan.",
        { status: 400 },
      );
    }

    if (existingContent.trim() && !input.confirmOverwrite) {
      throw new AppError(
        "CONFLICT",
        "This chapter already has text. Confirm replacement before executing.",
        { status: 409, retryable: false, details: { hasContent: true } },
      );
    }

    const lockKey = `execute:${input.slug}:${input.chapter}`;
    acquire(lockKey);

    try {
      const executorRoute = resolveModelRoute(global, bookConfig.models.executor);
      const model = executorRoute.model;

      return sseResponse(async (send, signal) => {
        let content = "";
        let reasoning = "";
        let finished = false;
        let failure: unknown = null;
        let usage: unknown;
        let savedChapter: Chapter | null = null;
        let saveError: unknown = null;

        send("meta", {
          model,
          chapter: input.chapter,
          replacing: Boolean(existingContent.trim()),
        });

        try {
          const response = await openChatStream({
            baseUrl: executorRoute.provider.baseUrl,
            apiKey: executorRoute.provider.apiKey,
            model,
            messages,
            signal,
            params: executorRole.params,
          });

          for await (const piece of parseOpenAIStream(response.body!)) {
            if (piece.type === "delta") {
              content += piece.text;
              send("delta", { text: piece.text });
            } else if (piece.type === "reasoning") {
              reasoning += piece.text;
              send("reasoning", { text: piece.text });
            } else if (piece.type === "usage") {
              usage = piece.usage;
            }
          }
          finished = true;
        } catch (error) {
          failure = error;
        }

        try {
          if (content.trim()) {
            try {
              savedChapter = await saveChapterContent(
                input.slug,
                input.chapter,
                content,
              );
            } catch (error) {
              saveError = error;
            }
          }

          if (signal.aborted) return;

          if (saveError) {
            const appError =
              saveError instanceof AppError
                ? saveError
                : new AppError(
                    "STORAGE_IO",
                    "The chapter was generated but could not be saved. Copy the text before reloading.",
                    { status: 500 },
                  );
            send("error", {
              code: appError.code,
              message: appError.message,
              retryable: false,
              saved: false,
            });
            return;
          }

          if (failure) {
            const appError =
              failure instanceof AppError
                ? failure
                : new AppError(
                    "AI_UNAVAILABLE",
                    "The Executor stopped responding. The text received so far is saved.",
                    { status: 502, retryable: true },
                  );
            send("error", {
              code: appError.code,
              message: content.trim()
                ? `${appError.message} The partial chapter was saved.`
                : appError.message,
              retryable: appError.retryable,
              saved: Boolean(savedChapter),
              chapter: savedChapter,
            });
            return;
          }

          if (!finished || !content.trim()) {
            send("error", {
              code: "AI_BAD_RESPONSE",
              message: "The Executor returned no text. Your previous chapter text is unchanged.",
              retryable: true,
              saved: false,
            });
            return;
          }

          send("done", {
            chapter: savedChapter,
            usage,
            reasoning,
            wordCount: savedChapter?.wordCount ?? 0,
          });
        } finally {
          release(lockKey);
        }
      }, request.signal);
    } catch (error) {
      release(lockKey);
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}
