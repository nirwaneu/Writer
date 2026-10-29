import { z } from "zod";
import { assertSameOrigin, errorResponse, jsonOk, parseBody } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { requireConfig } from "@/lib/storage/config";
import { getBookConfig } from "@/lib/storage/book-config";
import {
  ensureChapter,
  getChapterContent,
  getNovel,
  markSummaryFailed,
  saveChapterSummary,
} from "@/lib/storage/novels";
import { readNovelChat } from "@/lib/storage/chats";
import type { Chat } from "@/lib/schemas";
import {
  buildChapterSummaryMessages,
  buildChunkSummaryMessages,
  buildCombineSummaryMessages,
  roleInjections,
  splitForSummary,
} from "@/lib/ai/prompts";
import { generateTitleText } from "@/lib/ai/title";
import { chatCompletion } from "@/lib/ai/client";
import { acquire, release } from "@/lib/ai/active";
import { resolveModelRoute } from "@/lib/ai/routing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const schema = z.object({
  slug: z.string().min(1),
  chapter: z.number().int().positive(),
});

function latestPlannerResponse(chat: Chat): string {
  for (let index = chat.messages.length - 1; index >= 0; index -= 1) {
    const message = chat.messages[index];
    if (message.role === "assistant" && !message.failed && message.content.trim()) {
      return message.content.trim();
    }
  }
  return "";
}

function cleanSummary(raw: string): string {
  return raw
    .replace(/^\s*(summary|chapter summary)\s*[:\-]\s*/i, "")
    .replace(/^#+\s*/gm, "")
    .trim();
}

function cleanChapterTitle(raw: string): string {
  const firstLine = raw.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "";
  return firstLine
    .replace(/^(chapter title|title)\s*[:\-]\s*/i, "")
    .replace(/^["'“”‘’#*\s]+|["'“”‘’#*.\s]+$/g, "")
    .replace(/^chapter\s+\d+\s*[:\-—]\s*/i, "")
    .replace(/\s+/g, " ")
    .slice(0, 200)
    .trim();
}

export async function POST(request: Request) {
  const input = await (async () => {
    assertSameOrigin(request);
    return parseBody(request, schema);
  })().catch((error) => ({ error }));

  if ("error" in input) return errorResponse(input.error);

  const lockKey = `summary:${input.slug}:${input.chapter}`;
  acquire(lockKey);

  try {
    const global = await requireConfig();
    await ensureChapter(input.slug, input.chapter);
    const outline = await getNovel(input.slug);
    const chat = await readNovelChat(input.slug, input.chapter);
    const plannerText = latestPlannerResponse(chat);
    const chapterText = await getChapterContent(input.slug, input.chapter);
    const text = plannerText || chapterText;

    if (!text.trim()) {
      throw new AppError(
        "BAD_REQUEST",
        "There is no Planner response or chapter text to summarize yet.",
        { status: 400 },
      );
    }

    const bookConfig = (await getBookConfig(input.slug)).config;
    const summarizerRole = bookConfig.roles.summarizer;
    const summarizerRoute = resolveModelRoute(global, bookConfig.models.summarizer);
    const model = summarizerRoute.model;
    const options = {
      baseUrl: summarizerRoute.provider.baseUrl,
      apiKey: summarizerRoute.provider.apiKey,
      model,
      params: summarizerRole.params,
      maxTokens: 2_000,
      timeoutMs: 180_000,
      retries: 2,
    };

    let summary: string;
    try {
      if (text.length > 40_000) {
        const chunks = splitForSummary(text);
        const partials: string[] = [];
        for (let index = 0; index < chunks.length; index += 1) {
          const result = await chatCompletion({
            ...options,
            messages: buildChunkSummaryMessages(
              outline,
              input.chapter,
              chunks[index],
              index + 1,
              chunks.length,
              summarizerRole.systemPrompt,
              roleInjections(summarizerRole),
            ),
            maxTokens: 1_200,
          });
          partials.push(result.content.trim());
        }
        const combined = await chatCompletion({
          ...options,
          messages: buildCombineSummaryMessages(
            outline,
            input.chapter,
            partials,
            summarizerRole.systemPrompt,
            roleInjections(summarizerRole),
          ),
        });
        summary = combined.content;
      } else {
        const result = await chatCompletion({
          ...options,
          messages: buildChapterSummaryMessages(
            outline,
            input.chapter,
            text,
            summarizerRole.systemPrompt,
            roleInjections(summarizerRole),
          ),
        });
        summary = result.content;
      }
    } catch (error) {
      await markSummaryFailed(input.slug, input.chapter).catch(() => undefined);
      throw error;
    }

    const cleaned = cleanSummary(summary);
    if (!cleaned) {
      await markSummaryFailed(input.slug, input.chapter).catch(() => undefined);
      throw new AppError("AI_BAD_RESPONSE", "The Summarizer returned an empty summary.", {
        status: 502,
        retryable: true,
      });
    }

    let chapterTitle: string | undefined;
    try {
      const titleRole = bookConfig.roles.titleGenerator;
      const plannerRoute = resolveModelRoute(global, bookConfig.models.planner);
      const titleContent = await generateTitleText({
        baseUrl: plannerRoute.provider.baseUrl,
        apiKey: plannerRoute.provider.apiKey,
        model: plannerRoute.model,
        context: text,
        systemPrompt: titleRole.systemPrompt,
        params: titleRole.params,
        injections: roleInjections(titleRole),
      });
      chapterTitle = cleanChapterTitle(titleContent) || undefined;
    } catch {
      chapterTitle = undefined;
    }

    const next = await saveChapterSummary(
      input.slug,
      input.chapter,
      cleaned,
      chapterTitle,
    );
    const chapter = next.chapters.find((item) => item.number === input.chapter) ?? null;

    return jsonOk({
      summary: cleaned,
      title: chapterTitle,
      chapter,
      outline: next,
    });
  } catch (error) {
    return errorResponse(error);
  } finally {
    release(lockKey);
  }
}
