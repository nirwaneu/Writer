import { describe, expect, it } from "vitest";
import { parseOpenAIStream } from "@/lib/ai/sse";

function streamFrom(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>) {
  const pieces = [];
  for await (const piece of parseOpenAIStream(stream)) pieces.push(piece);
  return pieces;
}

describe("parseOpenAIStream", () => {
  it("reassembles deltas across arbitrary chunk boundaries", async () => {
    const pieces = await collect(
      streamFrom([
        'data: {"choices":[{"delta":{"content":"Hel',
        'lo"}}]}\n\ndata: {"choices":[{"delta":{"content":" world"}}]}\n\n',
        "data: [DONE]\n\n",
      ]),
    );
    const text = pieces
      .filter((piece) => piece.type === "delta")
      .map((piece) => (piece.type === "delta" ? piece.text : ""))
      .join("");
    expect(text).toBe("Hello world");
  });

  it("handles CRLF and usage", async () => {
    const pieces = await collect(
      streamFrom([
        'data: {"choices":[{"delta":{"content":"Hi"}}]}\r\n\r\n',
        'data: {"choices":[],"usage":{"prompt_tokens":3,"completion_tokens":2,"total_tokens":5}}\r\n\r\n',
        "data: [DONE]\r\n\r\n",
      ]),
    );
    expect(pieces[0]).toEqual({ type: "delta", text: "Hi" });
    expect(pieces[1]).toEqual({
      type: "usage",
      usage: { promptTokens: 3, completionTokens: 2, totalTokens: 5 },
    });
  });

  it("ignores comments and malformed payloads", async () => {
    const pieces = await collect(
      streamFrom([
        ": heartbeat\n\n",
        "data: not-json\n\n",
        'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
        "data: [DONE]\n\n",
      ]),
    );
    expect(pieces).toEqual([{ type: "delta", text: "ok" }]);
  });

  it("emits reasoning_content separately", async () => {
    const pieces = await collect(
      streamFrom([
        'data: {"choices":[{"delta":{"reasoning_content":"Think first."}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"Visible answer."}}]}\n\n',
        "data: [DONE]\n\n",
      ]),
    );
    expect(pieces[0]).toEqual({ type: "reasoning", text: "Think first." });
    expect(pieces[1]).toEqual({ type: "delta", text: "Visible answer." });
  });

  it("splits think tags across chunks", async () => {
    const pieces = await collect(
      streamFrom([
        'data: {"choices":[{"delta":{"content":"<thi"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"nk>We need</think>Visible"}}]}\n\n',
        "data: [DONE]\n\n",
      ]),
    );
    expect(pieces).toEqual([
      { type: "reasoning", text: "We need" },
      { type: "delta", text: "Visible" },
    ]);
  });

  it("throws when the provider sends an error payload", async () => {
    await expect(
      collect(streamFrom(['data: {"error":{"message":"bad key"}}\n\n'])),
    ).rejects.toThrow("bad key");
  });
});
