"use client";

import { create } from "zustand";
import type { ChatMessage, Chapter } from "@/lib/schemas";
import type { ChatFailure } from "@/lib/chat-types";

export type StreamKind = "planner" | "executor";
export type StreamStatus = "idle" | "streaming" | "done" | "error";
export type StreamMode = "send" | "regenerate" | "branch";

export type StreamEntry = {
  kind: StreamKind;
  status: StreamStatus;
  text: string;
  reasoning: string;
  error: ChatFailure;
  startedAt: number;
  mode?: StreamMode;
  targetMessageId?: string;
  assistantMessage?: ChatMessage;
  userMessage?: ChatMessage;
  chapter?: Chapter;
  lastBody?: Record<string, unknown>;
};

type StreamStore = {
  streams: Record<string, StreamEntry>;
  patch: (key: string, kind: StreamKind, patch: Partial<StreamEntry>) => void;
  reset: (key: string) => void;
};

export const useStreamStore = create<StreamStore>((set) => ({
  streams: {},
  patch: (key, kind, patch) =>
    set((state) => {
      const current = state.streams[key];
      const base: StreamEntry = current ?? {
        kind,
        status: "idle",
        text: "",
        reasoning: "",
        error: null,
        startedAt: 0,
      };
      return {
        streams: {
          ...state.streams,
          [key]: { ...base, ...patch },
        },
      };
    }),
  reset: (key) =>
    set((state) => {
      const next = { ...state.streams };
      delete next[key];
      return { streams: next };
    }),
}));

export function patchStream(
  key: string,
  kind: StreamKind,
  patch: Partial<StreamEntry>,
): void {
  useStreamStore.getState().patch(key, kind, patch);
}

export function resetStream(key: string): void {
  useStreamStore.getState().reset(key);
}

export function selectStream(key: string): StreamEntry | undefined {
  return useStreamStore.getState().streams[key];
}

export const streamControllers = new Map<string, AbortController>();

export function abortStream(key: string): void {
  streamControllers.get(key)?.abort();
}
