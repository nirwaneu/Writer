import { assertSameOrigin, errorResponse, jsonOk } from "@/lib/api";
import { discardDraft, getDraft } from "@/lib/storage/novels";
import { readDraftChat } from "@/lib/storage/chats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const outline = await getDraft(id);
    const chat = await readDraftChat(id, "premise");
    return jsonOk({ draft: { id, outline }, chat });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    await discardDraft(id);
    return jsonOk({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
