import { z } from "zod";
import { assertSameOrigin, errorResponse, jsonOk, parseBody } from "@/lib/api";
import { testConnection } from "@/lib/ai/client";
import { normalizeBaseUrl, resolveEndpoints } from "@/lib/ai/urls";
import { parseModelValue } from "@/lib/ai/routing";
import { AppError, NotFoundError } from "@/lib/errors";
import { getDb } from "@/lib/db";
import { books } from "@/lib/db/schema";
import {
  getConfig,
  isConfigured,
  saveConfig,
  toPublicConfig,
} from "@/lib/storage/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  baseUrl: z.string().min(1).max(2_000),
  apiKey: z.string().max(4_000).optional(),
});

export async function PUT(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const input = await parseBody(request, updateSchema);
    const config = await getConfig();
    if (!config) {
      throw new AppError("CONFIG_REQUIRED", "No provider configuration exists yet.", {
        status: 428,
      });
    }
    const existing = config.providers.find((provider) => provider.id === id);
    if (!existing) throw new NotFoundError("That provider no longer exists.");

    const baseUrl = normalizeBaseUrl(input.baseUrl);
    resolveEndpoints(baseUrl);
    const apiKey = input.apiKey?.trim() ? input.apiKey.trim() : existing.apiKey;
    const tested = await testConnection(baseUrl, apiKey);
    if (!tested.ok) {
      throw new AppError("AI_UNAVAILABLE", tested.detail, { status: 502 });
    }

    const timestamp = new Date().toISOString();
    const providers = config.providers.map((provider) =>
      provider.id === id
        ? {
            ...provider,
            name: input.name.trim(),
            baseUrl,
            apiKey,
            connection: {
              ok: true,
              checkedAt: timestamp,
              latencyMs: tested.latencyMs,
              detail: tested.detail,
            },
            updatedAt: timestamp,
          }
        : provider,
    );
    const saved = await saveConfig({ ...config, providers, updatedAt: timestamp });
    return jsonOk({
      providers: toPublicConfig(saved)?.providers ?? [],
      models: saved.models,
      configured: isConfigured(saved),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const config = await getConfig();
    if (!config) {
      throw new AppError("CONFIG_REQUIRED", "No provider configuration exists yet.", {
        status: 428,
      });
    }
    const existing = config.providers.find((provider) => provider.id === id);
    if (!existing) throw new NotFoundError("That provider no longer exists.");
    if (config.providers.length <= 1) {
      throw new AppError("BAD_REQUEST", "Keep at least one provider connection.", {
        status: 400,
      });
    }

    const firstId = config.providers[0]?.id;
    const usedByDefaults = [config.models.planner, config.models.executor, config.models.summarizer].filter(
      (value) => {
        const parsed = parseModelValue(value);
        return parsed.model && (parsed.providerId ? parsed.providerId === id : firstId === id);
      },
    );
    if (usedByDefaults.length) {
      throw new AppError(
        "CONFLICT",
        "This provider is used by the global default models. Choose new defaults before deleting it.",
        { status: 409 },
      );
    }

    const db = await getDb();
    const bookRows = db
      .select({
        slug: books.slug,
        title: books.title,
        plannerModel: books.plannerModel,
        executorModel: books.executorModel,
        summarizerModel: books.summarizerModel,
      })
      .from(books)
      .all();
    const usedByBooks = bookRows.filter((book) =>
      [book.plannerModel, book.executorModel, book.summarizerModel].some((value) => {
        if (!value) return false;
        const parsed = parseModelValue(value);
        return parsed.model && (parsed.providerId ? parsed.providerId === id : firstId === id);
      }),
    );
    if (usedByBooks.length) {
      const names = usedByBooks.slice(0, 3).map((book) => book.title).join(", ");
      throw new AppError(
        "CONFLICT",
        `This provider is used by ${usedByBooks.length} book${usedByBooks.length === 1 ? "" : "s"} (${names}). Reassign those models first.`,
        { status: 409 },
      );
    }

    const timestamp = new Date().toISOString();
    const saved = await saveConfig({
      ...config,
      providers: config.providers.filter((provider) => provider.id !== id),
      updatedAt: timestamp,
    });
    return jsonOk({
      providers: toPublicConfig(saved)?.providers ?? [],
      models: saved.models,
      configured: isConfigured(saved),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
