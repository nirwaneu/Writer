import { z } from "zod";
import { assertSameOrigin, errorResponse, jsonOk, parseBody } from "@/lib/api";
import { addPage } from "@/lib/storage/novels";
import { pageKindSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

const schema = z.object({
  kind: pageKindSchema,
});

export async function POST(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { slug } = await params;
    const input = await parseBody(request, schema);
    const result = await addPage(slug, input.kind);
    return jsonOk(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
