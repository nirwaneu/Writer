import { z } from "zod";
import { assertSameOrigin, errorResponse, jsonOk, parseBody } from "@/lib/api";
import { publishDraft } from "@/lib/storage/novels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const finalizeSchema = z.object({
  title: z.string().trim().min(1).max(200),
  premise: z.string().trim().min(1).max(20_000),
});

export async function POST(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const input = await parseBody(request, finalizeSchema);
    const result = await publishDraft(id, input);
    return jsonOk(result);
  } catch (error) {
    return errorResponse(error);
  }
}
