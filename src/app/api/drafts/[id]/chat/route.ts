import { z } from "zod";
import { assertSameOrigin, errorResponse, jsonOk, parseBody } from "@/lib/api";
import { getDraft } from "@/lib/storage/novels";
import { appendDraftChatMessage, readDraftChat } from "@/lib/storage/chats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    await getDraft(id);
    const chat = await readDraftChat(id, "premise");
    return jsonOk({ chat });
  } catch (error) {
    return errorResponse(error);
  }
}

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(200_000),
});

export async function POST(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    await getDraft(id);
    const input = await parseBody(request, messageSchema);
    const chat = await appendDraftChatMessage(id, "premise", {
      id: crypto.randomUUID(),
      role: input.role,
      content: input.content,
      createdAt: new Date().toISOString(),
    });
    return jsonOk({ chat }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
