import { assertSameOrigin, errorResponse, jsonOk } from "@/lib/api";
import { resetSurgicalPresets } from "@/lib/storage/surgical-presets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    return jsonOk({ presets: await resetSurgicalPresets() });
  } catch (error) {
    return errorResponse(error);
  }
}