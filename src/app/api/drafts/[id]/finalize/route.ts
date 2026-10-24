import { z } from "zod";
import { assertSameOrigin, errorResponse, jsonOk, parseBody } from "@/lib/api";
import { generateTitleText } from "@/lib/ai/title";
import { roleInjections } from "@/lib/ai/prompts";
import { resolveModelRoute } from "@/lib/ai/routing";
import { publishDraft } from "@/lib/storage/novels";
import { requireConfig } from "@/lib/storage/config";
import { getDraftBookConfig } from "@/lib/storage/book-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

const finalizeSchema = z.object({
  title: z.string().trim().max(200).optional(),
  premise: z.string().trim().min(1).max(200_000),
});

function cleanTitle(raw: string): string {
  const firstLine = raw.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "";
  return firstLine
    .replace(/^(title|book title)\s*[:\-]\s*/i, "")
    .replace(/^["'“”‘’#*\s]+|["'“”‘’#*.\s]+$/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 120)
    .trim();
}

function fallbackTitle(premise: string): string {
  const words = premise
    .replace(/[^a-zA-Z0-9'\s-]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5);
  if (!words.length) return "Untitled Novel";
  return words
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ")
    .slice(0, 120);
}

async function generateTitle(draftId: string, premise: string): Promise<string> {
  const global = await requireConfig();
  const config = (await getDraftBookConfig(draftId)).config;
  const role = config.roles.titleGenerator;
  const route = resolveModelRoute(global, config.models.planner);
  try {
    const content = await generateTitleText({
      baseUrl: route.provider.baseUrl,
      apiKey: route.provider.apiKey,
      model: route.model,
      context: premise,
      systemPrompt: role.systemPrompt,
      params: role.params,
      injections: roleInjections(role),
    });
    return cleanTitle(content) || fallbackTitle(premise);
  } catch {
    return fallbackTitle(premise);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const input = await parseBody(request, finalizeSchema);
    const title = input.title?.trim()
      ? cleanTitle(input.title)
      : await generateTitle(id, input.premise);
    const result = await publishDraft(id, { title, premise: input.premise });
    return jsonOk({ ...result, title });
  } catch (error) {
    return errorResponse(error);
  }
}
