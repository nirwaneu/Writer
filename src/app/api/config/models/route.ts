import { z } from "zod";
import { assertSameOrigin, errorResponse, jsonOk, parseBody } from "@/lib/api";
import { resolveModelRoute } from "@/lib/ai/routing";
import { AppError } from "@/lib/errors";
import { getConfig, isConfigured, saveConfig, toPublicConfig } from "@/lib/storage/config";
import { modelRolesSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  models: modelRolesSchema,
});

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const input = await parseBody(request, schema);
    const config = await getConfig();
    if (!config) {
      throw new AppError("CONFIG_REQUIRED", "Add a provider connection first.", { status: 428 });
    }
    resolveModelRoute(config, input.models.planner);
    resolveModelRoute(config, input.models.executor);
    resolveModelRoute(config, input.models.summarizer);
    if (input.models.imagePrompter.trim()) {
      resolveModelRoute(config, input.models.imagePrompter);
    }

    const timestamp = new Date().toISOString();
    const saved = await saveConfig({
      ...config,
      models: input.models,
      updatedAt: timestamp,
    });
    return jsonOk({
      config: toPublicConfig(saved),
      configured: isConfigured(saved),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
