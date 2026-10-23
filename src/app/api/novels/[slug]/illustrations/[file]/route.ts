import { promises as fs } from "node:fs";
import { errorResponse } from "@/lib/api";
import { NotFoundError } from "@/lib/errors";
import {
  assertImageFilename,
  assertSlug,
  illustrationPath,
} from "@/lib/storage/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string; file: string }> };

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export async function GET(_request: Request, { params }: Params) {
  try {
    const { slug, file } = await params;
    const safeSlug = assertSlug(slug);
    const filename = assertImageFilename(file);
    const extension = filename.split(".").pop()?.toLowerCase() ?? "png";
    let data: Buffer;
    try {
      data = await fs.readFile(illustrationPath(safeSlug, filename));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new NotFoundError("That illustration does not exist.");
      }
      throw error;
    }

    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": MIME[extension] ?? "application/octet-stream",
        "Content-Length": String(data.length),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
