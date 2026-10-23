import { z } from "zod";
import { assertSameOrigin, errorResponse, jsonOk } from "@/lib/api";
import { createDraft } from "@/lib/storage/novels";
import { AppError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  presetId: z.string().min(1).max(100).optional(),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const raw = await request.json().catch(() => ({}));
    const parsed = createSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError("BAD_REQUEST", "Invalid preset selection.", { status: 400 });
    }
    const draft = await createDraft(parsed.data.presetId);
    return jsonOk({ draft }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
