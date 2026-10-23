import { randomUUID } from "node:crypto";
import {
  presetCreateSchema,
  type Preset,
} from "@/lib/schemas";
import { assertSameOrigin, errorResponse, jsonOk, parseBody } from "@/lib/api";
import { requireConfig, saveConfig } from "@/lib/storage/config";
import {
  clonePresetRoles,
  resolvePreset,
} from "@/lib/presets/defaults";
import { DEFAULT_PRESET_ID } from "@/lib/presets/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = await requireConfig();
    return jsonOk({
      presets: config.presets,
      defaultPresetId: config.defaultPresetId,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

function uniqueName(existing: Preset[], desired: string): string {
  const names = new Set(existing.map((preset) => preset.name.toLowerCase()));
  if (!names.has(desired.toLowerCase())) return desired;
  for (let index = 2; index < 100; index += 1) {
    const candidate = `${desired} (${index})`;
    if (!names.has(candidate.toLowerCase())) return candidate;
  }
  return `${desired} (${randomUUID().slice(0, 4)})`;
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = await parseBody(request, presetCreateSchema);
    const config = await requireConfig();
    const base = resolvePreset(config, DEFAULT_PRESET_ID);
    const timestamp = new Date().toISOString();
    const preset: Preset = {
      id: randomUUID(),
      name: uniqueName(config.presets, input.name?.trim() || "New preset"),
      description: input.description ?? "",
      builtIn: false,
      roles: input.roles ? clonePresetRoles(input.roles) : clonePresetRoles(base.roles),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const saved = await saveConfig({
      ...config,
      presets: [...config.presets, preset],
      updatedAt: timestamp,
    });

    return jsonOk(
      {
        preset,
        presets: saved.presets,
        defaultPresetId: saved.defaultPresetId,
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
