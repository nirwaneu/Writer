import { z } from "zod";
import { assertSameOrigin, errorResponse, jsonOk, parseBody } from "@/lib/api";
import {
  deleteNovel,
  getNovelDetail,
  updateNovelMeta,
} from "@/lib/storage/novels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    return jsonOk(await getNovelDetail(slug));
  } catch (error) {
    return errorResponse(error);
  }
}

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  premise: z.string().max(20_000).optional(),
  status: z.enum(["active", "complete"]).optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { slug } = await params;
    const patch = await parseBody(request, patchSchema);
    const outline = await updateNovelMeta(slug, patch);
    return jsonOk({ outline });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { slug } = await params;
    await deleteNovel(slug);
    return jsonOk({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
