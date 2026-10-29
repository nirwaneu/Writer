import { z } from "zod";
import { assertSameOrigin, errorResponse, jsonOk, parseBody } from "@/lib/api";
import { AppError } from "@/lib/errors";
import {
  deletePage,
  ensureChapter,
  getChapterContent,
  getNovel,
  saveChapterContent,
  saveChapterSummary,
  updateChapterTitle,
} from "@/lib/storage/novels";

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

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    summary: z.string().max(1_000_000).optional(),
  })
  .refine((value) => value.title !== undefined || value.summary !== undefined, {
    message: "Provide a title or a summary to update.",
  });

export async function PATCH(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { slug, number } = await params;
    const input = await parseBody(request, patchSchema);
    if (input.title === undefined && input.summary === undefined) {
      throw new AppError("BAD_REQUEST", "Provide a title or a summary to update.", {
        status: 400,
      });
    }

    const outline =
      input.summary !== undefined
        ? await saveChapterSummary(slug, Number(number), input.summary, input.title)
        : await updateChapterTitle(slug, Number(number), input.title as string);
    const chapter = outline.chapters.find((item) => item.number === Number(number)) ?? null;
    return jsonOk({ chapter, outline });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { slug, number } = await params;
    const outline = await deletePage(slug, Number(number));
    return jsonOk({ outline });
  } catch (error) {
    return errorResponse(error);
  }
}
