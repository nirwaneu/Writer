import { assertSameOrigin, errorResponse, jsonOk } from "@/lib/api";
import { skipChapterSummary } from "@/lib/storage/novels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string; number: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { slug, number } = await params;
    const outline = await skipChapterSummary(slug, Number(number));
    return jsonOk({ outline });
  } catch (error) {
    return errorResponse(error);
  }
}
