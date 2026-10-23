import { errorResponse, jsonOk } from "@/lib/api";
import { getConfig, isConfigured, toPublicConfig } from "@/lib/storage/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = await getConfig();
    return jsonOk({
      config: toPublicConfig(config),
      configured: isConfigured(config),
      hasConfig: Boolean(config),
      presets: config?.presets ?? [],
      defaultPresetId: config?.defaultPresetId ?? null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
