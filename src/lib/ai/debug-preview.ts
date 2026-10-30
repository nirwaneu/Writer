"use client";

import { toast } from "sonner";
import { useDebugStore } from "@/lib/debug-store";
import { readDebugMode } from "@/lib/use-debug-mode";

function stripDebugFields(body: Record<string, unknown>): Record<string, unknown> {
  const rest = { ...body };
  delete rest.debug;
  delete rest.debugPayload;
  return rest;
}

export async function withDebugPreview(
  endpoint: string,
  body: Record<string, unknown>,
  fire: (body: Record<string, unknown>) => void | Promise<void>,
): Promise<boolean> {
  if (!readDebugMode()) {
    await fire(stripDebugFields(body));
    return true;
  }

  let preview: { payload?: Record<string, unknown>; error?: { message?: string } } | null;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...stripDebugFields(body), debug: true }),
      credentials: "same-origin",
    });
    preview = (await response.json().catch(() => null)) as typeof preview;
    if (!response.ok || !preview?.payload) {
      toast.error(preview?.error?.message || "Could not build the debug payload.");
      return false;
    }
  } catch {
    toast.error("Could not reach the app server to build the debug payload.");
    return false;
  }

  const approved = await useDebugStore.getState().open(endpoint, preview.payload);
  if (!approved) return false;

  await fire({ ...stripDebugFields(body), debug: false, debugPayload: preview.payload });
  return true;
}
