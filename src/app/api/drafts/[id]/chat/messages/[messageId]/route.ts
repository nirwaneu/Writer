import { z } from "zod";
import { assertSameOrigin, errorResponse, jsonOk, parseBody } from "@/lib/api";
import { readDraftChat, saveDraftChat } from "@/lib/storage/chats";
import {
  deleteMessageVersion,
  editAssistantMessage,
  editUserMessage,
  switchMessageVersion,
} from "@/lib/chat/messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; messageId: string }> };

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("switch"), alternativeId: z.string().min(1) }),
  z.object({ action: z.literal("edit"), content: z.string().trim().min(1).max(20_000) }),
  z.object({
    action: z.literal("editAssistant"),
    content: z.string().trim().min(1).max(200_000),
  }),
]);

export async function PATCH(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { id, messageId } = await params;
    const input = await parseBody(request, patchSchema);
    const chat = await readDraftChat(id, "premise");
    const next =
      input.action === "switch"
        ? switchMessageVersion(chat, messageId, input.alternativeId)
        : input.action === "edit"
          ? editUserMessage(chat, messageId, input.content)
          : editAssistantMessage(chat, messageId, input.content);
    const saved = await saveDraftChat(id, next);
    return jsonOk({ chat: saved });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { id, messageId } = await params;
    const chat = await readDraftChat(id, "premise");
    const next = deleteMessageVersion(chat, messageId);
    const saved = await saveDraftChat(id, next);
    return jsonOk({ chat: saved });
  } catch (error) {
    return errorResponse(error);
  }
}
