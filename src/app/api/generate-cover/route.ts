import { z } from "zod";
import { assertSameOrigin, errorResponse, jsonOk, parseBody } from "@/lib/api";
import { generateImage } from "@/lib/ai/client";
import { NotFoundError } from "@/lib/errors";
import { imageAspectRatioSchema } from "@/lib/schemas";
import { saveCoverResult, getNovel } from "@/lib/storage/novels";
import { requireConfig } from "@/lib/storage/config";
import { assertSlug } from "@/lib/storage/paths";
import {
  deleteIllustrationFile,
  writeIllustrationFile,
} from "@/lib/storage/illustrations";
import { illustrationUrl } from "@/lib/pages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  slug: z.string().min(1).max(80),
  providerId: z.string().min(1).max(100),
  model: z.string().trim().min(1).max(200),
  prompt: z.string().trim().min(1).max(4_000),
  negativePrompt: z.string().max(2_000).optional(),
  aspectRatio: imageAspectRatioSchema.default("portrait"),
});

const SIZES = {
  portrait: "1024x1792",
  square: "1024x1024",
  landscape: "1792x1024",
} as const;

export async function POST(request: Request) {
  let writtenFile: string | null = null;
  let slug = "";
  try {
    assertSameOrigin(request);
    const input = await parseBody(request, schema);
    slug = assertSlug(input.slug);
    const config = await requireConfig();
    const provider = config.providers.find((item) => item.id === input.providerId);
    if (!provider) {
      throw new NotFoundError("That provider connection no longer exists.");
    }

    const before = await getNovel(slug);
    const generated = await generateImage({
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      model: input.model,
      prompt: input.prompt,
      negativePrompt: input.negativePrompt,
      size: SIZES[input.aspectRatio],
    });

    writtenFile = await writeIllustrationFile(
      slug,
      0,
      generated.bytes,
      generated.mime,
    );
    const savedFilename = writtenFile;
    const outline = await saveCoverResult(slug, {
      path: writtenFile,
      prompt: input.prompt,
      negativePrompt: input.negativePrompt?.trim() ?? "",
      aspectRatio: input.aspectRatio,
      providerId: provider.id,
      model: input.model,
    });
    writtenFile = null;

    if (before.cover?.path && before.cover.path !== savedFilename) {
      await deleteIllustrationFile(slug, before.cover.path).catch(() => undefined);
    }

    return jsonOk({
      outline,
      cover: outline.cover,
      imageUrl: illustrationUrl(slug, savedFilename),
    });
  } catch (error) {
    if (writtenFile && slug) {
      await deleteIllustrationFile(slug, writtenFile).catch(() => undefined);
    }
    return errorResponse(error);
  }
}
