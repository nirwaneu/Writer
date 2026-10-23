import { randomUUID } from "node:crypto";
import { z } from "zod";
import { assertSameOrigin, errorResponse, jsonOk, parseBody } from "@/lib/api";
import { testConnection } from "@/lib/ai/client";
import { normalizeBaseUrl, resolveEndpoints } from "@/lib/ai/urls";
import { AppError } from "@/lib/errors";
import {
  createEmptyConfig,
  getConfig,
  isConfigured,
  saveConfig,
  toPublicConfig,
} from "@/lib/storage/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = await getConfig();
    const publicConfig = toPublicConfig(config);
    return jsonOk({
      providers: publicConfig?.providers ?? [],
      models: config?.models ?? { planner: "", executor: "", summarizer: "" },
      configured: isConfigured(config),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  baseUrl: z.string().min(1).max(2_000),
  apiKey: z.string().max(4_000).optional(),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = await parseBody(request, createSchema);
    const baseUrl = normalizeBaseUrl(input.baseUrl);
    resolveEndpoints(baseUrl);
    const apiKey = input.apiKey?.trim() ?? "";
    const tested = await testConnection(baseUrl, apiKey);
    if (!tested.ok) {
      throw new AppError("AI_UNAVAILABLE", tested.detail, { status: 502 });
    }

    const config = (await getConfig()) ?? createEmptyConfig();
    const timestamp = new Date().toISOString();
    const provider = {
      id: randomUUID(),
      name: input.name.trim(),
      baseUrl,
      apiKey,
      connection: {
        ok: true,
        checkedAt: timestamp,
        latencyMs: tested.latencyMs,
        detail: tested.detail,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const saved = await saveConfig({
      ...config,
      providers: [...config.providers, provider],
      updatedAt: timestamp,
    });

    return jsonOk(
      {
        provider: toPublicConfig(saved)?.providers.find((item) => item.id === provider.id),
        providers: toPublicConfig(saved)?.providers ?? [],
        models: saved.models,
        configured: isConfigured(saved),
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
