import { z } from "zod";
import { assertSameOrigin, errorResponse, jsonOk, parseBody } from "@/lib/api";
import { generateTitleText } from "@/lib/ai/title";
import { resolveModelRoute } from "@/lib/ai/routing";
import { AppError, NotFoundError } from "@/lib/errors";
import { requireConfig } from "@/lib/storage/config";
import { getBookConfig } from "@/lib/storage/book-config";
import { readNovelChat } from "@/lib/storage/chats";
import { getNovel } from "@/lib/storage/novels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

const schema = z.object({
  slug: z.string().min(1).max(80),
  kind: z.enum(["book", "chapter"]),
  chapter: z.number().int().positive().max(500).optional(),
  premise: z.string().max(200_000).optional(),
});

function cleanTitle(raw: string): string {
  const firstLine = raw.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "";
  return firstLine
    .replace(/^(book title|chapter title|title)\s*[:\-]\s*/i, "")
    .replace(/^["'“”‘’#*\s]+|["'“”‘’#*.\s]+$/g, "")
    .replace(/^chapter\s+\d+\s*[:\-—]\s*/i, "")
    .replace(/\s+/g, " ")
    .slice(0, 120)
    .trim();
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = await parseBody(request, schema);
    const global = await requireConfig();
    const outline = await getNovel(input.slug);
    const book = await getBookConfig(input.slug);
    const role = book.config.roles.titleGenerator;
    const route = resolveModelRoute(
      global,
      book.config.models.planner || global.models.planner,
    );

    let context: string;
    if (input.kind === "book") {
      context = (input.premise ?? outline.premise).trim();
      if (!context) {
        throw new AppError("BAD_REQUEST", "Add a premise before generating a book title.", {
          status: 400,
        });
      }
    } else {
      if (!input.chapter) {
        throw new AppError("BAD_REQUEST", "Choose a chapter first.", { status: 400 });
      }
      const chapter = outline.chapters.find((item) => item.number === input.chapter);
      if (!chapter) throw new NotFoundError("That chapter does not exist.");
      const chat = await readNovelChat(input.slug, chapter.number);
      const lastPlanner = [...chat.messages]
        .reverse()
        .find(
          (message) =>
            message.role === "assistant" && !message.failed && message.content.trim(),
        );
      if (!lastPlanner) {
        throw new AppError(
          "BAD_REQUEST",
          "Plan this chapter with the Planner before generating a title.",
          { status: 400 },
        );
      }
      context = lastPlanner.content;
    }

    const content = await generateTitleText({
      baseUrl: route.provider.baseUrl,
      apiKey: route.provider.apiKey,
      model: route.model,
      context,
      systemPrompt: role.systemPrompt,
      params: role.params,
    });
    const title = cleanTitle(content);
    if (!title) {
      throw new AppError("AI_BAD_RESPONSE", "The title model returned an empty title.", {
        status: 502,
        retryable: true,
      });
    }
    return jsonOk({ title, model: route.model, provider: route.provider.name });
  } catch (error) {
    return errorResponse(error);
  }
}
