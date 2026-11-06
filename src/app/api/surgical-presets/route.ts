import { assertSameOrigin, errorResponse, jsonOk, parseBody } from "@/lib/api";
import { surgicalPresetInputSchema } from "@/lib/schemas";
import {
  createSurgicalPreset,
  listSurgicalPresets,
} from "@/lib/storage/surgical-presets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const activeOnly = new URL(request.url).searchParams.get("active") === "1";
    return jsonOk({ presets: await listSurgicalPresets(activeOnly) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = await parseBody(request, surgicalPresetInputSchema);
    const preset = await createSurgicalPreset(input);
    return jsonOk(
      { preset, presets: await listSurgicalPresets() },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}