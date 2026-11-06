import { z } from "zod";
import { assertSameOrigin, errorResponse, jsonOk, parseBody } from "@/lib/api";
import { reorderSurgicalPresets } from "@/lib/storage/surgical-presets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  ids: z.array(z.string().min(1).max(100)).max(200),
});

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const input = await parseBody(request, schema);
    return jsonOk({ presets: await reorderSurgicalPresets(input.ids) });
  } catch (error) {
    return errorResponse(error);
  }
}