import { assertSameOrigin, errorResponse, jsonOk, parseBody } from "@/lib/api";
import { surgicalPresetUpdateSchema } from "@/lib/schemas";
import {
  deleteSurgicalPreset,
  listSurgicalPresets,
  updateSurgicalPreset,
} from "@/lib/storage/surgical-presets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const input = await parseBody(request, surgicalPresetUpdateSchema);
    const preset = await updateSurgicalPreset(id, input);
    return jsonOk({ preset, presets: await listSurgicalPresets() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    await deleteSurgicalPreset(id);
    return jsonOk({ presets: await listSurgicalPresets() });
  } catch (error) {
    return errorResponse(error);
  }
}