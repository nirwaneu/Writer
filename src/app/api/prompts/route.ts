import { z } from "zod";
import { assertSameOrigin, errorResponse, jsonOk, parseBody } from "@/lib/api";
import { PROMPT_DEFINITIONS } from "@/lib/ai/prompt-definitions";
import { getPromptMap, savePromptMap } from "@/lib/storage/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const prompts = await getPromptMap();
    return jsonOk({ prompts, definitions: PROMPT_DEFINITIONS });
  } catch (error) {
    return errorResponse(error);
  }
}

const schema = z.object({
  prompts: z.record(z.string(), z.string().max(200_000)),
});

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const input = await parseBody(request, schema);
    const prompts = await savePromptMap(input.prompts);
    return jsonOk({ prompts });
  } catch (error) {
    return errorResponse(error);
  }
}