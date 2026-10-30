"use client";

import { abortStream, resetStream, useStreamStore } from "@/lib/streams/store";
import { runExecutorStream } from "@/lib/streams/runners";
import { withDebugPreview } from "@/lib/ai/debug-preview";

export function useExecutorStream({
  slug,
  chapter,
}: {
  slug: string;
  chapter: number;
}) {
  const key = `executor:${slug}:${chapter}`;
  const entry = useStreamStore((state) => state.streams[key]);

  return {
    key,
    entry,
    executing: entry?.status === "streaming",
    text: entry?.text ?? "",
    reasoning: entry?.reasoning ?? "",
    error: entry?.error ?? null,
    chapter: entry?.chapter,
    start: (body: Record<string, unknown>) => {
      void withDebugPreview("/api/ai/execute", body, (finalBody) => {
        runExecutorStream({ key, body: finalBody });
      });
    },
    stop: () => abortStream(key),
    reset: () => resetStream(key),
  };
}
