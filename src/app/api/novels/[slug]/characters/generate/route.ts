import { z } from "zod";
import { assertSameOrigin, errorResponse, jsonOk } from "@/lib/api";
import { chatCompletion } from "@/lib/ai/client";
import { buildCharacterExtractionMessages, roleInjections } from "@/lib/ai/prompts";
import { resolveModelRoute } from "@/lib/ai/routing";
import { AppError } from "@/lib/errors";
import { characterSchema } from "@/lib/schemas";
import { requireConfig } from "@/lib/storage/config";
import { getBookConfig } from "@/lib/storage/book-config";
import { getNovel, saveCharacters } from "@/lib/storage/novels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Params = { params: Promise<{ slug: string }> };

const characterListSchema = z.array(characterSchema).min(1).max(100);

function parseCharacters(raw: string) {
  const cleaned = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start < 0 || end < start) {
    throw new AppError("AI_BAD_RESPONSE", "The Planner did not return a character list.", {
      status: 502,
      retryable: true,
    });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new AppError("AI_BAD_RESPONSE", "The Planner returned unreadable character data.", {
      status: 502,
      retryable: true,
    });
  }
  const result = characterListSchema.safeParse(parsed);
  if (!result.success) {
    throw new AppError("AI_BAD_RESPONSE", "The Planner returned an invalid character list.", {
      status: 502,
      retryable: true,
    });
  }
  return result.data;
}

export async function POST(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { slug } = await params;
    const global = await requireConfig();
    const outline = await getNovel(slug);
    if (!outline.premise.trim()) {
      throw new AppError("BAD_REQUEST", "Add a premise before generating characters.", {
        status: 400,
      });
    }
    const book = await getBookConfig(slug);
    const role = book.config.roles.planner;
    const route = resolveModelRoute(global, book.config.models.planner);
    const result = await chatCompletion({
      baseUrl: route.provider.baseUrl,
      apiKey: route.provider.apiKey,
      model: route.model,
      messages: buildCharacterExtractionMessages(
        outline,
        role.systemPrompt,
        roleInjections(role),
      ),
      params: role.params,
      maxTokens: 1_600,
      timeoutMs: 90_000,
      retries: 1,
    });
    const characters = parseCharacters(result.content);
    const saved = await saveCharacters(slug, characters);
    return jsonOk({ outline: saved, characters: saved.characters });
  } catch (error) {
    return errorResponse(error);
  }
}
