import { afterEach, describe, expect, it, vi } from "vitest";
import { chatCompletion } from "@/lib/ai/client";

afterEach(() => {
  vi.unstubAllGlobals();
});

function completion(content: string, finishReason = "stop") {
  return new Response(
    JSON.stringify({
      model: "test-model",
      choices: [{ message: { content }, finish_reason: finishReason }],
      usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("chatCompletion token-budget retry", () => {
  it("retries with a larger budget when reasoning consumes all completion tokens", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(completion("", "length"))
      .mockResolvedValueOnce(completion("The Salt Gate"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await chatCompletion({
      baseUrl: "https://api.example.com/v1",
      apiKey: "secret",
      model: "test-model",
      messages: [{ role: "user", content: "Name this chapter." }],
      maxTokens: 1_024,
      retries: 1,
    });

    expect(result.content).toBe("The Salt Gate");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(firstBody.max_tokens).toBe(1_024);
    expect(secondBody.max_tokens).toBe(2_048);
  });

  it("surfaces the finish reason when the larger budget still returns no text", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(completion("", "length"))
      .mockResolvedValueOnce(completion("", "length"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      chatCompletion({
        baseUrl: "https://api.example.com/v1",
        apiKey: "secret",
        model: "test-model",
        messages: [{ role: "user", content: "Name this chapter." }],
        maxTokens: 1_024,
        retries: 1,
      }),
    ).rejects.toThrow(/finish: length/i);
  });
});
