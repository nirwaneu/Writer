"use client";

import { abortStream, resetStream, useStreamStore } from "@/lib/streams/store";
import { runExecutorStream } from "@/lib/streams/runners";

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
    start: (body: Record<string, unknown>) => runExecutorStream({ key, body }),
    stop: () => abortStream(key),
    reset: () => resetStream(key),
  };
}
