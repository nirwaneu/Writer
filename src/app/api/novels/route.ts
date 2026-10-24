import { assertSameOrigin, errorResponse, jsonOk } from "@/lib/api";
import { createDraft, listArchivedNovels, listNovels } from "@/lib/storage/novels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const archived = new URL(request.url).searchParams.get("archived") === "1";
    const novels = archived ? await listArchivedNovels() : await listNovels();
    return jsonOk({ novels });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const draft = await createDraft();
    return jsonOk({ draft }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
