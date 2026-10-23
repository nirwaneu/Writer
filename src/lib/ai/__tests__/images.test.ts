import { afterEach, describe, expect, it, vi } from "vitest";
import { generateImage } from "@/lib/ai/client";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("generateImage", () => {
  it("posts an OpenAI-compatible payload and decodes b64 images", async () => {
    const fetchMock = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body).toMatchObject({
        model: "flux",
        prompt: "A map room",
        n: 1,
        size: "1024x1792",
        negative_prompt: "text",
      });
      return new Response(
        JSON.stringify({ data: [{ b64_json: PNG.toString("base64") }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateImage({
      baseUrl: "https://api.example.com/v1",
      apiKey: "secret",
      model: "flux",
      prompt: "A map room",
      negativePrompt: "text",
      size: "1024x1792",
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.example.com/v1/images/generations",
    );
    expect(result.mime).toBe("image/png");
    expect(result.bytes.equals(PNG)).toBe(true);
  });
});
