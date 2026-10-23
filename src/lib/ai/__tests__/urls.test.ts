import { describe, expect, it } from "vitest";
import { resolveEndpoints, normalizeBaseUrl } from "@/lib/ai/urls";

describe("resolveEndpoints", () => {
  it("appends chat and models to a /v1 base", () => {
    expect(resolveEndpoints("https://openrouter.ai/api/v1")).toEqual({
      chat: "https://openrouter.ai/api/v1/chat/completions",
      models: "https://openrouter.ai/api/v1/models",
    });
  });

  it("keeps a full chat-completions URL", () => {
    expect(resolveEndpoints("http://localhost:1234/v1/chat/completions")).toEqual({
      chat: "http://localhost:1234/v1/chat/completions",
      models: "http://localhost:1234/v1/models",
    });
  });

  it("upgrades a legacy completions URL", () => {
    expect(resolveEndpoints("https://example.com/v1/completions")).toEqual({
      chat: "https://example.com/v1/chat/completions",
      models: "https://example.com/v1/models",
    });
  });

  it("adds /v1 to a bare origin", () => {
    expect(resolveEndpoints("http://localhost:11434")).toEqual({
      chat: "http://localhost:11434/v1/chat/completions",
      models: "http://localhost:11434/v1/models",
    });
  });

  it("keeps a custom path", () => {
    expect(resolveEndpoints("https://example.com/openai/")).toEqual({
      chat: "https://example.com/openai/chat/completions",
      models: "https://example.com/openai/models",
    });
  });

  it("rejects invalid protocols", () => {
    expect(() => resolveEndpoints("ftp://example.com")).toThrow(/http/i);
    expect(() => resolveEndpoints("not a url")).toThrow(/valid/i);
  });
});

describe("normalizeBaseUrl", () => {
  it("trims trailing slashes and query strings", () => {
    expect(normalizeBaseUrl("https://example.com/v1/?x=1")).toBe("https://example.com/v1");
  });
});
