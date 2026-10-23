import { presetUpdateSchema } from "@/lib/schemas";
import { assertSameOrigin, errorResponse, jsonOk, parseBody } from "@/lib/api";
import { AppError, NotFoundError } from "@/lib/errors";
import { requireConfig, saveConfig } from "@/lib/storage/config";
import { DEFAULT_PRESET_ID } from "@/lib/presets/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const input = await parseBody(request, presetUpdateSchema);
    const config = await requireConfig();
    const existing = config.presets.find((preset) => preset.id === id);
    if (!existing) throw new NotFoundError("That preset does not exist.");

    const timestamp = new Date().toISOString();
    const updated = {
      ...existing,
      name: input.name,
      description: input.description,
      roles: input.roles,
      builtIn: existing.id === DEFAULT_PRESET_ID ? true : existing.builtIn,
      updatedAt: timestamp,
    };

    const saved = await saveConfig({
      ...config,
      presets: config.presets.map((preset) => (preset.id === id ? updated : preset)),
      updatedAt: timestamp,
    });

    return jsonOk({
      preset: updated,
      presets: saved.presets,
      defaultPresetId: saved.defaultPresetId,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const config = await requireConfig();
    const existing = config.presets.find((preset) => preset.id === id);
    if (!existing) throw new NotFoundError("That preset does not exist.");
    if (existing.builtIn || existing.id === DEFAULT_PRESET_ID) {
      throw new AppError("BAD_REQUEST", "The base fallback preset cannot be deleted.", {
        status: 400,
      });
    }

    const timestamp = new Date().toISOString();
    const saved = await saveConfig({
      ...config,
      presets: config.presets.filter((preset) => preset.id !== id),
      defaultPresetId:
        config.defaultPresetId === id ? DEFAULT_PRESET_ID : config.defaultPresetId,
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
