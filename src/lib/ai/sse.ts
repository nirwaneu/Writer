import { AppError } from "@/lib/errors";

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

export type SSESend = (event: string, data: unknown) => void;

export function sseResponse(
  producer: (send: SSESend, signal: AbortSignal) => Promise<void>,
  signal: AbortSignal,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send: SSESend = (event, data) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          closed = true;
        }
      };

      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
        } catch {
          closed = true;
        }
      }, 15_000);

      try {
        await producer(send, signal);
      } catch (error) {
        if (!signal.aborted) {
          const appError =
            error instanceof AppError
              ? error
              : new AppError("INTERNAL", "The stream failed unexpectedly.", {
                  status: 500,
                  cause: error,
                });
          console.error("[sse]", appError.code, appError.message);
          send("error", {
            code: appError.code,
            message: appError.message,
            retryable: appError.retryable,
          });
        }
      } finally {
        clearInterval(heartbeat);
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

export type StreamPiece =
  | { type: "delta"; text: string }
  | { type: "reasoning"; text: string }
  | {
      type: "usage";
      usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
    };

const OPEN_TAGS = ["<think>", " thinking", "<thinking>"];
const CLOSE_TAGS = ["</think>", "</thinking>"];

class ThinkTagSplitter {
  private buffer = "";
  private inReasoning = false;

  push(chunk: string): StreamPiece[] {
    this.buffer += chunk;
    return this.drain(false);
  }

  flush(): StreamPiece[] {
    return this.drain(true);
  }

  private drain(final: boolean): StreamPiece[] {
    const pieces: StreamPiece[] = [];
    while (true) {
      const tags = this.inReasoning ? CLOSE_TAGS : OPEN_TAGS;
      const found = tags
        .map((tag) => ({ tag, index: this.buffer.indexOf(tag) }))
        .filter((entry) => entry.index >= 0)
        .sort((a, b) => a.index - b.index)[0];

      if (found) {
        const before = this.buffer.slice(0, found.index);
        if (before) {
          pieces.push({ type: this.inReasoning ? "reasoning" : "delta", text: before });
        }
        this.buffer = this.buffer.slice(found.index + found.tag.length);
        this.inReasoning = !this.inReasoning;
        continue;
      }

      if (final) {
        if (this.buffer) {
          pieces.push({ type: this.inReasoning ? "reasoning" : "delta", text: this.buffer });
          this.buffer = "";
        }
        break;
      }

      const hold = longestSuffixPrefix(this.buffer, tags);
      const emit = this.buffer.slice(0, this.buffer.length - hold);
      if (emit) {
        pieces.push({ type: this.inReasoning ? "reasoning" : "delta", text: emit });
      }
      this.buffer = this.buffer.slice(this.buffer.length - hold);
      break;
    }
    return pieces;
  }
}

function longestSuffixPrefix(value: string, tags: string[]): number {
  let longest = 0;
  for (const tag of tags) {
    const max = Math.min(tag.length - 1, value.length);
    for (let length = max; length > 0; length -= 1) {
      if (value.endsWith(tag.slice(0, length))) {
        longest = Math.max(longest, length);
        break;
      }
    }
  }
  return longest;
}

const IDLE_TIMEOUT = 180_000;

function readWithIdleTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new AppError(
          "AI_TIMEOUT",
          "The model stopped sending text. The partial result is preserved.",
          { status: 504, retryable: true },
        ),
      );
    }, IDLE_TIMEOUT);

    reader.read().then(
      (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function* parseOpenAIStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<StreamPiece> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const splitter = new ThinkTagSplitter();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await readWithIdleTimeout(reader);
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const piece = parseBlock(block, splitter);
        if (piece === "done") {
          for (const item of splitter.flush()) yield item;
          return;
        }
        if (Array.isArray(piece)) {
          for (const item of piece) yield item;
        }
        boundary = buffer.indexOf("\n\n");
      }
    }

    if (buffer.trim()) {
      const piece = parseBlock(buffer, splitter);
      if (Array.isArray(piece)) {
        for (const item of piece) yield item;
      }
    }
    for (const item of splitter.flush()) yield item;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

function parseBlock(block: string, splitter: ThinkTagSplitter): StreamPiece[] | "done" | null {
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith(":")) continue;
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  if (!dataLines.length) return null;
  const data = dataLines.join("\n").trim();
  if (!data) return null;
  if (data === "[DONE]") return "done";

  let json: unknown;
  try {
    json = JSON.parse(data);
  } catch {
    return null;
  }

  const payload = json as {
    error?: { message?: string } | string;
    choices?: Array<{
      delta?: {
        content?: unknown;
        reasoning_content?: unknown;
        reasoning?: unknown;
        thinking?: unknown;
      };
      message?: { content?: unknown; reasoning?: unknown };
      text?: string;
      finish_reason?: string | null;
    }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };

  if (payload.error) {
    const message =
      typeof payload.error === "string"
        ? payload.error
        : payload.error.message || "The model provider reported an error.";
    throw new AppError("AI_BAD_RESPONSE", message, { status: 502, retryable: true });
  }

  const choice = payload.choices?.[0];
  const raw =
    choice?.delta?.content ??
    choice?.message?.content ??
    choice?.text ??
    "";
  const text = extractText(raw);

  const pieces: StreamPiece[] = [];
  const reasoning = extractText(
    choice?.delta?.reasoning_content ??
      choice?.delta?.reasoning ??
      choice?.delta?.thinking ??
      choice?.message?.reasoning,
  );
  if (reasoning) pieces.push({ type: "reasoning", text: reasoning });
  if (text) pieces.push(...splitter.push(text));

  if (payload.usage) {
    pieces.push({
      type: "usage",
      usage: {
        promptTokens: payload.usage.prompt_tokens,
        completionTokens: payload.usage.completion_tokens,
        totalTokens: payload.usage.total_tokens,
      },
    });
  }

  return pieces.length ? pieces : null;
}

function extractText(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    return raw
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return typeof part.text === "string" ? part.text : "";
        }
        return "";
      })
      .join("");
  }
  return "";
}
