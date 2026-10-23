"use client";

import { StreamClientError, streamChat } from "@/lib/ai/client-stream";
import type { ChatMessage, Chapter } from "@/lib/schemas";
import type { ChatFailure } from "@/lib/chat-types";
import {
  patchStream,
  streamControllers,
  type StreamMode,
} from "@/lib/streams/store";
import { createId } from "@/lib/utils";

type PlannerMeta = {
  userMessageId?: string;
  assistantMessageId?: string;
  model?: string;
};

export function runPlannerStream({
  key,
  endpoint,
  body,
  mode,
  targetMessageId,
  userMessage,
}: {
  key: string;
  endpoint: string;
  body: Record<string, unknown>;
  mode: StreamMode;
  targetMessageId?: string;
  userMessage?: ChatMessage;
}): void {
  if (streamControllers.has(key)) return;
  const controller = new AbortController();
  streamControllers.set(key, controller);

  patchStream(key, "planner", {
    status: "streaming",
    text: "",
    reasoning: "",
    error: null,
    startedAt: Date.now(),
    mode,
    targetMessageId,
    assistantMessage: undefined,
    userMessage:
      userMessage ??
      (mode === "send" && typeof body.message === "string"
        ? {
            id: String(body.clientMessageId ?? createId()),
            role: "user" as const,
            content: body.message,
            createdAt: new Date().toISOString(),
          }
        : undefined),
    chapter: undefined,
    lastBody: body,
  });

  let text = "";
  let reasoning = "";
  let meta: PlannerMeta = {};

  void (async () => {
    try {
      await streamChat(
        endpoint,
        body,
        {
          onMeta: (data) => {
            meta = data as PlannerMeta;
          },
          onDelta: (_chunk, full) => {
            text = full;
            patchStream(key, "planner", { text: full });
          },
          onReasoning: (_chunk, full) => {
            reasoning = full;
            patchStream(key, "planner", { reasoning: full });
          },
          onDone: (data) => {
            const done = data as { assistantMessage?: ChatMessage };
            if (done.assistantMessage) {
              patchStream(key, "planner", {
                status: "done",
                text: "",
                reasoning: "",
                assistantMessage: done.assistantMessage,
              });
            } else {
              patchStream(key, "planner", {
                status: "done",
                text,
                reasoning,
              });
            }
          },
        },
        controller.signal,
      );
    } catch (caught) {
      const error =
        caught instanceof StreamClientError
          ? caught
          : new StreamClientError(
              caught instanceof Error && caught.message
                ? caught.message
                : "The Planner stopped responding. Try again.",
              {
                code:
                  caught instanceof Error && caught.name === "AbortError"
                    ? "ABORTED"
                    : "STREAM_FAILED",
                retryable: !(caught instanceof Error && caught.name === "AbortError"),
              },
            );

      const partial = error.partial || text;
      const assistantMessage: ChatMessage | undefined =
        mode !== "regenerate" && meta.assistantMessageId && (partial || reasoning)
          ? {
              id: meta.assistantMessageId,
              role: "assistant",
              content: partial,
              ...(reasoning ? { reasoning } : {}),
              createdAt: new Date().toISOString(),
              model: meta.model,
              failed: true,
            }
          : undefined;

      if (error.code === "ABORTED") {
        patchStream(key, "planner", {
          status: "done",
          text: "",
          reasoning: "",
          error: null,
          assistantMessage,
        });
      } else {
        const failure: ChatFailure = {
          message: error.message,
          retryable: error.retryable,
          saved: error.saved || Boolean(partial),
        };
        patchStream(key, "planner", {
          status: "error",
          text: "",
          reasoning: "",
          error: failure,
          assistantMessage,
        });
      }
    } finally {
      streamControllers.delete(key);
    }
  })();
}

export type ExecuteDone = {
  chapter?: Chapter;
  reasoning?: string;
  wordCount?: number;
};

export function runExecutorStream({
  key,
  body,
}: {
  key: string;
  body: Record<string, unknown>;
}): void {
  if (streamControllers.has(key)) return;
  const controller = new AbortController();
  streamControllers.set(key, controller);

  patchStream(key, "executor", {
    status: "streaming",
    text: "",
    reasoning: "",
    error: null,
    startedAt: Date.now(),
    assistantMessage: undefined,
    chapter: undefined,
    lastBody: body,
  });

  let text = "";
  let reasoning = "";

  void (async () => {
    try {
      const done = (await streamChat(
        "/api/ai/execute",
        body,
        {
          onDelta: (_chunk, full) => {
            text = full;
            patchStream(key, "executor", { text: full });
          },
          onReasoning: (_chunk, full) => {
            reasoning = full;
            patchStream(key, "executor", { reasoning: full });
          },
        },
        controller.signal,
      )) as ExecuteDone | null;

      patchStream(key, "executor", {
        status: "done",
        text,
        reasoning: reasoning || done?.reasoning || "",
        chapter: done?.chapter,
        error: null,
      });
    } catch (caught) {
      const error =
        caught instanceof StreamClientError
          ? caught
          : new StreamClientError(
              caught instanceof Error && caught.message
                ? caught.message
                : "The Executor stopped responding.",
              {
                code:
                  caught instanceof Error && caught.name === "AbortError"
                    ? "ABORTED"
                    : "STREAM_FAILED",
                retryable: !(caught instanceof Error && caught.name === "AbortError"),
              },
            );

      const partial = error.partial || text;
      if (error.code === "ABORTED") {
        patchStream(key, "executor", {
          status: "done",
          text: partial,
          reasoning,
          error: null,
        });
      } else {
        const failure: ChatFailure = {
          message: error.message,
          retryable: error.retryable,
          saved: error.saved || Boolean(partial),
        };
        patchStream(key, "executor", {
          status: "error",
          text: partial,
          reasoning,
          error: failure,
        });
      }
    } finally {
      streamControllers.delete(key);
    }
  })();
}
