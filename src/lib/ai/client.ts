import { AppError } from "@/lib/errors";
import { resolveEndpoints } from "@/lib/ai/urls";
import type { ConnectionResult, GenerationParams } from "@/lib/schemas";

export type ChatRole = "system" | "user" | "assistant";
export type ChatInputMessage = { role: ChatRole; content: string };

export function generationFields(
  params: GenerationParams | undefined,
  fallbackTemperature: number,
): Record<string, number | string> {
  if (!params) return { temperature: fallbackTemperature };
  return {
    temperature: params.temperature,
    top_p: params.topP,
    frequency_penalty: params.frequencyPenalty,
    presence_penalty: params.presencePenalty,
    ...(params.topK > 0 ? { top_k: params.topK } : {}),
    ...(params.reasoningEffort?.trim()
      ? { reasoning_effort: params.reasoningEffort.trim() }
      : {}),
  };
}

export type ChatResult = {
  content: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
};

const DEFAULT_TIMEOUT = 180_000;
const HEADER_TIMEOUT = 120_000;

function authHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (apiKey.trim()) {
    headers.Authorization = `Bearer ${apiKey.trim()}`;
  }
  return headers;
}

async function readErrorBody(response: Response): Promise<string> {
  try {
    const raw = await response.text();
    if (!raw) return "";
    try {
      const parsed = JSON.parse(raw) as {
        error?: { message?: string } | string;
        message?: string;
      };
      if (typeof parsed.error === "string") return parsed.error;
      return parsed.error?.message || parsed.message || raw.slice(0, 500);
    } catch {
      return raw.slice(0, 500);
    }
  } catch {
    return "";
  }
}

export function mapHttpError(status: number, body: string, model?: string): AppError {
  const detail = body ? ` ${body}` : "";
  if (status === 401 || status === 403) {
    return new AppError(
      "AI_AUTH",
      "The provider rejected the API key. Check the key in Setup." + detail,
      { status: 502, retryable: false, details: { status } },
    );
  }
  if (status === 404 || status === 405) {
    return new AppError(
      "AI_UNAVAILABLE",
      `The endpoint or model was not found${model ? ` (${model})` : ""}. Check the base URL and model IDs.` +
        detail,
      { status: 502, retryable: false, details: { status } },
    );
  }
  if (status === 429) {
    return new AppError(
      "AI_RATE_LIMIT",
      "The provider is rate-limiting requests. Wait a moment and try again." + detail,
      { status: 429, retryable: true, details: { status } },
    );
  }
  if (status >= 500) {
    return new AppError(
      "AI_UNAVAILABLE",
      "The model provider is unavailable right now. Your work is safe; retry in a moment." + detail,
      { status: 502, retryable: true, details: { status } },
    );
  }
  return new AppError("AI_BAD_RESPONSE", `The provider rejected the request.${detail}`, {
    status: 502,
    retryable: false,
    details: { status },
  });
}

function networkError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const name = (error as Error)?.name;
  if (name === "AbortError" || name === "TimeoutError") {
    return new AppError("AI_TIMEOUT", "The model took too long to respond.", {
      status: 504,
      retryable: true,
    });
  }
  const cause = (error as { cause?: { code?: string } })?.cause;
  const suffix = cause?.code ? ` (${cause.code})` : "";
  return new AppError(
    "AI_UNAVAILABLE",
    `Could not reach the model provider${suffix}. Check the endpoint and that the server is running.`,
    { status: 502, retryable: true, cause: error },
  );
}

function composeSignal(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!signal) return timeout;
  return AbortSignal.any([signal, timeout]);
}

async function sleep(ms: number, signal?: AbortSignal) {
  await new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

export async function listModels(
  baseUrl: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<{ models: string[]; latencyMs: number }> {
  const started = Date.now();
  const { models } = resolveEndpoints(baseUrl);
  let response: Response;
  try {
    response = await fetch(models, {
      headers: authHeaders(apiKey),
      signal: composeSignal(signal, 20_000),
      cache: "no-store",
    });
  } catch (error) {
    throw networkError(error);
  }
  if (!response.ok) {
    throw mapHttpError(response.status, await readErrorBody(response));
  }
  const body = (await response.json().catch(() => null)) as
    | { data?: Array<{ id?: string }> }
    | Array<{ id?: string }>
    | null;
  const entries = Array.isArray(body) ? body : body?.data ?? [];
  const ids = entries
    .map((entry) => entry?.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  return { models: Array.from(new Set(ids)).sort(), latencyMs: Date.now() - started };
}

export type ImageGenerationResult = {
  bytes: Buffer;
  mime: string;
};

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

function imageMimeFromBytes(bytes: Buffer): string | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function normalizeImageMime(value: string | null | undefined, bytes: Buffer): string {
  const mime = value?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (mime === "image/png" || mime === "image/jpeg" || mime === "image/webp") {
    return mime;
  }
  return imageMimeFromBytes(bytes) ?? "image/png";
}

export async function generateImage(options: {
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  negativePrompt?: string;
  size: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<ImageGenerationResult> {
  const {
    baseUrl,
    apiKey,
    model,
    prompt,
    negativePrompt,
    size,
    signal,
    timeoutMs = 180_000,
  } = options;
  const { images } = resolveEndpoints(baseUrl);

  let response: Response;
  try {
    response = await fetch(images, {
      method: "POST",
      headers: authHeaders(apiKey),
      body: JSON.stringify({
        model,
        prompt,
        n: 1,
        size,
        ...(negativePrompt?.trim() ? { negative_prompt: negativePrompt.trim() } : {}),
      }),
      signal: composeSignal(signal, timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    throw networkError(error);
  }

  if (!response.ok) {
    throw mapHttpError(response.status, await readErrorBody(response), model);
  }

  const body = (await response.json().catch(() => null)) as
    | {
        data?: Array<{
          b64_json?: string;
          url?: string;
          image_url?: string;
        }>;
        error?: { message?: string };
      }
    | null;
  const item = body?.data?.[0];
  if (!item) {
    throw new AppError(
      "AI_BAD_RESPONSE",
      body?.error?.message || "The image provider returned no image.",
      { status: 502, retryable: true },
    );
  }

  let bytes: Buffer;
  let declaredMime: string | null = null;

  if (typeof item.b64_json === "string" && item.b64_json.trim()) {
    let encoded = item.b64_json.trim();
    const dataUrl = encoded.match(/^data:([^;,]+);base64,(.*)$/s);
    if (dataUrl) {
      declaredMime = dataUrl[1];
      encoded = dataUrl[2];
    }
    bytes = Buffer.from(encoded, "base64");
  } else {
    const remote = item.url || item.image_url;
    if (!remote) {
      throw new AppError(
        "AI_BAD_RESPONSE",
        "The image provider returned no usable image data.",
        { status: 502, retryable: true },
      );
    }

    let imageResponse: Response;
    try {
      imageResponse = await fetch(remote, {
        signal: composeSignal(signal, timeoutMs),
        cache: "no-store",
      });
    } catch (error) {
      throw networkError(error);
    }
    if (!imageResponse.ok) {
      throw new AppError(
        "AI_UNAVAILABLE",
        `The generated image could not be downloaded (${imageResponse.status}).`,
        { status: 502, retryable: true },
      );
    }
    declaredMime = imageResponse.headers.get("content-type");
    const declaredLength = Number(imageResponse.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_IMAGE_BYTES) {
      throw new AppError("AI_BAD_RESPONSE", "The generated image is too large.", {
        status: 502,
      });
    }
    bytes = Buffer.from(await imageResponse.arrayBuffer());
  }

  if (!bytes.length) {
    throw new AppError("AI_BAD_RESPONSE", "The generated image was empty.", {
      status: 502,
      retryable: true,
    });
  }
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new AppError("AI_BAD_RESPONSE", "The generated image is too large.", {
      status: 502,
    });
  }

  return { bytes, mime: normalizeImageMime(declaredMime, bytes) };
}

export async function testConnection(
  baseUrl: string,
  apiKey: string,
  probeModel?: string,
): Promise<ConnectionResult> {
  try {
    const { models, latencyMs } = await listModels(baseUrl, apiKey);
    return {
      ok: true,
      models,
      latencyMs,
      detail:
        models.length > 0
          ? `Connected in ${latencyMs} ms. ${models.length} model${models.length === 1 ? "" : "s"} available.`
          : `Connected in ${latencyMs} ms. This endpoint did not list models; enter model IDs manually.`,
    };
  } catch (error) {
    const appError = error instanceof AppError ? error : networkError(error);
    const upstreamStatus = (appError.details as { status?: number } | undefined)?.status;
    const listingUnsupported =
      upstreamStatus === 404 || upstreamStatus === 405 || upstreamStatus === 400;

    if (listingUnsupported && probeModel?.trim()) {
      try {
        const started = Date.now();
        await chatCompletion({
          baseUrl,
          apiKey,
          model: probeModel.trim(),
          messages: [{ role: "user", content: "Reply with OK." }],
          maxTokens: 4,
          temperature: 0,
          timeoutMs: 30_000,
          retries: 0,
        });
        return {
          ok: true,
          models: [],
          latencyMs: Date.now() - started,
          detail: `Connected with ${probeModel.trim()}. This endpoint does not list models; enter model IDs manually.`,
        };
      } catch (probeError) {
        const probeAppError = probeError instanceof AppError ? probeError : networkError(probeError);
        return {
          ok: false,
          models: [],
          latencyMs: 0,
          detail: probeAppError.message,
        };
      }
    }

    return {
      ok: false,
      models: [],
      latencyMs: 0,
      detail:
        listingUnsupported && !probeModel
          ? "This endpoint does not expose /models. Enter a model ID to test the connection."
          : appError.message,
    };
  }
}

export async function chatCompletion(
  options: {
    baseUrl: string;
    apiKey: string;
    model: string;
    messages: ChatInputMessage[];
    params?: GenerationParams;
    temperature?: number;
    maxTokens?: number;
    signal?: AbortSignal;
    timeoutMs?: number;
    retries?: number;
  },
): Promise<ChatResult> {
  const {
    baseUrl,
    apiKey,
    model,
    messages,
    params,
    temperature = 0.8,
    maxTokens,
    signal,
    timeoutMs = DEFAULT_TIMEOUT,
    retries = 2,
  } = options;
  const { chat } = resolveEndpoints(baseUrl);
  let lastError: AppError | null = null;
  let requestMaxTokens = maxTokens;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(chat, {
        method: "POST",
        headers: authHeaders(apiKey),
        body: JSON.stringify({
          model,
          messages,
          ...generationFields(params, temperature),
          stream: false,
          ...(requestMaxTokens ? { max_tokens: requestMaxTokens } : {}),
        }),
        signal: composeSignal(signal, timeoutMs),
        cache: "no-store",
      });

      if (!response.ok) {
        const body = await readErrorBody(response);
        const error = mapHttpError(response.status, body, model);
        if (error.retryable && attempt < retries) {
          lastError = error;
          await sleep(600 * 2 ** attempt, signal);
          continue;
        }
        throw error;
      }

      const body = (await response.json().catch(() => null)) as {
        model?: string;
        choices?: Array<{
          message?: { content?: unknown };
          text?: string;
          finish_reason?: string | null;
        }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      } | null;

      if (!body) {
        throw new AppError("AI_BAD_RESPONSE", "The provider returned an empty response.", {
          status: 502,
          retryable: true,
        });
      }

      const finishReason = body.choices?.[0]?.finish_reason ?? null;
      const content = extractContent(body);
      if (!content.trim()) {
        if (finishReason === "length" && attempt < retries && requestMaxTokens) {
          const nextMaxTokens = Math.min(requestMaxTokens * 2, 8_192);
          console.warn(
            `[ai] ${model} returned no visible text with max_tokens=${requestMaxTokens}; retrying with ${nextMaxTokens}.`,
          );
          requestMaxTokens = nextMaxTokens;
          continue;
        }
        throw new AppError(
          "AI_BAD_RESPONSE",
          `The model returned no text${finishReason ? ` (finish: ${finishReason})` : ""}. Try again.`,
          {
            status: 502,
            retryable: true,
            details: {
              finishReason,
              maxTokens: requestMaxTokens,
              usage: body.usage,
            },
          },
        );
      }

      return {
        content,
        model: body.model || model,
        usage: body.usage
          ? {
              promptTokens: body.usage.prompt_tokens,
              completionTokens: body.usage.completion_tokens,
              totalTokens: body.usage.total_tokens,
            }
          : undefined,
      };
    } catch (error) {
      const appError = networkError(error);
      if (appError.retryable && attempt < retries && appError.code !== "AI_TIMEOUT") {
        lastError = appError;
        await sleep(600 * 2 ** attempt, signal).catch(() => undefined);
        continue;
      }
      throw appError;
    }
  }

  throw lastError ?? new AppError("AI_UNAVAILABLE", "The model request failed.", { status: 502 });
}

function extractContent(body: {
  choices?: Array<{ message?: { content?: unknown }; text?: string }>;
}): string {
  const choice = body.choices?.[0];
  if (!choice) return "";
  if (typeof choice.text === "string") return choice.text;
  const content = choice.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
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

async function fetchStreamWithHeaderTimeout(
  url: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener("abort", abort, { once: true });
  }
  const timeout = setTimeout(
    () =>
      controller.abort(
        new DOMException("The provider did not start streaming in time.", "TimeoutError"),
      ),
    HEADER_TIMEOUT,
  );

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
    throw error;
  }
}

export async function openChatStream(options: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatInputMessage[];
  params?: GenerationParams;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  retries?: number;
}): Promise<Response> {
  const {
    baseUrl,
    apiKey,
    model,
    messages,
    params,
    temperature = 0.85,
    maxTokens,
    signal,
    retries = 1,
  } = options;
  const { chat } = resolveEndpoints(baseUrl);
  let lastError: AppError | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (signal?.aborted) {
      throw new AppError("AI_TIMEOUT", "The request was interrupted.", {
        status: 499,
        retryable: false,
      });
    }
    try {
      const response = await fetchStreamWithHeaderTimeout(
        chat,
        {
          method: "POST",
          headers: { ...authHeaders(apiKey), Accept: "text/event-stream" },
          body: JSON.stringify({
            model,
            messages,
            ...generationFields(params, temperature),
            stream: true,
            ...(maxTokens ? { max_tokens: maxTokens } : {}),
          }),
          cache: "no-store",
        },
        signal,
      );

      if (!response.ok) {
        const body = await readErrorBody(response);
        const error = mapHttpError(response.status, body, model);
        if (error.retryable && attempt < retries) {
          lastError = error;
          await sleep(700 * 2 ** attempt, signal);
          continue;
        }
        throw error;
      }
      if (!response.body) {
        throw new AppError("AI_BAD_RESPONSE", "The provider returned no stream.", {
          status: 502,
          retryable: true,
        });
      }
      return response;
    } catch (error) {
      const appError = networkError(error);
      if (signal?.aborted) {
        throw new AppError("AI_TIMEOUT", "The request was interrupted.", {
          status: 499,
          retryable: false,
          cause: appError,
        });
      }
      if (appError.retryable && attempt < retries) {
        lastError = appError;
        await sleep(700 * 2 ** attempt, signal).catch(() => undefined);
        continue;
      }
      throw appError;
    }
  }

  throw lastError ?? new AppError("AI_UNAVAILABLE", "The model request failed.", { status: 502 });
}
