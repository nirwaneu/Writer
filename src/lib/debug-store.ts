"use client";

import { create } from "zustand";

export type DebugPayloadRequest = {
  endpoint: string;
  payload: Record<string, unknown>;
  resolve: (approved: boolean) => void;
};

type DebugStore = {
  request: DebugPayloadRequest | null;
  open: (endpoint: string, payload: Record<string, unknown>) => Promise<boolean>;
  resolve: (approved: boolean) => void;
};

export const useDebugStore = create<DebugStore>((set, get) => ({
  request: null,
  open: (endpoint, payload) =>
    new Promise<boolean>((resolve) => {
      const current = get().request;
      if (current) current.resolve(false);
      set({ request: { endpoint, payload, resolve } });
    }),
  resolve: (approved) => {
    const current = get().request;
    if (!current) return;
    set({ request: null });
    current.resolve(approved);
  },
}));
