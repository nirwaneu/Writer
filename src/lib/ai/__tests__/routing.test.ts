import { describe, expect, it } from "vitest";
import {
  formatModelValue,
  modelDisplayLabel,
  parseModelValue,
  resolveModelRoute,
} from "@/lib/ai/routing";
import type { AppConfig } from "@/lib/schemas";

const providers = [
  {
    id: "provider-a",
    name: "NanoGPT",
    baseUrl: "https://a.example/v1",
    apiKey: "key-a",
    connection: { ok: true },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "provider-b",
    name: "OpenRouter",
    baseUrl: "https://b.example/v1",
    apiKey: "key-b",
    connection: { ok: true },
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  },
];

const config: AppConfig = {
  version: 1,
  baseUrl: "",
  apiKey: "",
  models: {
    planner: "provider-a|gemma-4",
    executor: "provider-b|claude",
    summarizer: "provider-a|gemma-4",
  },
  providers,
  connection: { ok: true },
  presets: [],
  defaultPresetId: "default-general-fiction",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("model routing", () => {
  it("round-trips provider-scoped model values", () => {
    const value = formatModelValue("provider-a", "gemma-4");
    expect(value).toBe("provider-a|gemma-4");
    expect(parseModelValue(value)).toEqual({
      providerId: "provider-a",
      model: "gemma-4",
    });
  });

  it("treats an un-prefixed value as the first provider", () => {
    expect(parseModelValue("gemma-4").providerId).toBeUndefined();
    expect(resolveModelRoute(config, "gemma-4").provider.id).toBe("provider-a");
  });

  it("routes each role to the provider that owns its model", () => {
    expect(resolveModelRoute(config, config.models.planner)).toMatchObject({
      provider: { id: "provider-a" },
      model: "gemma-4",
    });
    expect(resolveModelRoute(config, config.models.executor)).toMatchObject({
      provider: { id: "provider-b" },
      model: "claude",
    });
  });

  it("formats display labels with the provider name", () => {
    expect(modelDisplayLabel(providers, config.models.executor)).toBe(
      "[OpenRouter] claude",
    );
    expect(modelDisplayLabel(providers, "gemma-4")).toBe("[NanoGPT] gemma-4");
  });

  it("rejects a model whose provider was removed", () => {
    expect(() => resolveModelRoute(config, "gone|gemma-4")).toThrow(
      /provider for this model was removed/i,
    );
  });
});
