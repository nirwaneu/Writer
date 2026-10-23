"use client";

import { useCallback, useEffect, useState } from "react";
import type { ModelOption, ProviderModelGroup } from "@/lib/ai/model-options";

export function useAvailableModels() {
  const [groups, setGroups] = useState<ProviderModelGroup[]>([]);
  const [options, setOptions] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/models", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as
        | {
            groups?: ProviderModelGroup[];
            options?: ModelOption[];
            error?: { message?: string };
          }
        | null;
      if (!response.ok) {
        setError(payload?.error?.message || "Could not load models.");
        return;
      }
      setGroups(payload?.groups ?? []);
      setOptions(payload?.options ?? []);
    } catch {
      setError("Could not load models. Check the app server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void refresh();
    });
    return () => cancelAnimationFrame(frame);
  }, [refresh]);

  return { groups, options, loading, error, refresh };
}
