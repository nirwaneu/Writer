import { z } from "zod";
import { assertSameOrigin, errorResponse, jsonOk, parseBody } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { readNovelChat, saveNovelChat } from "@/lib/storage/chats";
import {
  deleteMessageVersion,
  editUserMessage,
  switchMessageVersion,
} from "@/lib/chat/messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string; scope: string; messageId: string }> };

function parseScope(raw: string): "premise" | number {
  if (raw === "premise") return "premise";
  const number = Number(raw);
  if (!Number.isInteger(number) || number < 1) {
    throw new AppError("BAD_REQUEST", "Invalid chat scope.", { status: 400 });
  }
  return number;
}

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("switch"), alternativeId: z.string().min(1) }),
  z.object({ action: z.literal("edit"), content: z.string().trim().min(1).max(20_000) }),
]);

export async function PATCH(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { slug, scope, messageId } = await params;
    const input = await parseBody(request, patchSchema);
    const chat = await readNovelChat(slug, parseScope(scope));
    const next =
      input.action === "switch"
        ? switchMessageVersion(chat, messageId, input.alternativeId)
        : editUserMessage(chat, messageId, input.content);
    const saved = await saveNovelChat(slug, next);
    return jsonOk({ chat: saved });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const { slug, scope, messageId } = await params;
    const chat = await readNovelChat(slug, parseScope(scope));
    const next = deleteMessageVersion(chat, messageId);
    const saved = await saveNovelChat(slug, next);
    return jsonOk({ chat: saved });
  } catch (error) {
    return errorResponse(error);
  }
}
