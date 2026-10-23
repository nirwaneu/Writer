import { z } from "zod";
import { assertSameOrigin, errorResponse, jsonOk, parseBody } from "@/lib/api";
import { characterSchema } from "@/lib/schemas";
import { saveCharacters } from "@/lib/storage/novels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

const schema = z.object({
  characters: z.array(characterSchema).max(100),
});

export async function PUT(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { slug } = await params;
    const input = await parseBody(request, schema);
    const outline = await saveCharacters(slug, input.characters);
    return jsonOk({ outline });
  } catch (error) {
    return errorResponse(error);
  }
}
