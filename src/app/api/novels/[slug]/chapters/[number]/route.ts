import { z } from "zod";
import { assertSameOrigin, errorResponse, jsonOk, parseBody } from "@/lib/api";
import { ensureChapter, getChapterContent, getNovel, saveChapterContent } from "@/lib/storage/novels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string; number: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { slug, number } = await params;
    const chapterNumber = Number(number);
    const outline = await ensureChapter(slug, chapterNumber);
    const chapter = outline.chapters.find((item) => item.number === chapterNumber);
    const content = await getChapterContent(slug, chapterNumber);
    return jsonOk({ chapter, content, outline });
  } catch (error) {
    return errorResponse(error);
  }
}

const saveSchema = z.object({
  content: z.string().max(1_000_000),
  expectedUpdatedAt: z.string().optional(),
});

export async function PUT(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { slug, number } = await params;
    const input = await parseBody(request, saveSchema);
    const chapter = await saveChapterContent(
      slug,
      Number(number),
      input.content,
      input.expectedUpdatedAt,
    );
    const outline = await getNovel(slug);
    return jsonOk({ chapter, outline });
  } catch (error) {
    return errorResponse(error);
  }
}
