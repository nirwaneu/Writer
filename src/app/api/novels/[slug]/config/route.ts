import {
  bookConfigUpdateSchema,
  type BookConfig,
} from "@/lib/schemas";
import { assertSameOrigin, errorResponse, jsonOk, parseBody } from "@/lib/api";
import { getConfig, requireConfig } from "@/lib/storage/config";
import { getNovel } from "@/lib/storage/novels";
import { getBookConfig, saveBookConfig } from "@/lib/storage/book-config";
import { DEFAULT_PRESET_ID } from "@/lib/presets/constants";
import { resolveModelRoute } from "@/lib/ai/routing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    await getNovel(slug);
    const [resolved, global] = await Promise.all([getBookConfig(slug), getConfig()]);
    return jsonOk({
      config: resolved.config,
      source: resolved.source,
      presets: global?.presets ?? [],
      defaultPresetId: global?.defaultPresetId ?? DEFAULT_PRESET_ID,
      globalModels: global?.models ?? null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { slug } = await params;
    await getNovel(slug);
    const global = await requireConfig();
    const input = await parseBody(request, bookConfigUpdateSchema);
    resolveModelRoute(global, input.models.planner);
    resolveModelRoute(global, input.models.executor);
    resolveModelRoute(global, input.models.summarizer);
    const config: BookConfig = await saveBookConfig(slug, input);
    return jsonOk({ config, source: "local" });
  } catch (error) {
    return errorResponse(error);
  }
}
