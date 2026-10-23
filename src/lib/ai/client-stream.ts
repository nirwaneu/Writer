export type StreamHandlers = {
  onMeta?: (data: unknown) => void;
  onDelta?: (text: string, full: string) => void;
  onReasoning?: (text: string, full: string) => void;
  onDone?: (data: unknown) => void;
  onPing?: () => void;
};

export class StreamClientError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly partial: string;
  readonly saved: boolean;

  constructor(
    message: string,
    options: { code?: string; retryable?: boolean; partial?: string; saved?: boolean } = {},
  ) {
    super(message);
    this.name = "StreamClientError";
    this.code = options.code ?? "STREAM_FAILED";
    this.retryable = options.retryable ?? true;
    this.partial = options.partial ?? "";
    this.saved = options.saved ?? false;
  }
}

type ParsedEvent = { event: string; data: unknown };

export async function streamChat(
  endpoint: string,
  body: unknown,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
      credentials: "same-origin",
    });
  } catch (error) {
    if ((error as Error)?.name === "AbortError") throw error;
    throw new StreamClientError("Could not reach the app server. Check your connection.", {
      code: "NETWORK",
    });
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: { code?: string; message?: string; retryable?: boolean } }
      | null;
    throw new StreamClientError(
      payload?.error?.message || `The request failed (${response.status}).`,
      {
        code: payload?.error?.code ?? "HTTP_ERROR",
        retryable: payload?.error?.retryable ?? response.status >= 500,
      },
    );
  }

  if (!response.body) {
    throw new StreamClientError("The server returned an empty stream.", { code: "EMPTY_STREAM" });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let partial = "";
  let reasoning = "";
  let finished = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");

        const parsed = parseEventBlock(block);
        if (!parsed) continue;

        if (parsed.event === "meta") {
          handlers.onMeta?.(parsed.data);
        } else if (parsed.event === "delta") {
          const text = (parsed.data as { text?: string })?.text ?? "";
          if (text) {
            partial += text;
            handlers.onDelta?.(text, partial);
          }
        } else if (parsed.event === "reasoning") {
          const text = (parsed.data as { text?: string })?.text ?? "";
          if (text) {
            reasoning += text;
            handlers.onReasoning?.(text, reasoning);
          }
        } else if (parsed.event === "ping") {
          handlers.onPing?.();
        } else if (parsed.event === "done") {
          finished = true;
          handlers.onDone?.(parsed.data);
          return parsed.data;
        } else if (parsed.event === "error") {
          const error = parsed.data as {
            code?: string;
            message?: string;
            retryable?: boolean;
            saved?: boolean;
          };
          throw new StreamClientError(error.message || "The model stream failed.", {
            code: error.code,
            retryable: error.retryable,
            partial,
            saved: error.saved,
          });
        }
      }
    }
  } catch (error) {
    if ((error as Error)?.name === "AbortError") {
      throw new StreamClientError("Generation stopped.", {
        code: "ABORTED",
        retryable: false,
        partial,
      });
    }
    if (error instanceof StreamClientError) throw error;
    throw new StreamClientError("The stream ended unexpectedly. Your text is preserved.", {
      code: "STREAM_INTERRUPTED",
      partial,
    });
  } finally {
    reader.releaseLock();
  }

  if (!finished) {
    throw new StreamClientError("The stream ended before it was finished. Your text is preserved.", {
      code: "STREAM_INCOMPLETE",
      partial,
    });
  }

  return null;
}

function parseEventBlock(block: string): ParsedEvent | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  if (!dataLines.length) return null;
  const raw = dataLines.join("\n");
  let data: unknown = raw;
  try {
    data = JSON.parse(raw);
  } catch {
    // leave as raw text
  }
  return { event, data };
}
