"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { ChatMessage } from "@/lib/schemas";
import {
  abortStream,
  resetStream,
  useStreamStore,
} from "@/lib/streams/store";
import { runPlannerStream } from "@/lib/streams/runners";
import { withDebugPreview } from "@/lib/ai/debug-preview";
import { createId } from "@/lib/utils";

export function usePlannerStream({
  streamKey,
  endpoint,
  initialMessages,
  baseBody,
  mutateEndpoint,
}: {
  streamKey: string;
  endpoint: string;
  initialMessages: ChatMessage[];
  baseBody: Record<string, unknown>;
  mutateEndpoint?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const entry = useStreamStore((state) => state.streams[streamKey]);
  const streaming = entry?.status === "streaming";
  const streamingContent = streaming ? entry?.text ?? "" : "";
  const streamingReasoning = streaming ? entry?.reasoning ?? "" : "";
  const error = entry?.error ?? null;

  useEffect(() => {
    if (!mutateEndpoint) return;
    if (!useStreamStore.getState().streams[streamKey]) return;
    let cancelled = false;
    void fetch(mutateEndpoint, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { chat?: { messages: ChatMessage[] } } | null) => {
        if (!cancelled && payload?.chat?.messages) {
          const serverMessages = payload.chat.messages;
          const pending = useStreamStore.getState().streams[streamKey]?.userMessage;
          setMessages(
            pending && !serverMessages.some((message) => message.id === pending.id)
              ? [...serverMessages, pending]
              : serverMessages,
          );
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [mutateEndpoint, streamKey]);

  useEffect(() => {
    const pending = entry?.userMessage;
    if (!pending) return;
    const frame = requestAnimationFrame(() => {
      setMessages((current) =>
        current.some((message) => message.id === pending.id)
          ? current
          : [...current, pending],
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [entry?.userMessage]);

  useEffect(() => {
    const completed = entry?.assistantMessage;
    if (!completed) return;
    const mode = entry?.mode;
    const frame = requestAnimationFrame(() => {
      setMessages((current) => {
        const index = current.findIndex((message) => message.id === completed.id);
        if (mode === "regenerate" && index >= 0) {
          const next = [...current];
          next[index] = completed;
          return next;
        }
        if (index >= 0) return current;
        return [...current, completed];
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [entry?.assistantMessage, entry?.mode]);

  const send = useCallback(
    (text: string) => {
      if (streaming) return;
      const clientMessageId = createId();
      const optimistic: ChatMessage = {
        id: clientMessageId,
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      };
      setMessages((current) => [...current, optimistic]);
      const body = { ...baseBody, message: text, clientMessageId };
      void withDebugPreview(endpoint, body, (finalBody) => {
        runPlannerStream({
          key: streamKey,
          endpoint,
          body: finalBody,
          mode: "send",
        });
      }).then((fired) => {
        if (!fired) {
          setMessages((current) =>
            current.filter((message) => message.id !== clientMessageId),
          );
        }
      });
    },
    [baseBody, endpoint, streamKey, streaming],
  );

  const retry = useCallback(() => {
    if (streaming || !entry?.lastBody) return;
    void withDebugPreview(endpoint, entry.lastBody, (finalBody) => {
      runPlannerStream({
        key: streamKey,
        endpoint,
        body: finalBody,
        mode: entry.mode ?? "send",
        targetMessageId: entry.targetMessageId,
      });
    });
  }, [endpoint, entry, streamKey, streaming]);

  const stop = useCallback(() => {
    abortStream(streamKey);
  }, [streamKey]);

  const regenerate = useCallback(
    (message: ChatMessage) => {
      if (streaming || message.role !== "assistant") return;
      const body = { ...baseBody, regenerateMessageId: message.id };
      void withDebugPreview(endpoint, body, (finalBody) => {
        runPlannerStream({
          key: streamKey,
          endpoint,
          body: finalBody,
          mode: "regenerate",
          targetMessageId: message.id,
        });
      });
    },
    [baseBody, endpoint, streamKey, streaming],
  );

  const mutate = useCallback(
    async (message: ChatMessage, body: Record<string, unknown>, method: "PATCH" | "DELETE") => {
      if (!mutateEndpoint || streaming) return false;
      const response = await fetch(`${mutateEndpoint}/messages/${message.id}`, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(method === "PATCH" ? { body: JSON.stringify(body) } : {}),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        chat?: { messages: ChatMessage[] };
        error?: { message?: string };
      };
      if (!response.ok || !payload.chat) {
        toast.error(payload.error?.message || "The message could not be updated.");
        return false;
      }
      resetStream(streamKey);
      setMessages(payload.chat.messages);
      return true;
    },
    [mutateEndpoint, streamKey, streaming],
  );

  const switchVersion = useCallback(
    async (message: ChatMessage, alternativeId: string) => {
      await mutate(message, { action: "switch", alternativeId }, "PATCH");
    },
    [mutate],
  );

  const deleteMessage = useCallback(
    async (message: ChatMessage) => {
      await mutate(message, {}, "DELETE");
    },
    [mutate],
  );

  const editMessage = useCallback(
    async (message: ChatMessage, content: string) => {
      const ok = await mutate(message, { action: "edit", content }, "PATCH");
      if (!ok) return;
      const body = { ...baseBody, branchUserMessageId: message.id };
      await withDebugPreview(endpoint, body, (finalBody) => {
        runPlannerStream({
          key: streamKey,
          endpoint,
          body: finalBody,
          mode: "branch",
          targetMessageId: message.id,
          userMessage: { ...message, content },
        });
      });
    },
    [baseBody, endpoint, mutate, streamKey],
  );

  const editAssistant = useCallback(
    async (message: ChatMessage, content: string) => {
      await mutate(message, { action: "editAssistant", content }, "PATCH");
    },
    [mutate],
  );

  return {
    messages,
    streaming,
    streamingContent,
    streamingReasoning,
    error,
    send,
    retry,
    stop,
    regenerate: mutateEndpoint ? regenerate : undefined,
    switchVersion: mutateEndpoint ? switchVersion : undefined,
    deleteMessage: mutateEndpoint ? deleteMessage : undefined,
    editMessage: mutateEndpoint ? editMessage : undefined,
    editAssistant: mutateEndpoint ? editAssistant : undefined,
  };
}
