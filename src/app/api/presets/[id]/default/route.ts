import { assertSameOrigin, errorResponse, jsonOk } from "@/lib/api";
import { NotFoundError } from "@/lib/errors";
import { requireConfig, saveConfig } from "@/lib/storage/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const config = await requireConfig();
    const existing = config.presets.find((preset) => preset.id === id);
    if (!existing) throw new NotFoundError("That preset does not exist.");

    const timestamp = new Date().toISOString();
    const saved = await saveConfig({
      ...config,
      defaultPresetId: id,
      updatedAt: timestamp,
    });

    return jsonOk({
      presets: saved.presets,
      defaultPresetId: saved.defaultPresetId,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
