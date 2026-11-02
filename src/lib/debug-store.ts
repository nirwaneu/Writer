"use client";

import { create } from "zustand";

export type DebugPayloadRequest = {
  id: number;
  endpoint: string;
  payload: Record<string, unknown>;
  resolve: (payload: Record<string, unknown> | null) => void;
};

type DebugStore = {
  request: DebugPayloadRequest | null;
  open: (
    endpoint: string,
    payload: Record<string, unknown>,
  ) => Promise<Record<string, unknown> | null>;
  resolve: (payload: Record<string, unknown> | null) => void;
};

let nextRequestId = 0;

export const useDebugStore = create<DebugStore>((set, get) => ({
  request: null,
  open: (endpoint, payload) =>
    new Promise<Record<string, unknown> | null>((resolve) => {
      const current = get().request;
      if (current) current.resolve(null);
      nextRequestId += 1;
      set({ request: { id: nextRequestId, endpoint, payload, resolve } });
    }),
  resolve: (payload) => {
    const current = get().request;
    if (!current) return;
    set({ request: null });
    current.resolve(payload);
  },
}));
