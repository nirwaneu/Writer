import { randomUUID } from "node:crypto";
import { z } from "zod";
import { assertSameOrigin, errorResponse, parseBody } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { requireConfig } from "@/lib/storage/config";
import { getBookConfig, getDraftBookConfig } from "@/lib/storage/book-config";
import { getDraft, getNovel, ensureChapter } from "@/lib/storage/novels";
import {
  appendDraftChatMessage,
  appendNovelChatMessage,
  readDraftChat,
  readNovelChat,
  saveDraftChat,
  saveNovelChat,
} from "@/lib/storage/chats";
import { buildPlannerMessages } from "@/lib/ai/prompts";
import { openChatStream } from "@/lib/ai/client";
import { parseOpenAIStream, sseResponse } from "@/lib/ai/sse";
import { acquire, release } from "@/lib/ai/active";
import { addAssistantAlternative } from "@/lib/chat/messages";
import { resolveModelRoute } from "@/lib/ai/routing";
import type { Chat, ChatMessage, Outline } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const schema = z.discriminatedUnion("scope", [
  z.object({
    scope: z.literal("premise"),
    draftId: z.string().min(1),
    message: z.string().trim().min(1).max(20_000).optional(),
    retryMessageId: z.string().optional(),
    clientMessageId: z.string().min(1).max(100).optional(),
    regenerateMessageId: z.string().optional(),
    branchUserMessageId: z.string().optional(),
  }),
  z.object({
    scope: z.literal("chapter"),
    slug: z.string().min(1),
    chapter: z.number().int().positive(),
    message: z.string().trim().min(1).max(20_000).optional(),
    retryMessageId: z.string().optional(),
    clientMessageId: z.string().min(1).max(100).optional(),
    regenerateMessageId: z.string().optional(),
    branchUserMessageId: z.string().optional(),
  }),
]);

type Target =
  | { kind: "draft"; id: string; chapter: 1; outline: Outline; lockKey: string }
  | { kind: "novel"; slug: string; chapter: number; outline: Outline; lockKey: string };

type Mode = "send" | "regenerate" | "branch";

function findPrecedingUser(messages: ChatMessage[], index: number): ChatMessage {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (messages[cursor].role === "user") return messages[cursor];
  }
  throw new AppError("BAD_REQUEST", "That response has no user prompt to regenerate from.", {
    status: 400,
  });
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = await parseBody(request, schema);
    if (input.regenerateMessageId && input.branchUserMessageId) {
      throw new AppError("BAD_REQUEST", "Choose one response action at a time.", { status: 400 });
    }
    const global = await requireConfig();

    let target: Target;
    if (input.scope === "premise") {
      target = {
        kind: "draft",
        id: input.draftId,
        chapter: 1,
        outline: await getDraft(input.draftId),
        lockKey: `planner:draft:${input.draftId}:premise`,
      };
    } else {
      await ensureChapter(input.slug, input.chapter);
      target = {
        kind: "novel",
        slug: input.slug,
        chapter: input.chapter,
        outline: await getNovel(input.slug),
        lockKey: `planner:novel:${input.slug}:${input.chapter}`,
      };
    }

    acquire(target.lockKey);
    try {
      const readChat = () =>
        target.kind === "draft"
          ? readDraftChat(target.id, "premise")
          : readNovelChat(target.slug, target.chapter);
      const saveChat = (chat: Chat) =>
        target.kind === "draft"
          ? saveDraftChat(target.id, chat)
          : saveNovelChat(target.slug, chat);
      const appendAssistant = (message: ChatMessage) =>
        target.kind === "draft"
          ? appendDraftChatMessage(target.id, "premise", message)
          : appendNovelChatMessage(target.slug, target.chapter, message);

      const history = await readChat();
      const mode: Mode = input.regenerateMessageId
        ? "regenerate"
        : input.branchUserMessageId
          ? "branch"
          : "send";

      let messageText: string;
      let userMessageId: string;
      let contextHistory: ChatMessage[];
      let assistantMessageId: string;
      let alternativeId: string | undefined;

      if (mode === "regenerate") {
        const index = history.messages.findIndex(
          (message) => message.id === input.regenerateMessageId,
        );
        const targetMessage = history.messages[index];
        if (index < 0 || !targetMessage || targetMessage.role !== "assistant") {
          throw new AppError("BAD_REQUEST", "That response no longer exists.", { status: 400 });
        }
        const user = findPrecedingUser(history.messages, index);
        const userIndex = history.messages.findIndex((message) => message.id === user.id);
        messageText = user.content;
        userMessageId = user.id;
        contextHistory = history.messages.slice(0, userIndex);
        assistantMessageId = targetMessage.id;
        alternativeId = randomUUID();
      } else if (mode === "branch") {
        const index = history.messages.findIndex(
          (message) => message.id === input.branchUserMessageId,
        );
        const user = history.messages[index];
        if (index < 0 || !user || user.role !== "user") {
          throw new AppError("BAD_REQUEST", "That user message no longer exists.", {
            status: 400,
          });
        }
        messageText = user.content;
        userMessageId = user.id;
        contextHistory = history.messages.slice(0, index);
        assistantMessageId = randomUUID();
      } else {
        if (input.retryMessageId) {
          const existing = history.messages.find(
            (message) => message.id === input.retryMessageId && message.role === "user",
          );
          if (!existing) {
            throw new AppError("BAD_REQUEST", "That message is no longer in the chat.", {
              status: 400,
            });
          }
          messageText = existing.content;
          userMessageId = existing.id;
        } else {
          if (!input.message?.trim()) {
            throw new AppError("BAD_REQUEST", "Write a message before sending.", { status: 400 });
          }
          messageText = input.message.trim();
          userMessageId = input.clientMessageId ?? randomUUID();
          const alreadyStored = history.messages.some((message) => message.id === userMessageId);
          if (!alreadyStored) {
            const userMessage: ChatMessage = {
              id: userMessageId,
              role: "user",
              content: messageText,
              createdAt: new Date().toISOString(),
            };
            if (target.kind === "draft") {
              await appendDraftChatMessage(target.id, "premise", userMessage);
            } else {
              await appendNovelChatMessage(target.slug, target.chapter, userMessage);
            }
          }
        }
        contextHistory = history.messages.filter((message) => message.id !== userMessageId);
        assistantMessageId = randomUUID();
      }

      const bookConfig =
        target.kind === "draft"
          ? (await getDraftBookConfig(target.id)).config
          : (await getBookConfig(target.slug)).config;
      const plannerRole = bookConfig.roles.planner;
      const messages = buildPlannerMessages(
        target.outline,
        target.chapter,
        contextHistory,
        messageText,
        plannerRole.systemPrompt,
      );
      const plannerRoute = resolveModelRoute(global, bookConfig.models.planner);
      const model = plannerRoute.model;

      return sseResponse(async (send, signal) => {
        let content = "";
        let reasoning = "";
        let finished = false;
        let failure: unknown = null;
        let usage: unknown;

        send("meta", {
          userMessageId,
          assistantMessageId,
          alternativeId,
          mode,
          model,
        });

        try {
          const response = await openChatStream({
            baseUrl: plannerRoute.provider.baseUrl,
            apiKey: plannerRoute.provider.apiKey,
            model,
            messages,
            signal,
            params: plannerRole.params,
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
          if (mode === "regenerate") {
            if (!finished || !content.trim()) {
              if (signal.aborted) return;
              const appError =
                failure instanceof AppError
                  ? failure
                  : new AppError(
                      "AI_BAD_RESPONSE",
                      "The Planner returned no text. The previous version is unchanged.",
                      { status: 502, retryable: true },
                    );
              send("error", {
                code: appError.code,
                message: appError.message,
                retryable: appError.retryable,
                saved: false,
              });
              return;
            }

            try {
              const current = await readChat();
              const updated = addAssistantAlternative(current, assistantMessageId, {
                id: alternativeId!,
                content,
                ...(reasoning ? { reasoning } : {}),
                createdAt: new Date().toISOString(),
                model,
              });
              const saved = await saveChat(updated);
              const updatedMessage = saved.messages.find(
                (message) => message.id === assistantMessageId,
              );
              if (signal.aborted) return;
              send("done", { assistantMessage: updatedMessage, usage });
            } catch (error) {
              if (signal.aborted) return;
              const appError =
                error instanceof AppError
                  ? error
                  : new AppError("STORAGE_IO", "The new version could not be saved.", {
                      status: 500,
                    });
              send("error", {
                code: appError.code,
                message: appError.message,
                retryable: false,
                saved: false,
              });
            }
            return;
          }

          const assistantMessage: ChatMessage = {
            id: assistantMessageId,
            role: "assistant",
            content,
            ...(reasoning ? { reasoning } : {}),
            createdAt: new Date().toISOString(),
            model,
            ...(finished ? {} : { failed: true }),
          };

          if (content.trim()) {
            await appendAssistant(assistantMessage);
          }

          if (signal.aborted) return;

          if (failure) {
            const appError =
              failure instanceof AppError
                ? failure
                : new AppError(
                    "AI_UNAVAILABLE",
                    "The Planner stopped responding. Try again.",
                    { status: 502, retryable: true },
                  );
            send("error", {
              code: appError.code,
              message: appError.message,
              retryable: appError.retryable,
              saved: Boolean(content.trim()),
            });
            return;
          }

          if (!content.trim()) {
            send("error", {
              code: "AI_BAD_RESPONSE",
              message: "The Planner returned no text. Try again.",
              retryable: true,
              saved: false,
            });
            return;
          }

          send("done", {
            assistantMessage: { ...assistantMessage, failed: false },
            usage,
          });
        } finally {
          release(target.lockKey);
        }
      }, request.signal);
    } catch (error) {
      release(target.lockKey);
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}
